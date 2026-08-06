-- Entrega 2a — Clientes & Retenção (descritiva).
-- Contrato de métricas (docs/roadmap-bi.md):
--   ativo (dia)      = cliente e_cliente com ≥1 evento de domínio no dia
--   retido em Xd     = ativo em algum dia na janela [X, X+30d) após a entrada
--   hábito semanal   = atividade em ≥3 das últimas 4 semanas (28d fixos)
-- Régua: retenção usa SOMENTE fact_evento (estável desde mai/2025) — nunca
-- pageviews (jul/2026+), para o degrau de instrumentação não contaminar curvas.

-- Classificador de módulo a partir do tipo de evento (reusado por várias RPCs)
create or replace function marts.modulo_do_evento(p_tipo text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_tipo like 'lesson%' or p_tipo like 'certificate%' then 'Formações'
    when p_tipo like 'solution%' then 'Soluções'
    when p_tipo like 'consultor%' then 'Consultor'
    when p_tipo like 'builder%' then 'Builder'
    when p_tipo like 'community%' then 'Comunidade'
    when p_tipo like 'connection%' then 'Networking'
    when p_tipo like 'mentorship%' then 'Mentoria'
    else 'Outros'
  end;
$$;

grant execute on function marts.modulo_do_evento(text) to authenticated;

-- ============ RETENÇÃO POR COHORT ============
-- Cohorts a partir de mai/2025 (início do histórico de eventos). Janela só
-- conta quando completa (senão NULL — evita "queda" falsa em cohorts novas).
create or replace function public.bi_retencao_cohort()
returns table (
  cohort_mes date, clientes bigint,
  ret_7d numeric, ret_30d numeric, ret_90d numeric, ret_180d numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  with hoje as (select (now() at time zone 'America/Sao_Paulo')::date d),
  base as (
    select u.user_id,
           (u.criado_em at time zone 'America/Sao_Paulo')::date as entrada,
           u.cohort_mes
    from marts.dim_usuario u
    where u.e_cliente and u.cohort_mes >= date '2025-05-01'
  )
  select
    b.cohort_mes,
    count(*) as clientes,
    round(avg(case when b.entrada + 37 <= h.d then
      (exists (select 1 from marts.fact_evento e
               where e.user_id = b.user_id
                 and e.data_brt >= b.entrada + 7 and e.data_brt < b.entrada + 37))::int::numeric
      end), 4) as ret_7d,
    round(avg(case when b.entrada + 60 <= h.d then
      (exists (select 1 from marts.fact_evento e
               where e.user_id = b.user_id
                 and e.data_brt >= b.entrada + 30 and e.data_brt < b.entrada + 60))::int::numeric
      end), 4) as ret_30d,
    round(avg(case when b.entrada + 120 <= h.d then
      (exists (select 1 from marts.fact_evento e
               where e.user_id = b.user_id
                 and e.data_brt >= b.entrada + 90 and e.data_brt < b.entrada + 120))::int::numeric
      end), 4) as ret_90d,
    round(avg(case when b.entrada + 210 <= h.d then
      (exists (select 1 from marts.fact_evento e
               where e.user_id = b.user_id
                 and e.data_brt >= b.entrada + 180 and e.data_brt < b.entrada + 210))::int::numeric
      end), 4) as ret_180d
  from base b, hoje h
  group by b.cohort_mes
  order by b.cohort_mes desc;
$$;

-- ============ KPIs DE ENGAJAMENTO ============
create or replace function public.bi_engajamento_clientes(p_dias integer default 30)
returns table (
  mau bigint,
  dau_medio numeric,
  stickiness numeric,
  pct_habito_semanal numeric,
  dias_ativos_medio numeric,
  pct_multimodulo numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  with hoje as (select (now() at time zone 'America/Sao_Paulo')::date d),
  atv as (
    select f.user_id, f.data_brt, f.tipo
    from marts.fact_evento f
    join marts.dim_usuario u on u.user_id = f.user_id and u.e_cliente, hoje h
    where f.data_brt > h.d - p_dias
  ),
  por_usuario as (
    select user_id,
           count(distinct data_brt) as dias_ativos,
           count(distinct marts.modulo_do_evento(tipo)) as modulos
    from atv group by user_id
  ),
  por_dia as (
    select data_brt, count(distinct user_id) as dau from atv group by data_brt
  ),
  -- hábito: janela fixa de 28 dias, semanas de 7 dias contadas do dia atual
  habito as (
    select f.user_id, count(distinct ((h.d - 1 - f.data_brt) / 7)) as semanas
    from marts.fact_evento f
    join marts.dim_usuario u on u.user_id = f.user_id and u.e_cliente, hoje h
    where f.data_brt > h.d - 28 and f.data_brt <= h.d
    group by f.user_id
  )
  select
    (select count(*) from por_usuario),
    round((select avg(dau) from por_dia), 1),
    round((select avg(dau) from por_dia) / nullif((select count(*) from por_usuario), 0), 4),
    round((select count(*) filter (where semanas >= 3) from habito)::numeric
      / nullif((select count(*) from habito), 0), 4),
    round((select avg(dias_ativos) from por_usuario), 1),
    round((select count(*) filter (where modulos >= 2) from por_usuario)::numeric
      / nullif((select count(*) from por_usuario), 0), 4);
$$;

-- ============ DISTRIBUIÇÃO DE DIAS ATIVOS ============
create or replace function public.bi_dias_ativos_distribuicao(p_dias integer default 30)
returns table (faixa text, ordem integer, clientes bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  with atv as (
    select f.user_id, count(distinct f.data_brt) as dias
    from marts.fact_evento f
    join marts.dim_usuario u on u.user_id = f.user_id and u.e_cliente
    where f.data_brt > (now() at time zone 'America/Sao_Paulo')::date - p_dias
    group by f.user_id
  )
  select faixa, ordem, count(*) as clientes
  from (
    select case
      when dias <= 2 then '1–2 dias'
      when dias <= 5 then '3–5 dias'
      when dias <= 10 then '6–10 dias'
      when dias <= 20 then '11–20 dias'
      else '21+ dias'
    end as faixa,
    case
      when dias <= 2 then 1 when dias <= 5 then 2 when dias <= 10 then 3
      when dias <= 20 then 4 else 5
    end as ordem
    from atv
  ) s
  group by faixa, ordem
  order by ordem;
$$;

-- ============ AMPLITUDE DE MÓDULOS ============
create or replace function public.bi_amplitude_modulos(p_dias integer default 30)
returns table (modulos integer, clientes bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  with atv as (
    select f.user_id, count(distinct marts.modulo_do_evento(f.tipo)) as modulos
    from marts.fact_evento f
    join marts.dim_usuario u on u.user_id = f.user_id and u.e_cliente
    where f.data_brt > (now() at time zone 'America/Sao_Paulo')::date - p_dias
    group by f.user_id
  )
  select modulos::integer, count(*) from atv group by 1 order by 1;
$$;

-- ============ RETENÇÃO POR AMPLITUDE (hipótese multi-módulo) ============
-- Clientes com 1ª atividade há ≥120d: módulos usados nos primeiros 30 dias de
-- vida × % ainda ativos nos últimos 30 dias.
create or replace function public.bi_retencao_por_amplitude()
returns table (modulos integer, clientes bigint, pct_retidos numeric)
language sql
stable
security invoker
set search_path = ''
as $$
  with hoje as (select (now() at time zone 'America/Sao_Paulo')::date d),
  primeira as (
    select f.user_id, min(f.data_brt) as inicio
    from marts.fact_evento f
    join marts.dim_usuario u on u.user_id = f.user_id and u.e_cliente
    group by f.user_id
  ),
  elegiveis as (
    select p.user_id, p.inicio from primeira p, hoje h where p.inicio <= h.d - 120
  ),
  amplitude_inicial as (
    select e.user_id,
           count(distinct marts.modulo_do_evento(f.tipo)) as modulos
    from elegiveis e
    join marts.fact_evento f on f.user_id = e.user_id
      and f.data_brt >= e.inicio and f.data_brt < e.inicio + 30
    group by e.user_id
  ),
  retido as (
    select e.user_id,
           exists (select 1 from marts.fact_evento f, hoje h
                   where f.user_id = e.user_id and f.data_brt > h.d - 30) as ativo
    from elegiveis e
  )
  select a.modulos::integer, count(*) as clientes,
         round(avg(r.ativo::int::numeric), 4) as pct_retidos
  from amplitude_inicial a
  join retido r on r.user_id = a.user_id
  group by a.modulos
  order by a.modulos;
$$;

-- ============ POWER USERS ============
create or replace function public.bi_power_users(p_dias integer default 30, p_limite integer default 15)
returns table (
  nome text, email text, organizacao text, plano text,
  dias_ativos bigint, eventos bigint, modulos bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select u.nome, u.email, u.organizacao, coalesce(u.plano_display, u.plano),
         count(distinct f.data_brt) as dias_ativos,
         count(*) as eventos,
         count(distinct marts.modulo_do_evento(f.tipo)) as modulos
  from marts.fact_evento f
  join marts.dim_usuario u on u.user_id = f.user_id and u.e_cliente
  where f.data_brt > (now() at time zone 'America/Sao_Paulo')::date - p_dias
  group by u.user_id, u.nome, u.email, u.organizacao, u.plano_display, u.plano
  order by count(distinct f.data_brt) desc, count(*) desc
  limit p_limite;
$$;

revoke execute on function public.bi_retencao_cohort() from public, anon;
revoke execute on function public.bi_engajamento_clientes(integer) from public, anon;
revoke execute on function public.bi_dias_ativos_distribuicao(integer) from public, anon;
revoke execute on function public.bi_amplitude_modulos(integer) from public, anon;
revoke execute on function public.bi_retencao_por_amplitude() from public, anon;
revoke execute on function public.bi_power_users(integer, integer) from public, anon;
grant execute on function public.bi_retencao_cohort() to authenticated;
grant execute on function public.bi_engajamento_clientes(integer) to authenticated;
grant execute on function public.bi_dias_ativos_distribuicao(integer) to authenticated;
grant execute on function public.bi_amplitude_modulos(integer) to authenticated;
grant execute on function public.bi_retencao_por_amplitude() to authenticated;
grant execute on function public.bi_power_users(integer, integer) to authenticated;
