-- Marts do módulo âncora (Visão geral: usuários & atividade) + ETL incremental.
-- Regra "quem é cliente" herdada da view bi_cohort_base da plataforma.
-- Timezone de análise: America/Sao_Paulo (pré-computada em colunas *_brt).

-- ============ MARTS ============

create table marts.dim_usuario (
  user_id uuid primary key,
  nome text,
  email text,
  papel text,
  status text,
  is_ativo boolean,
  is_master boolean,
  organization_id uuid,
  organizacao text,
  plano text,
  plano_display text,
  plan_version text,
  onboarding_concluido boolean,
  criado_em timestamptz,
  ultimo_acesso timestamptz,
  e_cliente boolean not null default false,
  cohort_mes date,
  sincronizado_em timestamptz not null default now()
);

comment on table marts.dim_usuario is
  'Dimensão usuário (full refresh a cada sync). e_cliente aplica a regra bi_cohort_base da plataforma: exclui admin/sales_team/convidado/freemium e e-mails internos/teste.';

create index dim_usuario_e_cliente_idx on marts.dim_usuario (e_cliente) where e_cliente;
create index dim_usuario_org_idx on marts.dim_usuario (organization_id);

create table marts.fact_evento (
  id uuid primary key,
  user_id uuid,
  tipo text not null,
  dados jsonb,
  criado_em timestamptz not null,
  data_brt date not null,
  hora_brt smallint not null,
  dia_semana_brt smallint not null -- 0 = domingo … 6 = sábado
);

comment on table marts.fact_evento is
  'Eventos de produto (espelho incremental de user_activity_tracking). Colunas *_brt pré-computadas em America/Sao_Paulo para heatmaps de pico.';

create index fact_evento_data_idx on marts.fact_evento (data_brt);
create index fact_evento_tipo_data_idx on marts.fact_evento (tipo, data_brt);
create index fact_evento_usuario_data_idx on marts.fact_evento (user_id, data_brt);

alter table marts.dim_usuario enable row level security;
alter table marts.fact_evento enable row level security;

-- ============ ETL ============

create or replace function etl.sync_dim_usuario()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inicio timestamptz := now();
  v_n integer;
begin
  insert into marts.dim_usuario as d (
    user_id, nome, email, papel, status, is_ativo, is_master, organization_id,
    organizacao, plano, plano_display, plan_version, onboarding_concluido,
    criado_em, ultimo_acesso, e_cliente, cohort_mes, sincronizado_em
  )
  select
    p.id, p.name, p.email, p.role, p.status,
    coalesce(p.is_active, true),
    coalesce(p.is_master_user, false),
    p.organization_id, o.name,
    sp.name, sp.display_name, p.plan_version,
    coalesce(p.onboarding_completed, false),
    p.created_at, p.last_active,
    coalesce(
      coalesce(p.role, '') not in ('admin','sales_team','convidado','freemium')
        and p.email not ilike '%viverdeia.ai%'
        and p.email not ilike '%teste%',
      false
    ),
    (date_trunc('month', p.created_at at time zone 'America/Sao_Paulo'))::date,
    now()
  from plataforma.profiles p
  left join plataforma.subscription_plans sp on sp.id = p.subscription_plan_id
  left join plataforma.organizations o on o.id = p.organization_id
  on conflict (user_id) do update set
    nome = excluded.nome,
    email = excluded.email,
    papel = excluded.papel,
    status = excluded.status,
    is_ativo = excluded.is_ativo,
    is_master = excluded.is_master,
    organization_id = excluded.organization_id,
    organizacao = excluded.organizacao,
    plano = excluded.plano,
    plano_display = excluded.plano_display,
    plan_version = excluded.plan_version,
    onboarding_concluido = excluded.onboarding_concluido,
    criado_em = excluded.criado_em,
    ultimo_acesso = excluded.ultimo_acesso,
    e_cliente = excluded.e_cliente,
    cohort_mes = excluded.cohort_mes,
    sincronizado_em = excluded.sincronizado_em;

  get diagnostics v_n = row_count;

  insert into etl.sync_state (tabela, watermark, ultima_execucao, ultimas_linhas)
  values ('dim_usuario', now(), now(), v_n)
  on conflict (tabela) do update
    set watermark = excluded.watermark,
        ultima_execucao = excluded.ultima_execucao,
        ultimas_linhas = excluded.ultimas_linhas;

  insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, linhas, sucesso)
  values ('dim_usuario', v_inicio, now(), v_n, true);

  return v_n;
exception when others then
  insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, sucesso, erro)
  values ('dim_usuario', v_inicio, now(), false, sqlerrm);
  raise;
end;
$$;

comment on function etl.sync_dim_usuario is 'Full refresh da dimensão usuário (~15k linhas).';

create or replace function etl.sync_fact_evento(p_max_dias integer default 45)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inicio timestamptz := now();
  v_wm timestamptz;
  v_ate timestamptz;
  v_n integer;
begin
  select watermark into v_wm from etl.sync_state where tabela = 'fact_evento';
  if v_wm is null then
    v_wm := timestamptz '2025-01-01 00:00:00-03';
  end if;

  -- Avança no máximo p_max_dias por execução (backfill em fatias controladas;
  -- margem de 1 min protege contra relógio/commits em andamento na origem).
  v_ate := least(v_wm + make_interval(days => p_max_dias), now() - interval '1 minute');
  if v_ate <= v_wm then
    insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, linhas, sucesso)
    values ('fact_evento', v_inicio, now(), 0, true);
    return 0;
  end if;

  insert into marts.fact_evento (id, user_id, tipo, dados, criado_em, data_brt, hora_brt, dia_semana_brt)
  select
    t.id, t.user_id, t.activity_type, t.activity_data, t.created_at,
    (t.created_at at time zone 'America/Sao_Paulo')::date,
    extract(hour from t.created_at at time zone 'America/Sao_Paulo')::smallint,
    extract(dow from t.created_at at time zone 'America/Sao_Paulo')::smallint
  from plataforma.user_activity_tracking t
  where t.created_at > v_wm and t.created_at <= v_ate
  on conflict (id) do nothing;

  get diagnostics v_n = row_count;

  insert into etl.sync_state (tabela, watermark, ultima_execucao, ultimas_linhas)
  values ('fact_evento', v_ate, now(), v_n)
  on conflict (tabela) do update
    set watermark = excluded.watermark,
        ultima_execucao = excluded.ultima_execucao,
        ultimas_linhas = excluded.ultimas_linhas;

  insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, linhas, sucesso)
  values ('fact_evento', v_inicio, now(), v_n, true);

  return v_n;
exception when others then
  insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, sucesso, erro)
  values ('fact_evento', v_inicio, now(), false, sqlerrm);
  raise;
end;
$$;

comment on function etl.sync_fact_evento is
  'Sync incremental de eventos por watermark; avança no máximo p_max_dias por chamada.';

create or replace function etl.executar_sync()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Falha de um passo não bloqueia o outro; erros ficam em etl.sync_runs.
  begin
    perform etl.sync_dim_usuario();
  exception when others then null;
  end;
  begin
    perform etl.sync_fact_evento();
  exception when others then null;
  end;
end;
$$;

comment on function etl.executar_sync is 'Entrada única do pipeline — chamada pelo pg_cron.';

revoke execute on function etl.sync_dim_usuario() from public, anon, authenticated;
revoke execute on function etl.sync_fact_evento(integer) from public, anon, authenticated;
revoke execute on function etl.executar_sync() from public, anon, authenticated;

-- ============ AGENDAMENTO ============
-- cron.schedule com mesmo nome é upsert (idempotente em replay).
select cron.schedule('bi_sync_plataforma', '*/30 * * * *', 'select etl.executar_sync()');
