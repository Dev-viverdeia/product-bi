-- =====================================================================
-- Grupo pipeline e retenção: os 4 marts com semântica de empresa passam a
-- espelhar o contrato `pulse` (8 foreign tables), e não mais a extração manual
-- do cs_pulse_platform.
--
-- DROP/RECREATE e não ALTER: as 4 tabelas estão VAZIAS (medido: 0 linhas em
-- card, movimento, cancelamento e empresa). Não há dado a preservar, e as
-- mudanças são de grão (dim_cs_empresa), de chave (cancelamento) e de
-- vocabulário — alter incremental deixaria o rastro de três contratos
-- sobrepostos numa tabela só.
--
-- O que muda de verdade, medido em 12/08/2026 contra o schema `pulse`:
--   · dim_cs_empresa sai do grão empresa_id/CANCELADO-REVERTIDO-LEVANTOU_A_MAO
--     para o grão cliente_key/RETIDO-PERDIDO-EM_ABERTO, que é o que a origem
--     entrega (232 linhas, 232 cliente_key distintos — chave confirmada única).
--   · as 3 facts ganham organization_id, a chave que liga CS a
--     marts.dim_organizacao (cobertura: card 75,2%, movimento 80,4%,
--     cancelamento 83,8%).
--   · as facts param de descartar o que o contrato entrega: etapa_ativa, plano,
--     base_ativa, prioridade, de_ordem/para_ordem, ator_hash, os 4 valores
--     financeiros, os hashes de solicitante.
--
-- SEM FOREIGN KEY para marts.dim_organizacao: 81 cards e 143 movimentos
-- apontam organization_id que NÃO existe em dim_organizacao (org do CS que a
-- plataforma ainda não tem, ou já removeu). FK aqui derrubaria o sync a cada
-- 30 min por dado legítimo. O join é left join e a tela declara a cobertura.
--
-- PII: nada de reversão. A origem já entrega hash (contato, empresa, ator,
-- solicitante) e o hash é copiado como está — serve para count(distinct), não
-- identifica ninguém. Isto muda o combinado da migration 20260811153503, que
-- excluía `solicitante_*`: lá o campo era PII crua, aqui já chega hasheado.
-- =====================================================================

-- v_cs_frescor depende das 4 tabelas; cai junto e é recriada na migration
-- própria dela (marts.v_cs_frescor tem uma dona só, e não é este arquivo).
drop view if exists marts.v_cs_frescor cascade;

drop table if exists marts.fact_cs_card;
drop table if exists marts.fact_cs_movimento;
drop table if exists marts.fact_cs_cancelamento;
drop table if exists marts.dim_cs_empresa;

-- =====================================================================
-- DIMENSÃO — cliente na régua de retenção do CS
-- =====================================================================
-- Grão: cliente DEDUPLICADO (`cliente_key`), não empresa e não solicitação.
-- A origem já resolve a dedup: 271 cancelamentos viram 232 clientes.
-- `cliente_key` é opaca — medido: não é empresa_id, não é cancelamento_id e não
-- é id_via (zero interseção com as três). Serve de chave e mais nada; quem
-- amarra este cliente ao resto do CS é `empresa_hash`.
create table marts.dim_cs_empresa (
  cliente_key            text primary key,

  -- id_via chega como text na origem e é convertido aqui para casar com
  -- fact_cs_cancelamento.id_via / fact_cs_card.id_via, que são uuid.
  -- ATENÇÃO: NÃO é organization_id — medido, zero dos 177 id_via preenchidos
  -- existem em marts.dim_organizacao. Confundir os dois zera qualquer join.
  id_via                 uuid,
  empresa_hash           text,

  -- `retencao` é a única das 8 foreign tables que NÃO entrega organization_id.
  -- Derivado por empresa_hash contra pulse.cancelamentos, e só quando o hash
  -- resolve UMA org. Medido em 12/08/2026: 205 única · 1 ambígua · 26 sem org.
  organization_id        uuid,
  atribuicao_org         text not null
    check (atribuicao_org in ('unica','ambigua','sem_org')),

  plano                  text,

  -- DUAS VERDADES QUE NÃO SE FUNDEM, e é deliberado que fiquem lado a lado:
  --   `desfecho`   = onde o CS parou o processo de retenção;
  --   `base_ativa` = se a plataforma ainda considera o cliente na base.
  -- Medido em 12/08/2026: 57 dos 100 PERDIDO estão com base ativa (a origem é
  -- viva — duas leituras com minutos de diferença deram 56/99 e 57/100).
  -- Não é erro de um dos dois lados — é o intervalo entre o acordo de saída e o
  -- fim do acesso contratado (e, em parte, base que ainda não foi baixada).
  -- Colapsar isso num campo só escolheria em silêncio de quem é a razão. O mart
  -- guarda os dois e nomeia a divergência em `desfecho_conflita_base`, para a
  -- tela poder mostrar "99 perdidos, 56 ainda com acesso" em vez de um número
  -- que mente.
  base_ativa             boolean not null,
  desfecho               text not null
    check (desfecho in ('RETIDO','PERDIDO','EM_ABERTO')),
  desfecho_conflita_base boolean
    generated always as (desfecho = 'PERDIDO' and base_ativa) stored,

  -- posição no funil de cancelamento (1 Solicitação → 9 Revertido).
  -- Não substitui `desfecho`: as ordens 6 e 8 têm PERDIDO e RETIDO juntos.
  etapa_atual            text not null,
  etapa_ordem            integer not null,
  etapa_desde            timestamptz not null,
  etapa_desde_brt        date not null,

  tipo_acordo            text,
  status_financeiro      text,

  -- data de negócio: 8 dos 232 vêm sem solicitação datada
  solicitado_em          timestamptz,
  solicitado_em_brt      date,

  carregado_em           timestamptz not null default now()
);

comment on table marts.dim_cs_empresa is
  'Cliente deduplicado na régua de retenção do CS (contrato pulse.retencao). Grão cliente_key. desfecho (RETIDO/PERDIDO/EM_ABERTO) é a verdade do CS e base_ativa é a da plataforma; quando divergem, desfecho_conflita_base marca — 57 dos 100 PERDIDO em 12/08/2026.';
comment on column marts.dim_cs_empresa.organization_id is
  'Derivado por empresa_hash contra pulse.cancelamentos (a origem de retenção não entrega a chave). Preenchido só quando atribuicao_org = ''unica''.';

create index ix_cs_empresa_desfecho on marts.dim_cs_empresa (desfecho);
create index ix_cs_empresa_org on marts.dim_cs_empresa (organization_id)
  where organization_id is not null;

-- =====================================================================
-- FUNIS — card por empresa × quadro (FOTO do estado atual)
-- =====================================================================
-- empresa_id segue NOT NULL: medido, 0 nulos em 6.572 cards. A dúvida do
-- briefing foi medida e a resposta é que a coluna é de fato obrigatória.
create table marts.fact_cs_card (
  card_id             uuid primary key,
  empresa_id          uuid not null,
  organization_id     uuid,
  id_via              uuid,
  empresa_hash        text,

  quadro              text not null,
  etapa               text not null,
  etapa_ordem         integer not null,
  -- Hoje é `true` em 6.572 de 6.572: o contrato só expõe card em etapa ativa.
  -- Materializada mesmo assim porque é o que separa "some da origem" de
  -- "mudou de estado" no dia em que o CS abrir as etapas inativas.
  etapa_ativa         boolean not null,

  plano               text,
  base_ativa          boolean not null,
  -- também degenerada hoje (0 de 6.572 marcados). O contrato entrega, o mart guarda.
  prioridade          boolean not null,

  entrou_na_etapa_em  timestamptz not null,
  entrou_na_etapa_brt date not null,
  criado_em           timestamptz not null,
  criado_em_brt       date not null,
  carregado_em        timestamptz not null default now()
);

comment on table marts.fact_cs_card is
  'Foto dos cards em etapa ativa (contrato pulse.pipeline_cards). Card removido SOME da origem, por isso a carga é full refresh — o histórico de passagem vive em fact_cs_movimento.';

create index ix_cs_card_quadro on marts.fact_cs_card (quadro, etapa_ordem);
create index ix_cs_card_empresa on marts.fact_cs_card (empresa_id);
create index ix_cs_card_org on marts.fact_cs_card (organization_id)
  where organization_id is not null;

-- =====================================================================
-- MOVIMENTOS — histórico de passagem pelas etapas (append-only)
-- =====================================================================
-- Começa em 08/07/2026 na origem: antes disso não existe. É o único caminho
-- para "tempo em etapas já percorridas" e para reconstruir card removido.
create table marts.fact_cs_movimento (
  movimento_id    uuid primary key,
  empresa_id      uuid not null,
  organization_id uuid,
  quadro          text not null,

  -- de_* nulo = entrada no quadro (acao 'criado'), 3.845 casos;
  -- para_* nulo = saída do quadro (acao 'removido'), 1.428 casos.
  -- Os nulos são a informação, não ausência dela.
  de_etapa        text,
  de_ordem        integer,
  para_etapa      text,
  para_ordem      integer,

  acao            text not null,   -- criado | movido | removido
  origem          text not null,   -- humano | motor
  -- quem moveu, hasheado na origem. Só serve para distinguir e contar.
  ator_hash       text,

  criado_em       timestamptz not null,
  criado_em_brt   date not null,
  carregado_em    timestamptz not null default now()
);

comment on table marts.fact_cs_movimento is
  'Log append-only de movimentação de card (contrato pulse.pipeline_movimentos). Histórico começa em 08/07/2026 na origem.';

create index ix_cs_movimento_dia on marts.fact_cs_movimento (criado_em_brt);
create index ix_cs_movimento_empresa on marts.fact_cs_movimento (empresa_id);
create index ix_cs_movimento_org on marts.fact_cs_movimento (organization_id)
  where organization_id is not null;

-- =====================================================================
-- CANCELAMENTO — solicitação (1 por empresa; 271 linhas, 271 empresas)
-- =====================================================================
-- PK renomeada de `solicitacao_id` para `cancelamento_id`, que é o nome do
-- contrato. Nenhuma RPC referenciava a coluna antiga.
-- Coluna `ciclo` REMOVIDA: o contrato pulse não entrega, e mart não inventa
-- coluna que ninguém consegue preencher.
create table marts.fact_cs_cancelamento (
  cancelamento_id        uuid primary key,
  empresa_id             uuid not null,
  organization_id        uuid,
  id_via                 uuid,
  empresa_hash           text,

  plano                  text,
  -- 32 nulos: solicitação sem empresa resolvida na base da plataforma
  base_ativa             boolean,

  -- hashes de solicitante vindos hasheados da origem: contam pessoas distintas
  -- sem identificar ninguém
  solicitante_email_hash text,
  solicitante_fone_hash  text,

  -- data de NEGÓCIO (6 nulos). Vai até 13/10/2025, muito antes de created_at
  -- (05/07/2026): created_at é quando a linha nasceu no CS, não quando o
  -- cliente pediu para sair. Série mensal usa solicitado_em_brt.
  solicitado_em          timestamptz,
  solicitado_em_brt      date,

  origem                 text,
  -- desfecho comercial (lista fechada). NÃO é o motivo do cancelamento: o campo
  -- de motivo é texto livre e a origem só entrega o booleano `tem_motivo`.
  tipo_acordo            text,
  status_financeiro      text,
  tipo_pagamento         text,
  metodo_pagamento       text,
  meio_pagamento         text,

  valor_contratado       numeric,
  valor_pago             numeric,
  valor_reembolso        numeric,
  valor_multa            numeric,
  data_reembolso_multa   timestamptz,
  data_reembolso_brt     date,

  tem_motivo             boolean not null,

  etapa_atual            text,
  etapa_ordem            integer,
  etapa_desde            timestamptz,
  etapa_desde_brt        date,

  criado_em              timestamptz not null,
  atualizado_em          timestamptz not null,
  carregado_em           timestamptz not null default now()
);

comment on table marts.fact_cs_cancelamento is
  'Solicitação de cancelamento (contrato pulse.cancelamentos), 1 por empresa. solicitado_em é a data de negócio; criado_em/atualizado_em são o relógio do CS e servem ao watermark.';

create index ix_cs_cancelamento_dia on marts.fact_cs_cancelamento (solicitado_em_brt);
create index ix_cs_cancelamento_org on marts.fact_cs_cancelamento (organization_id)
  where organization_id is not null;
create index ix_cs_cancelamento_hash on marts.fact_cs_cancelamento (empresa_hash)
  where empresa_hash is not null;

-- =====================================================================
-- RLS + leitura — mesmo padrão de todo o resto de marts
-- =====================================================================
-- As RPCs são SECURITY INVOKER: sem policy elas devolvem zero linha em
-- silêncio, que é o pior modo de falhar num BI.
do $$
declare t text;
begin
  foreach t in array array[
    'dim_cs_empresa','fact_cs_card','fact_cs_movimento','fact_cs_cancelamento'
  ] loop
    execute format('alter table marts.%I enable row level security', t);
    execute format('grant select on marts.%I to authenticated', t);
    execute format(
      'create policy leitura_bi on marts.%I for select to authenticated using (true)', t);
  end loop;
end $$;
