-- ============================================================
-- marts.fact_cs_atendimento — realinhado ao contrato pulse.atendimento_tickets
-- ============================================================
-- DROP/CREATE é seguro: a tabela está com 0 linhas (a carga manual prevista na
-- migration 20260811153503 nunca rodou) e passa a ser reconstruída pelo sync.
-- Nenhum histórico se perde.
--
-- Saem do mart: empresa_id, atribuicao_empresa e atendente_nome. O contrato não
-- entrega nenhum dos três, e coluna sem origem é promessa que o dado não cumpre.
-- Sai também ia_participou: colapsar modo_ia e tem_atendente_humano num booleano
-- apaga distinção real (201 tickets são 'ai' COM humano; 290 são 'human' SEM).
-- atendente_id (uuid) vira atendente_hash (text), que é o que a origem entrega.
--
-- organization_id NÃO nasce aqui: o contrato pulse.atendimento_tickets não
-- entrega a coluna. Coluna 100% nula é join que devolve zero linha sem erro.
-- Entra por `alter table add column` no dia em que o Pulse expuser.

-- marts.v_cs_frescor referencia esta tabela; cai primeiro para o drop não
-- depender da ordem de aplicação. A view é recriada na migration própria dela.
drop view if exists marts.v_cs_frescor cascade;

drop table if exists marts.fact_cs_atendimento;

create table marts.fact_cs_atendimento (
  ticket_id                        uuid primary key,
  thread_id                        uuid        not null,

  -- NASCIMENTO do ticket = created_at. É a âncora de toda série temporal e de
  -- toda duração. Medido: opened_at >= created_at sempre, mas em 517 tickets
  -- (20,7%) ele é MAIOR — até 147 dias depois. opened_at é a última reabertura,
  -- não a abertura. Ancorar duração nele produz 488 valores negativos.
  abriu_em                         timestamptz not null,
  abriu_em_brt                     date        not null,
  reaberto_em                      timestamptz not null,

  primeira_resposta_em             timestamptz,
  resolvido_em                     timestamptz,
  -- só resolvido_em ganha *_brt: closed_at coincide com resolved_at em 1.584 de
  -- 1.587 casos, então um fechado_em_brt seria coluna duplicada sem gráfico que
  -- a peça. Se a tela de throughput de fechamento aparecer, adiciona-se lá.
  resolvido_em_brt                 date,
  fechado_em                       timestamptz,

  -- Durações materializadas e SEMPRE ancoradas em abriu_em (created_at), que é a
  -- única âncora que não produz negativo. O outro corte (tempo desde a última
  -- reabertura) é uma subtração entre colunas que já estão aqui — não precisa de
  -- coluna própria.
  seg_ate_primeira_resposta        integer,
  seg_ate_resolucao                integer,

  ticket_status                    text        not null,
  prioridade                       text        not null,

  -- 'fechado_sem_marcacao' não é enfeite: 761 tickets (32,4% dos fechados) vêm
  -- com status closed e nenhuma das duas datas. Contá-los como resolvidos
  -- inflaria a taxa de resolução em ~48%. A tela declara a lacuna.
  desfecho                         text        not null
    check (desfecho in ('resolvido','encerrado_sem_resolucao',
                        'fechado_sem_marcacao','em_aberto')),

  -- ATENÇÃO: hoje as duas são constantes false (0 true, 0 nulo, em 2.502 linhas).
  -- A flag existe no contrato mas não é calculada na origem. Materializadas para
  -- o dia em que o Pulse ligar o cálculo; até lá NÃO viram KPI de SLA na tela —
  -- publicar "100% dentro do SLA" a partir de campo constante é mentira.
  sla_primeira_resposta_estourado  boolean     not null,
  sla_resolucao_estourado          boolean     not null,

  pausado                          boolean     not null,

  -- modo_ia = quem está conduzindo o ticket agora; tem_atendente_humano = houve
  -- humano em algum momento. Divergem em 491 tickets — são métricas diferentes,
  -- não misturar num gráfico. "Só IA" é tem_atendente_humano = false (437).
  modo_ia                          text,
  tem_atendente_humano             boolean     not null,
  atendente_hash                   text,

  -- No contrato, `canal` é o nome da CAIXA (inbox), não o meio de contato:
  -- 'Milagre Digital' cobre 99,8% e só há 3 valores. canal_numero é a linha da
  -- própria empresa (3 números), não telefone de cliente — não é PII.
  canal                            text,
  canal_numero                     text,

  -- hash da chave normalizada: serve para count(distinct), não identifica ninguém
  contato_hash                     text        not null,

  -- "última vez que o BI viu este ticket MUDAR" — o upsert só toca a linha quando
  -- algum valor de origem difere (ver sync). Sem esse cuidado, reler a cauda a
  -- cada 30 min marcaria 918 linhas como novas 48x/dia.
  carregado_em                     timestamptz not null default now()
);

comment on table marts.fact_cs_atendimento is
  'Ticket de atendimento do Pulse (grão = ciclo). abriu_em é created_at, não opened_at: opened_at é a última reabertura e ancorar duração nele produz valor negativo em 488 tickets. Flags de SLA são constantes false na origem — não usar como indicador.';

comment on column marts.fact_cs_atendimento.reaberto_em is
  'opened_at da origem. Maior que abriu_em em 517 tickets (20,7%), delta máximo de 147 dias. Semântica de reabertura pendente de confirmação com o time do Pulse.';

comment on column marts.fact_cs_atendimento.sla_primeira_resposta_estourado is
  'Constante false na origem em 12/08/2026 (0 true em 2.502 linhas). Não publicar como KPI antes de o Pulse confirmar que o campo é calculado.';

create index ix_cs_atendimento_dia on marts.fact_cs_atendimento (abriu_em_brt);

-- Índice a serviço do sync, não da tela: é por ele que a reconciliação de cauda
-- monta a lista de tickets que ainda podem mudar sem que nenhuma data se mexa.
-- Se o advisor apontar "índice não usado", é falso positivo — quem usa é o ETL.
create index ix_cs_atendimento_cauda on marts.fact_cs_atendimento (ticket_id)
  where ticket_status <> 'closed' or fechado_em is null;

alter table marts.fact_cs_atendimento enable row level security;
grant select on marts.fact_cs_atendimento to authenticated;
create policy leitura_bi on marts.fact_cs_atendimento
  for select to authenticated using (true);
