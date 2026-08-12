-- ==========================================================================
-- CS/pulse — grupo disparos: campanhas, destinatários e avulsos em marts.*
-- ==========================================================================

-- A v_cs_frescor lê as tabelas abaixo; é recriada na migration própria dela.
drop view if exists marts.v_cs_frescor cascade;

-- O contrato bi_pulse tem 8 foreign tables e nenhuma é de cliques: a origem purga
-- clique diariamente, então esse histórico não volta nem com backfill. A tabela nasceu
-- vazia (0 linhas) e nunca teria carga — melhor sumir do que fingir que existe fonte.
drop table if exists marts.fact_cs_clique;

-- fact_cs_disparo e fact_cs_envio já existiam VAZIAS (criadas antes do FDW) e não cobrem
-- o contrato de hoje (faltam template, categoria, agendamento, template_id). Sem dado a
-- preservar, recriar é mais limpo que uma fila de ALTER.
drop table if exists marts.fact_cs_disparo;
drop table if exists marts.fact_cs_envio;

-- --------------------------------------------------------------------------
-- Campanhas (broadcast). Grão: uma campanha.
-- not null vale para chave e classificador do contrato — se a origem mandar nulo, é
-- quebra de contrato e tem que estourar em etl.sync_runs, não virar '(sem status)'.
-- Metadado descritivo (template, categoria) fica nullable.
-- --------------------------------------------------------------------------
create table marts.fact_cs_disparo (
  disparo_id           uuid        primary key,
  canal                text        not null,
  status               text        not null,   -- sent · partial · failed · cancelled · skipped
  template             text,
  template_categoria   text,                   -- 414/1.781 sem categoria na origem
  template_de_sistema  boolean     not null,
  -- Contadores da campanha são INTENÇÃO, não entrega: a campanha cancelada de 23/07/2026
  -- declarou 9.846 destinatários e entregou 4.721. Métrica de mensagem sai de fact_cs_envio.
  destinatarios        integer,
  enviados             integer,
  falhas               integer,
  ignorados            integer,
  criado_em            timestamptz not null,
  criado_em_brt        date        not null,
  agendado_para        timestamptz,
  agendado_para_brt    date,
  carregado_em         timestamptz not null default now()
);

comment on table marts.fact_cs_disparo is
  'Campanha de disparo (contrato pulse.disparos_campanhas). Os contadores são intenção declarada, não entrega — quem conta mensagem enviada é marts.fact_cs_envio.';

create index ix_cs_disparo_dia on marts.fact_cs_disparo (criado_em_brt);
alter table marts.fact_cs_disparo enable row level security;
create policy leitura_bi on marts.fact_cs_disparo for select to authenticated using (true);
grant select on marts.fact_cs_disparo to authenticated;

-- --------------------------------------------------------------------------
-- Destinatários (log 1 linha por pessoa por campanha). Maior volume: 49.472.
-- --------------------------------------------------------------------------
create table marts.fact_cs_envio (
  envio_id        uuid        primary key,
  -- Sem FK para fact_cs_disparo de propósito: os watermarks são independentes e no backfill
  -- o log pode chegar antes da campanha. Medido 0 órfãos, mas a FK derrubaria o ciclo à toa.
  disparo_id      uuid        not null,
  template_id     uuid        not null,
  canal           text        not null,
  status          text        not null,   -- sent · failed · skipped_dedup
  criado_em       timestamptz not null,
  criado_em_brt   date        not null,
  email_hash      text,
  fone_hash       text,
  -- 46.245 das 49.472 linhas trazem e-mail E fone. Contar o hash do canal contaria a mesma
  -- pessoa duas vezes (11.879 e-mails + 11.185 fones vs. 12.493 identidades). pessoa_hash
  -- fixa e-mail como identidade preferida e cai no fone só quando não há e-mail — nunca nulo
  -- (medido: zero linha sem nenhum dos dois; se aparecer, o sync estoura e a gente vê).
  pessoa_hash     text        not null,
  carregado_em    timestamptz not null default now()
);
-- teve_erro não entra: medido 7.800 = 972 failed + 6.828 skipped_dedup, ou seja, é só um
-- alias de status e ainda mente (dedup não é falha). Falha na tela = status = 'failed'.

comment on table marts.fact_cs_envio is
  'Log por destinatário de campanha (contrato pulse.disparos_destinatarios). pessoa_hash = e-mail quando existe, fone só na ausência dele: contar hash de canal contaria a mesma pessoa duas vezes.';

create index ix_cs_envio_dia     on marts.fact_cs_envio (criado_em_brt);
create index ix_cs_envio_disparo on marts.fact_cs_envio (disparo_id);
alter table marts.fact_cs_envio enable row level security;
create policy leitura_bi on marts.fact_cs_envio for select to authenticated using (true);
grant select on marts.fact_cs_envio to authenticated;

-- --------------------------------------------------------------------------
-- Avulsos (envio 1:1, fora de campanha). Série PARADA em 06/07/2026 — a origem
-- marca como decisão de negócio em aberto. O mart carrega o histórico do mesmo jeito;
-- quem declara a parada para a tela é marts.v_cs_frescor (fonte_parada).
-- 'template' (nome) não é materializado: 1.804/1.804 nulos na origem, só template_id
-- identifica. Canal também não vem no contrato (só fone_hash) e não vai ser inventado.
-- --------------------------------------------------------------------------
create table marts.fact_cs_disparo_avulso (
  envio_id       uuid        primary key,
  template_id    uuid        not null,
  status         text        not null,   -- sent · failed
  fone_hash      text        not null,
  criado_em      timestamptz not null,
  criado_em_brt  date        not null,
  carregado_em   timestamptz not null default now()
);

comment on table marts.fact_cs_disparo_avulso is
  'Envio avulso 1:1 (contrato pulse.disparos_avulsos). Série parada em 06/07/2026 na origem; quem declara a parada para a tela é marts.v_cs_frescor.fonte_parada.';

create index ix_cs_avulso_dia on marts.fact_cs_disparo_avulso (criado_em_brt);
alter table marts.fact_cs_disparo_avulso enable row level security;
create policy leitura_bi on marts.fact_cs_disparo_avulso for select to authenticated using (true);
grant select on marts.fact_cs_disparo_avulso to authenticated;
