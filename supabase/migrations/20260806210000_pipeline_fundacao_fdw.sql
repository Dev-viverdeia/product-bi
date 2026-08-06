-- Fundação do pipeline de dados: FDW → plataforma, schemas e controle de ETL.
-- Decisão registrada em docs/discovery-banco-plataforma.md: o BI consome
-- exclusivamente o banco da plataforma (product_viverdeia_platform).

create extension if not exists postgres_fdw with schema extensions;
create extension if not exists pg_cron;

-- plataforma: foreign tables espelhando a produção (somente leitura)
-- marts: tabelas analíticas dim/fact consumidas pelo app
-- etl: watermarks e log de execuções
create schema if not exists plataforma;
create schema if not exists marts;
create schema if not exists etl;

comment on schema plataforma is 'Foreign tables (postgres_fdw) do banco da plataforma Viver de IA — somente leitura';
comment on schema marts is 'Tabelas analíticas (dim/fact) do BI';
comment on schema etl is 'Controle do pipeline: watermarks e log de execuções';

-- Nenhum desses schemas entra na API REST; o app lerá os marts por
-- views/policies criadas junto com cada módulo.
revoke all on schema plataforma from anon, authenticated;
revoke all on schema marts from anon, authenticated;
revoke all on schema etl from anon, authenticated;

-- Servidor FDW → produção da plataforma (mesma região sa-east-1).
-- O user mapping (credencial) é criado manualmente no SQL editor, fora de
-- migration, para a senha nunca tocar o repositório.
create server plataforma_srv
  foreign data wrapper postgres_fdw
  options (host 'db.zotzvtepvpnkcoobdubt.supabase.co', port '5432', dbname 'postgres', fetch_size '10000');

comment on server plataforma_srv is
  'Banco de produção da plataforma Viver de IA (product_viverdeia_platform, sa-east-1). Conexão como role postgres (dono das tabelas — leitura íntegra sob RLS). Credencial só no user mapping, criado manualmente.';

-- Controle de sincronização
create table etl.sync_state (
  tabela text primary key,
  watermark timestamptz,
  ultima_execucao timestamptz,
  ultimas_linhas integer,
  observacao text
);

comment on table etl.sync_state is 'Watermark incremental por tabela sincronizada da plataforma.';

create table etl.sync_runs (
  id bigint generated always as identity primary key,
  tabela text not null,
  iniciado_em timestamptz not null default now(),
  finalizado_em timestamptz,
  linhas integer,
  sucesso boolean,
  erro text
);

comment on table etl.sync_runs is 'Log de cada execução do pipeline (auditoria e alerta de falha).';

create index sync_runs_tabela_iniciado_idx on etl.sync_runs (tabela, iniciado_em desc);

-- Defesa em profundidade: RLS ligada mesmo fora da API (regra do projeto).
alter table etl.sync_state enable row level security;
alter table etl.sync_runs enable row level security;
