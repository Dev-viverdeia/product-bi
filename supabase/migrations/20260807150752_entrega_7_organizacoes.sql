-- Entrega 7 — Organizações (B2B).
-- Validado na origem (2026-08-07):
--   · 2.097 orgs (1.907 ativas), team_limit médio 5, mediana de 3 membros,
--     maior org com 612 pessoas.
--   · VALOR NÃO CONSUMIDO: 636 orgs têm pool de mentoria (14.029 créditos) e
--     apenas 5 orgs usaram (7 créditos = 0,05%). Estratégicos: 54 disp, 0 usados.
--   · ⚠️ days_until_expiry é NULL em 95,9% dos masters (2.270 de 2.368).
-- Lição da E5: agregações por view, nunca subquery correlacionada.

create table marts.dim_organizacao (
  id uuid primary key,
  nome text,
  master_user_id uuid,
  plano text,
  ativa boolean,
  team_limit integer,
  pool_mentoria integer,
  pool_usado integer,
  criada_em timestamptz,
  sincronizado_em timestamptz not null default now()
);
comment on table marts.dim_organizacao is 'Catálogo de organizações (full refresh a cada sync).';
alter table marts.dim_organizacao enable row level security;
create policy "leitura_bi" on marts.dim_organizacao for select to authenticated using (true);
grant select on marts.dim_organizacao to authenticated;

create table marts.fact_credito_mentoria (
  user_id uuid primary key,
  grupo_disponivel integer not null default 0,
  grupo_usado integer not null default 0,
  grupo_ilimitado boolean,
  individual_disponivel integer not null default 0,
  individual_usado integer not null default 0,
  estrategico_disponivel integer not null default 0,
  estrategico_usado integer not null default 0,
  sincronizado_em timestamptz not null default now()
);
comment on table marts.fact_credito_mentoria is
  'Saldo de créditos de mentoria por usuário — base do "valor contratado não consumido".';
alter table marts.fact_credito_mentoria enable row level security;
create policy "leitura_bi" on marts.fact_credito_mentoria for select to authenticated using (true);
grant select on marts.fact_credito_mentoria to authenticated;

create or replace function etl.sync_organizacoes()
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_inicio timestamptz := now(); v_a integer; v_b integer;
begin
  insert into marts.dim_organizacao as d
    (id, nome, master_user_id, plano, ativa, team_limit, pool_mentoria, pool_usado, criada_em, sincronizado_em)
  select o.id, o.name, o.master_user_id,
         coalesce(sp.display_name, sp.name, o.plan_type),
         coalesce(o.is_active, false), o.team_limit,
         o.mentoria_pool_mensal, o.mentoria_pool_usado, o.created_at, now()
  from plataforma.organizations o
  left join plataforma.subscription_plans sp on sp.id = o.subscription_plan_id
  on conflict (id) do update set
    nome = excluded.nome, master_user_id = excluded.master_user_id,
    plano = excluded.plano, ativa = excluded.ativa, team_limit = excluded.team_limit,
    pool_mentoria = excluded.pool_mentoria, pool_usado = excluded.pool_usado,
    sincronizado_em = excluded.sincronizado_em;
  get diagnostics v_a = row_count;

  insert into marts.fact_credito_mentoria as d
    (user_id, grupo_disponivel, grupo_usado, grupo_ilimitado,
     individual_disponivel, individual_usado, estrategico_disponivel, estrategico_usado, sincronizado_em)
  select c.user_id,
         coalesce(c.group_credits_available, 0), coalesce(c.group_credits_used, 0),
         c.group_credits_unlimited,
         coalesce(c.individual_credits_available, 0), coalesce(c.individual_credits_used, 0),
         coalesce(c.strategic_credits_available, 0), coalesce(c.strategic_credits_used, 0),
         now()
  from plataforma.mentorship_credits c
  on conflict (user_id) do update set
    grupo_disponivel = excluded.grupo_disponivel, grupo_usado = excluded.grupo_usado,
    grupo_ilimitado = excluded.grupo_ilimitado,
    individual_disponivel = excluded.individual_disponivel,
    individual_usado = excluded.individual_usado,
    estrategico_disponivel = excluded.estrategico_disponivel,
    estrategico_usado = excluded.estrategico_usado,
    sincronizado_em = excluded.sincronizado_em;
  get diagnostics v_b = row_count;

  insert into etl.sync_state (tabela, watermark, ultima_execucao, ultimas_linhas)
  values ('organizacoes', now(), now(), v_a + v_b)
  on conflict (tabela) do update set watermark = excluded.watermark,
    ultima_execucao = excluded.ultima_execucao, ultimas_linhas = excluded.ultimas_linhas;
  insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, linhas, sucesso)
  values ('organizacoes', v_inicio, now(), v_a + v_b, true);
  return v_a + v_b;
exception when others then
  insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, sucesso, erro)
  values ('organizacoes', v_inicio, now(), false, sqlerrm);
  raise;
end; $$;

create or replace function etl.executar_sync()
returns void
language plpgsql security definer set search_path = '' as $$
begin
  begin perform etl.sync_dim_usuario(); exception when others then null; end;
  begin perform etl.sync_fact_evento(); exception when others then null; end;
  begin perform etl.sync_fact_pageview(); exception when others then null; end;
  begin perform etl.sync_master_snapshot(); exception when others then null; end;
  begin perform etl.sync_fact_progresso_solucao(); exception when others then null; end;
  begin perform etl.sync_fact_convite(); exception when others then null; end;
  begin perform etl.sync_fact_convite_envio(); exception when others then null; end;
  begin perform etl.sync_fact_onboarding(); exception when others then null; end;
  begin perform etl.sync_fact_erros(); exception when others then null; end;
  begin perform etl.sync_dim_learning(); exception when others then null; end;
  begin perform etl.sync_fact_progresso_aula(); exception when others then null; end;
  begin perform etl.sync_fact_certificado(); exception when others then null; end;
  begin perform etl.sync_fact_nps_aula(); exception when others then null; end;
  begin perform etl.sync_dim_solucao(); exception when others then null; end;
  begin perform etl.sync_fact_solucoes_apoio(); exception when others then null; end;
  begin perform etl.sync_fact_consultor(); exception when others then null; end;
  begin perform etl.sync_fact_builder(); exception when others then null; end;
  begin perform etl.sync_organizacoes(); exception when others then null; end;
end; $$;

select etl.sync_organizacoes();

create or replace view marts.v_saude_organizacao as
with membros as (
  select u.organization_id, count(*) as membros
  from marts.dim_usuario u
  where u.organization_id is not null and u.e_cliente
  group by u.organization_id
),
ativos as (
  select u.organization_id, count(distinct f.user_id) as ativos_30d
  from marts.fact_evento f
  join marts.dim_usuario u on u.user_id = f.user_id and u.e_cliente
  where u.organization_id is not null
    and f.data_brt > (now() at time zone 'America/Sao_Paulo')::date - 30
  group by u.organization_id
),
master_ativo as (
  select o.id as org_id,
         exists (
           select 1 from marts.fact_evento f
           where f.user_id = o.master_user_id
             and f.data_brt > (now() at time zone 'America/Sao_Paulo')::date - 30
         ) as master_ativo
  from marts.dim_organizacao o
  where o.master_user_id is not null
)
select
  o.id, o.nome, o.plano, o.ativa, o.team_limit,
  coalesce(m.membros, 0) as membros,
  coalesce(a.ativos_30d, 0) as ativos_30d,
  round(coalesce(a.ativos_30d, 0)::numeric / nullif(m.membros, 0), 4) as pct_time_ativo,
  round(coalesce(m.membros, 0)::numeric / nullif(o.team_limit, 0), 4) as pct_assentos_usados,
  coalesce(ma.master_ativo, false) as master_ativo,
  o.pool_mentoria, o.pool_usado
from marts.dim_organizacao o
left join membros m on m.organization_id = o.id
left join ativos a on a.organization_id = o.id
left join master_ativo ma on ma.org_id = o.id;

comment on view marts.v_saude_organizacao is
  'Saúde por organização: membros, ativos 30d, ocupação de assentos e engajamento do master.';

grant select on marts.v_saude_organizacao to authenticated;

create or replace function public.bi_orgs_kpis()
returns table (
  orgs_ativas bigint, membros_total bigint, pct_time_ativo_medio numeric,
  orgs_master_ativo numeric
)
language sql stable security invoker set search_path = '' as $$
  select
    count(*) filter (where ativa and membros > 0),
    coalesce(sum(membros) filter (where ativa), 0),
    round(avg(pct_time_ativo) filter (where ativa and membros > 0), 4),
    round(count(*) filter (where ativa and membros > 0 and master_ativo)::numeric
      / nullif(count(*) filter (where ativa and membros > 0), 0), 4)
  from marts.v_saude_organizacao;
$$;

create or replace function public.bi_orgs_risco(p_limite integer default 25)
returns table (
  organizacao text, plano text, membros bigint, ativos_30d bigint,
  pct_time_ativo numeric, master_ativo boolean, assentos_ociosos integer
)
language sql stable security invoker set search_path = '' as $$
  select nome, plano, membros, ativos_30d, pct_time_ativo, master_ativo,
         greatest(coalesce(team_limit, 0) - membros::integer, 0)
  from marts.v_saude_organizacao
  where ativa and membros >= 3
  order by pct_time_ativo asc nulls first, membros desc
  limit p_limite;
$$;

create or replace function public.bi_orgs_efeito_master()
returns table (
  grupo text, orgs bigint, membros bigint, pct_time_ativo numeric
)
language sql stable security invoker set search_path = '' as $$
  select case when master_ativo then 'Master ativo nos últimos 30d' else 'Master parado' end,
         count(*), coalesce(sum(membros), 0),
         round(avg(pct_time_ativo), 4)
  from marts.v_saude_organizacao
  where ativa and membros >= 2
  group by master_ativo
  order by master_ativo desc;
$$;

create or replace function public.bi_orgs_ocupacao()
returns table (faixa text, ordem integer, orgs bigint)
language sql stable security invoker set search_path = '' as $$
  select faixa, ordem, count(*)
  from (
    select case
      when pct_assentos_usados is null then 'Sem limite definido'
      when pct_assentos_usados < 0.5 then 'Menos de 50%'
      when pct_assentos_usados < 0.8 then '50–80%'
      when pct_assentos_usados < 1 then '80–99%'
      else 'Lotada (100%+)'
    end as faixa,
    case
      when pct_assentos_usados is null then 5
      when pct_assentos_usados < 0.5 then 1
      when pct_assentos_usados < 0.8 then 2
      when pct_assentos_usados < 1 then 3
      else 4
    end as ordem
    from marts.v_saude_organizacao
    where ativa and membros > 0
  ) s
  group by faixa, ordem
  order by ordem;
$$;

create or replace function public.bi_valor_nao_consumido()
returns table (
  item text, disponivel bigint, usado bigint, pct_uso numeric, beneficiarios bigint
)
language sql stable security invoker set search_path = '' as $$
  select * from (
    select 'Pool de mentoria das organizações'::text,
           coalesce(sum(o.pool_mentoria), 0)::bigint,
           coalesce(sum(o.pool_usado), 0)::bigint,
           round(coalesce(sum(o.pool_usado), 0)::numeric
             / nullif(sum(o.pool_mentoria), 0), 4),
           count(*) filter (where o.pool_mentoria > 0)::bigint
    from marts.dim_organizacao o where o.ativa
    union all
    select 'Créditos de mentoria individual',
           coalesce(sum(c.individual_disponivel), 0)::bigint,
           coalesce(sum(c.individual_usado), 0)::bigint,
           round(coalesce(sum(c.individual_usado), 0)::numeric
             / nullif(sum(c.individual_disponivel) + sum(c.individual_usado), 0), 4),
           count(*) filter (where c.individual_disponivel > 0)::bigint
    from marts.fact_credito_mentoria c
    union all
    select 'Créditos de mentoria estratégica',
           coalesce(sum(c.estrategico_disponivel), 0)::bigint,
           coalesce(sum(c.estrategico_usado), 0)::bigint,
           round(coalesce(sum(c.estrategico_usado), 0)::numeric
             / nullif(sum(c.estrategico_disponivel) + sum(c.estrategico_usado), 0), 4),
           count(*) filter (where c.estrategico_disponivel > 0)::bigint
    from marts.fact_credito_mentoria c
  ) t;
$$;

revoke execute on function public.bi_orgs_kpis() from public, anon;
revoke execute on function public.bi_orgs_risco(integer) from public, anon;
revoke execute on function public.bi_orgs_efeito_master() from public, anon;
revoke execute on function public.bi_orgs_ocupacao() from public, anon;
revoke execute on function public.bi_valor_nao_consumido() from public, anon;
grant execute on function public.bi_orgs_kpis() to authenticated;
grant execute on function public.bi_orgs_risco(integer) to authenticated;
grant execute on function public.bi_orgs_efeito_master() to authenticated;
grant execute on function public.bi_orgs_ocupacao() to authenticated;
grant execute on function public.bi_valor_nao_consumido() to authenticated;
