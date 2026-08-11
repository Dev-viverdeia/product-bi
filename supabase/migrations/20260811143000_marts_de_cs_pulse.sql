-- Camada de dados do dashboard executivo de CS, com origem no cs_pulse_platform
-- (ref tfwnxzbjfmmtskdvndcf, us-east-2).
--
-- O FORMATO DESTAS TABELAS É O CONTRATO. Hoje elas são carregadas por extração
-- manual, porque o FDW para o Pulse ainda depende de credencial e liberação de
-- IP; quando o FDW abrir, troca-se só o carregador — tabelas, RPCs, telas e
-- testes continuam iguais. Por isso toda tabela carrega `carregado_em`: a tela
-- declara a data do dado em vez de fingir que é de agora.
--
-- PII: nenhum indicador precisa de telefone, e-mail ou nome de cliente — precisa
-- de DISTINÇÃO, que é outra coisa. Guardamos hash da chave normalizada. Ficam
-- fora: phone_e164, contato, recipient_email/phone/name, solicitante_* e o
-- conteúdo das mensagens. Ver docs/discovery-banco-cs-pulse.md §7.
--
-- RLS ligada em tudo. A policy de leitura vem na migration seguinte
-- (20260811150000): as RPCs do projeto são SECURITY INVOKER, então sem policy
-- elas devolveriam zero linha em silêncio. marts segue fora da API REST — o app
-- só chega aqui através das funções em `public`.

-- ============================================================
-- DIMENSÃO — empresa vista pelo CS
-- ============================================================
create table if not exists marts.dim_cs_empresa (
  empresa_id            uuid primary key,
  nome                  text,
  plano                 text,
  -- foto que o Pulse tirou da plataforma. NÃO é a verdade sobre o cliente: a
  -- verdade vem do product_viverdeia_platform. Aqui serve de rótulo e de último
  -- critério da régua de retenção. `snap_at` existe para medir a idade da foto —
  -- 17% dela passa de 7 dias.
  ativo_na_plataforma   boolean,
  snap_at               timestamptz,
  -- Régua do Product BI (decisão do Mateus, 11/08/2026): revertido é acordo de
  -- reversão OU etapa "Revertido" no funil. Card no quadro Reversão sozinho é
  -- TENTATIVA, não recuperação — a view v_retencao_cobranca do Pulse conta como
  -- revertido e por isso devolve 38 onde a régua devolve 32.
  status_retencao       text check (status_retencao in ('CANCELADO','REVERTIDO','LEVANTOU_A_MAO')),
  -- por que caiu nesse status — a mesma trilha que a view do Pulse expõe
  motivo_retencao       text,
  -- os que seguem sendo perseguidos sem desfecho: métrica própria, nunca somada
  -- em "revertidos"
  em_tentativa_reversao boolean not null default false,
  carregado_em          timestamptz not null default now()
);

comment on table marts.dim_cs_empresa is
  'Empresa na ótica do CS (Pulse). status_retencao usa a régua do Product BI, que difere da v_retencao_cobranca do Pulse — ver docs/discovery-banco-cs-pulse.md §4.';

-- ============================================================
-- ATENDIMENTO — grão do ciclo (ticket), a unidade correta
-- ============================================================
-- 50 mensagens no mesmo ticket = 1 atendimento. Contar wa_messages infla ~25×.
create table if not exists marts.fact_cs_atendimento (
  ticket_id           uuid primary key,
  thread_id           uuid not null,
  abriu_em            timestamptz not null,
  abriu_em_brt        date not null,
  terminou_em         timestamptz,
  ticket_status       text not null,
  desfecho            text not null,
  -- quem DE FATO respondeu (1ª mensagem humana de saída), não quem está
  -- formalmente atribuído. São métricas diferentes; não misturar num gráfico.
  atendente_id        uuid,
  atendente_nome      text,
  ia_participou       boolean not null default false,
  canal               text,
  -- Só preenchido quando o telefone resolve UMA empresa. 12,8% dos ciclos têm
  -- chave ambígua (um telefone chega a apontar 9 empresas) e 16,8% não casam com
  -- empresa nenhuma — a cobertura real é 70,4%, não os 84,5% que um join ingênuo
  -- sugere. `atribuicao_empresa` existe para a tela declarar isso.
  empresa_id          uuid,
  atribuicao_empresa  text not null
    check (atribuicao_empresa in ('unica','ambigua','sem_empresa')),
  -- hash da chave normalizada: serve para count(distinct), não identifica ninguém
  contato_hash        text not null,
  carregado_em        timestamptz not null default now()
);

create index if not exists ix_cs_atendimento_dia on marts.fact_cs_atendimento (abriu_em_brt);
create index if not exists ix_cs_atendimento_empresa on marts.fact_cs_atendimento (empresa_id)
  where empresa_id is not null;

-- ============================================================
-- DISPAROS — três grãos que não se misturam
-- ============================================================
-- campanha ≠ mensagem ≠ pessoa impactada.
create table if not exists marts.fact_cs_disparo (
  disparo_id     uuid primary key,
  canal          text not null,
  status         text not null,
  criado_em      timestamptz not null,
  criado_em_brt  date not null,
  destinatarios  integer,
  enviados       integer,
  falhas         integer,
  ignorados      integer,
  carregado_em   timestamptz not null default now()
);

create table if not exists marts.fact_cs_envio (
  envio_id           uuid primary key,
  disparo_id         uuid,
  canal              text not null,
  -- 'skipped_dedup' NÃO é envio: é a trava anti-duplicidade de 24h. Somar junto
  -- infla o número de mensagens em ~14%.
  status             text not null,
  criado_em          timestamptz not null,
  criado_em_brt      date not null,
  -- grão de envio, e não pré-agregado por dia, justamente para
  -- count(distinct destinatario_hash) continuar correto em qualquer período
  destinatario_hash  text not null,
  carregado_em       timestamptz not null default now()
);

create index if not exists ix_cs_envio_dia on marts.fact_cs_envio (criado_em_brt);

-- ============================================================
-- CANCELAMENTO — solicitação (ciclo por empresa)
-- ============================================================
create table if not exists marts.fact_cs_cancelamento (
  solicitacao_id     uuid primary key,
  empresa_id         uuid,
  solicitado_em      timestamptz,
  solicitado_em_brt  date,
  origem             text,
  -- desfecho comercial (lista fechada). NÃO é o motivo do cancelamento: o campo
  -- de motivo é texto livre com 45% vazio e não sustenta distribuição percentual.
  -- Usar um pelo outro seria trocar causa por consequência.
  tipo_acordo        text,
  status_financeiro  text,
  ciclo              integer,
  valor_contratado   numeric,
  valor_pago         numeric,
  valor_reembolso    numeric,
  valor_multa        numeric,
  carregado_em       timestamptz not null default now()
);

-- ============================================================
-- FUNIS — card por empresa × quadro
-- ============================================================
create table if not exists marts.fact_cs_card (
  card_id             uuid primary key,
  empresa_id          uuid not null,
  quadro              text not null,
  etapa               text not null,
  etapa_ordem         integer,
  entrou_na_etapa_em  timestamptz,
  carregado_em        timestamptz not null default now()
);

create index if not exists ix_cs_card_quadro on marts.fact_cs_card (quadro, etapa_ordem);

-- Histórico de movimentação. Começa em 08/07/2026 na origem — antes disso não
-- existe. É o único caminho para "tempo em etapas já percorridas", e por isso
-- espelhar cedo importa.
create table if not exists marts.fact_cs_movimento (
  movimento_id  uuid primary key,
  empresa_id    uuid,
  de_etapa      text,
  para_etapa    text,
  acao          text,
  origem        text,
  criado_em     timestamptz not null,
  criado_em_brt date not null,
  carregado_em  timestamptz not null default now()
);

-- Cliques em link de disparo. A origem é PURGADA TODO DIA — sem espelho não
-- existe série histórica, e cada dia sem carga é um dia que não volta. Mesma
-- armadilha da navegação da plataforma, que some com mais de 30 dias.
create table if not exists marts.fact_cs_clique (
  clique_id     uuid primary key,
  disparo_id    uuid,
  criado_em     timestamptz not null,
  criado_em_brt date not null,
  carregado_em  timestamptz not null default now()
);

-- ============================================================
-- FRESCOR — a tela declara a data do dado
-- ============================================================
create or replace view marts.v_cs_frescor as
  select 'atendimento'  as tabela, max(carregado_em) as carregado_em, count(*) as linhas from marts.fact_cs_atendimento
  union all select 'disparo',      max(carregado_em), count(*) from marts.fact_cs_disparo
  union all select 'envio',        max(carregado_em), count(*) from marts.fact_cs_envio
  union all select 'cancelamento', max(carregado_em), count(*) from marts.fact_cs_cancelamento
  union all select 'card',         max(carregado_em), count(*) from marts.fact_cs_card
  union all select 'movimento',    max(carregado_em), count(*) from marts.fact_cs_movimento
  union all select 'clique',       max(carregado_em), count(*) from marts.fact_cs_clique
  union all select 'empresa',      max(carregado_em), count(*) from marts.dim_cs_empresa;

comment on view marts.v_cs_frescor is
  'Quando cada tabela de CS foi carregada. Enquanto a carga for manual, é o que permite a tela dizer a data do dado em vez de fingir que é de agora.';

-- ============================================================
-- RLS — deny-all, como no resto de marts
-- ============================================================
alter table marts.dim_cs_empresa       enable row level security;
alter table marts.fact_cs_atendimento  enable row level security;
alter table marts.fact_cs_disparo      enable row level security;
alter table marts.fact_cs_envio        enable row level security;
alter table marts.fact_cs_cancelamento enable row level security;
alter table marts.fact_cs_card         enable row level security;
alter table marts.fact_cs_movimento    enable row level security;
alter table marts.fact_cs_clique       enable row level security;
