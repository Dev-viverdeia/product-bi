-- Entrega 2b — Clientes & Retenção (acionável).
-- Contrato (docs/roadmap-bi.md):
--   em risco            = ativo nos 60d anteriores, zero atividade nos últimos 14d
--   churn comportamental = 60d corridos sem nenhuma atividade (tendo tido alguma)
--   aha                 = ações nos primeiros 7d → retenção em [90,120) da entrada
-- Régua: somente fact_evento (estável desde mai/2025).

-- ============ MART: snapshot de masters (plano/vencimento) ============
-- Espelho local do master_user_snapshots da plataforma (cron de 15min lá).
create table if not exists marts.master_snapshot (
  master_user_id uuid primary key,
  organization_id uuid,
  organizacao text,
  plano text,
  team_count integer,
  plan_expires_at timestamptz,
  days_until_expiry integer,
  last_interaction_at timestamptz,
  snapshot_em timestamptz,
  sincronizado_em timestamptz not null default now()
);

comment on table marts.master_snapshot is
  'Espelho de master_user_snapshots (full refresh a cada sync) — vencimento de plano e time por master.';

alter table marts.master_snapshot enable row level security;
drop policy if exists "leitura_bi" on marts.master_snapshot;
create policy "leitura_bi" on marts.master_snapshot for select to authenticated using (true);
grant select on marts.master_snapshot to authenticated;

create or replace function etl.sync_master_snapshot()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inicio timestamptz := now();
  v_n integer;
begin
  delete from marts.master_snapshot;
  insert into marts.master_snapshot (
    master_user_id, organization_id, organizacao, plano, team_count,
    plan_expires_at, days_until_expiry, last_interaction_at, snapshot_em
  )
  select master_user_id, organization_id, organization_name,
         coalesce(plan_display_name, plan_name), org_team_count,
         plan_expires_at, days_until_expiry, last_interaction_at, snapshot_at
  from plataforma.master_user_snapshots;

  get diagnostics v_n = row_count;

  insert into etl.sync_state (tabela, watermark, ultima_execucao, ultimas_linhas)
  values ('master_snapshot', now(), now(), v_n)
  on conflict (tabela) do update
    set watermark = excluded.watermark,
        ultima_execucao = excluded.ultima_execucao,
        ultimas_linhas = excluded.ultimas_linhas;

  insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, linhas, sucesso)
  values ('master_snapshot', v_inicio, now(), v_n, true);
  return v_n;
exception when others then
  insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, sucesso, erro)
  values ('master_snapshot', v_inicio, now(), false, sqlerrm);
  raise;
end;
$$;

create or replace function etl.executar_sync()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    perform etl.sync_dim_usuario();
  exception when others then null;
  end;
  begin
    perform etl.sync_fact_evento();
  exception when others then null;
  end;
  begin
    perform etl.sync_fact_pageview();
  exception when others then null;
  end;
  begin
    perform etl.sync_master_snapshot();
  exception when others then null;
  end;
end;
$$;

-- carga inicial
select etl.sync_master_snapshot();

-- ============ CLIENTES EM RISCO (lista nominal) ============
create or replace function public.bi_clientes_em_risco(p_limite integer default 30)
returns table (
  nome text, email text, organizacao text, plano text, motivo text,
  ultima_atividade date, dias_inativo integer, dias_ate_vencer integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  with hoje as (select (now() at time zone 'America/Sao_Paulo')::date d),
  ult as (
    select f.user_id, max(f.data_brt) as ultima
    from marts.fact_evento f
    group by f.user_id
  ),
  -- silêncio recente: ativo nos 60d anteriores ao corte de 14d
  inatividade as (
    select u.nome, u.email, u.organizacao,
           coalesce(u.plano_display, u.plano) as plano,
           'inatividade'::text as motivo,
           l.ultima as ultima_atividade,
           (h.d - l.ultima)::integer as dias_inativo,
           null::integer as dias_ate_vencer
    from marts.dim_usuario u
    join ult l on l.user_id = u.user_id
    cross join hoje h
    where u.e_cliente
      and l.ultima < h.d - 14
      and l.ultima >= h.d - 74
  ),
  -- plano vencendo em ≤30d com pouco uso recente (master sem atividade há 7+d)
  vencimento as (
    select u.nome as nome, u.email as email,
           coalesce(s.organizacao, u.organizacao) as organizacao,
           coalesce(s.plano, u.plano_display, u.plano) as plano,
           'plano_vencendo'::text as motivo,
           l.ultima as ultima_atividade,
           (h.d - l.ultima)::integer as dias_inativo,
           s.days_until_expiry as dias_ate_vencer
    from marts.master_snapshot s
    join marts.dim_usuario u on u.user_id = s.master_user_id and u.e_cliente
    left join ult l on l.user_id = s.master_user_id
    cross join hoje h
    where s.days_until_expiry between 0 and 30
      and (l.ultima is null or l.ultima < h.d - 7)
  )
  select * from (
    select * from vencimento
    union all
    select * from inatividade
  ) r
  order by case r.motivo when 'plano_vencendo' then 0 else 1 end,
           r.dias_ate_vencer nulls last,
           r.dias_inativo desc
  limit p_limite;
$$;

-- ============ MOMENTO "AHA" ============
-- Correlação (não causalidade): ação nos primeiros 7d × retenção em [90,120).
create or replace function public.bi_aha_moment()
returns table (
  acao text, fizeram bigint, ret_fizeram numeric,
  nao_fizeram bigint, ret_nao_fizeram numeric, lift numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  with hoje as (select (now() at time zone 'America/Sao_Paulo')::date d),
  base as (
    select u.user_id,
           (u.criado_em at time zone 'America/Sao_Paulo')::date as entrada
    from marts.dim_usuario u, hoje h
    where u.e_cliente
      and u.cohort_mes >= date '2025-05-01'
      and (u.criado_em at time zone 'America/Sao_Paulo')::date <= h.d - 120
  ),
  acoes7 as (
    select distinct b.user_id, f.tipo
    from base b
    join marts.fact_evento f on f.user_id = b.user_id
      and f.data_brt >= b.entrada and f.data_brt < b.entrada + 7
  ),
  ret as (
    select b.user_id,
           exists (select 1 from marts.fact_evento f
                   where f.user_id = b.user_id
                     and f.data_brt >= b.entrada + 90 and f.data_brt < b.entrada + 120) as retido
    from base b
  ),
  tipos as (select distinct tipo from acoes7)
  select
    t.tipo,
    count(*) filter (where a.user_id is not null) as fizeram,
    round(avg(r.retido::int::numeric) filter (where a.user_id is not null), 4) as ret_fizeram,
    count(*) filter (where a.user_id is null) as nao_fizeram,
    round(avg(r.retido::int::numeric) filter (where a.user_id is null), 4) as ret_nao_fizeram,
    round(
      avg(r.retido::int::numeric) filter (where a.user_id is not null)
      / nullif(avg(r.retido::int::numeric) filter (where a.user_id is null), 0), 2) as lift
  from tipos t
  cross join base b
  join ret r on r.user_id = b.user_id
  left join acoes7 a on a.user_id = b.user_id and a.tipo = t.tipo
  group by t.tipo
  having count(*) filter (where a.user_id is not null) >= 50
  order by 6 desc nulls last;
$$;

-- ============ AUTÓPSIA DE CHURN ============
create or replace function public.bi_churn_resumo()
returns table (
  churned bigint, ativos bigint, pct_churn numeric, vida_media_dias numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  with hoje as (select (now() at time zone 'America/Sao_Paulo')::date d),
  vida as (
    select f.user_id, min(f.data_brt) as primeira, max(f.data_brt) as ultima
    from marts.fact_evento f
    join marts.dim_usuario u on u.user_id = f.user_id and u.e_cliente
    group by f.user_id
  )
  select
    count(*) filter (where v.ultima < h.d - 60),
    count(*) filter (where v.ultima >= h.d - 60),
    round(count(*) filter (where v.ultima < h.d - 60)::numeric / nullif(count(*), 0), 4),
    round(avg(v.ultima - v.primeira) filter (where v.ultima < h.d - 60), 1)
  from vida v, hoje h;
$$;

create or replace function public.bi_churn_modulos()
returns table (
  modulo text, pct_churned_nunca_usou numeric, pct_ativos_nunca_usou numeric, gap_pp numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  with hoje as (select (now() at time zone 'America/Sao_Paulo')::date d),
  vida as (
    select f.user_id, max(f.data_brt) as ultima
    from marts.fact_evento f
    join marts.dim_usuario u on u.user_id = f.user_id and u.e_cliente
    group by f.user_id
  ),
  grupos as (
    select v.user_id, (v.ultima < h.d - 60) as churned from vida v, hoje h
  ),
  modulos as (
    select unnest(array['Formações','Soluções','Consultor','Builder','Comunidade','Networking','Mentoria']) as modulo
  ),
  usou as (
    select distinct f.user_id, marts.modulo_do_evento(f.tipo) as modulo
    from marts.fact_evento f
  )
  select
    m.modulo,
    round(1 - count(u.user_id) filter (where g.churned)::numeric
      / nullif(count(*) filter (where g.churned), 0), 4),
    round(1 - count(u.user_id) filter (where not g.churned)::numeric
      / nullif(count(*) filter (where not g.churned), 0), 4),
    round((
      (1 - count(u.user_id) filter (where g.churned)::numeric
        / nullif(count(*) filter (where g.churned), 0))
      - (1 - count(u.user_id) filter (where not g.churned)::numeric
        / nullif(count(*) filter (where not g.churned), 0))
    ) * 100, 1)
  from modulos m
  cross join grupos g
  left join usou u on u.user_id = g.user_id and u.modulo = m.modulo
  group by m.modulo
  order by 4 desc;
$$;

create or replace function public.bi_churn_ultimo_modulo()
returns table (modulo text, clientes bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  with hoje as (select (now() at time zone 'America/Sao_Paulo')::date d),
  vida as (
    select f.user_id, max(f.data_brt) as ultima
    from marts.fact_evento f
    join marts.dim_usuario u on u.user_id = f.user_id and u.e_cliente
    group by f.user_id
  ),
  churned as (select v.user_id, v.ultima from vida v, hoje h where v.ultima < h.d - 60),
  ultimo as (
    select c.user_id,
           (array_agg(marts.modulo_do_evento(f.tipo) order by f.criado_em desc))[1] as modulo
    from churned c
    join marts.fact_evento f on f.user_id = c.user_id and f.data_brt = c.ultima
    group by c.user_id
  )
  select modulo, count(*) from ultimo group by 1 order by 2 desc;
$$;

revoke execute on function public.bi_clientes_em_risco(integer) from public, anon;
revoke execute on function public.bi_aha_moment() from public, anon;
revoke execute on function public.bi_churn_resumo() from public, anon;
revoke execute on function public.bi_churn_modulos() from public, anon;
revoke execute on function public.bi_churn_ultimo_modulo() from public, anon;
grant execute on function public.bi_clientes_em_risco(integer) to authenticated;
grant execute on function public.bi_aha_moment() to authenticated;
grant execute on function public.bi_churn_resumo() to authenticated;
grant execute on function public.bi_churn_modulos() to authenticated;
grant execute on function public.bi_churn_ultimo_modulo() to authenticated;
