-- Correção de desempenho da Fase 0, e a conclusão da âncora nas duas telas
-- piloto (Visão Geral e Clientes & Retenção).
--
-- Dois defeitos, um deles meu:
--
-- 1. `marts.data_referencia()` num WHERE é avaliada UMA VEZ POR LINHA. A função
--    é `stable`, o que garante consistência mas não memoriza — então o filtro
--    de dim_usuario chamava a função 14.848 vezes, cada uma fazendo seu próprio
--    scan de índice. Medido: 58 mil buffers só para descobrir uma data.
--    Correção: `hoje as materialized` (ou subconsulta escalar), que vira
--    InitPlan e roda uma vez por consulta.
--
-- 2. CTE referenciada uma única vez é INLINE por padrão desde o PG12, e quando
--    o corpo tem subconsulta correlacionada dentro de um cross join ela é
--    reavaliada por linha do produto cartesiano. Era o que derrubava
--    bi_aha_moment e bi_churn_modulos: as duas estouravam o timeout de 8s do
--    PostgREST e devolviam 500 na tela de Clientes — dois cards em erro, em
--    produção. Medido em bi_aha_moment: 4.470ms → 534ms com `as materialized`.
--
-- Aproveita para terminar a âncora nas duas telas piloto: com metade das
-- funções em now() e metade no dado, os cards da mesma tela discordariam entre
-- si. As outras sete telas seguem em now() como dívida declarada no CLAUDE.md.

-- ============ VISÃO GERAL ============

create or replace function public.bi_atividade_diaria(
  p_dias integer default 30, p_papel text default null, p_plano text default null)
returns table(data date, ativos bigint)
language sql stable set search_path to ''
as $$
  with hoje as materialized (select marts.data_referencia() d),
  clientes as (
    select u.user_id from marts.dim_usuario u
    where u.e_cliente
      and (p_papel is null or u.papel = p_papel)
      and (p_plano is null or coalesce(u.plano, 'sem_plano') = p_plano)
  )
  select f.data_brt, count(distinct f.user_id)
  from marts.fact_evento f
  join clientes c on c.user_id = f.user_id, hoje
  where f.data_brt > hoje.d - p_dias
  group by f.data_brt
  order by f.data_brt;
$$;

create or replace function public.bi_eventos_por_tipo(
  p_dias integer default 30, p_papel text default null, p_plano text default null)
returns table(tipo text, eventos bigint)
language sql stable set search_path to ''
as $$
  select f.tipo, count(*)
  from marts.fact_evento f
  join marts.dim_usuario u on u.user_id = f.user_id and u.e_cliente
    and (p_papel is null or u.papel = p_papel)
    and (p_plano is null or coalesce(u.plano, 'sem_plano') = p_plano)
  where f.data_brt > (select marts.data_referencia()) - p_dias
  group by 1
  order by 2 desc;
$$;

create or replace function public.bi_heatmap_navegacao(
  p_dias integer default 30, p_papel text default null, p_plano text default null)
returns table(dia_semana smallint, hora smallint, pageviews bigint)
language sql stable set search_path to ''
as $$
  select p.dia_semana_brt, p.hora_brt, count(*)
  from marts.fact_pageview p
  join marts.dim_usuario u on u.user_id = p.user_id and u.e_cliente
    and (p_papel is null or u.papel = p_papel)
    and (p_plano is null or coalesce(u.plano, 'sem_plano') = p_plano)
  where p.data_brt > (select marts.data_referencia()) - p_dias
  group by 1, 2;
$$;

create or replace function public.bi_top_telas(
  p_dias integer default 30, p_limite integer default 10,
  p_papel text default null, p_plano text default null)
returns table(path text, views bigint, usuarios bigint)
language sql stable set search_path to ''
as $$
  select p.path, count(*), count(distinct p.user_id)
  from marts.fact_pageview p
  join marts.dim_usuario u on u.user_id = p.user_id and u.e_cliente
    and (p_papel is null or u.papel = p_papel)
    and (p_plano is null or coalesce(u.plano, 'sem_plano') = p_plano)
  where p.data_brt > (select marts.data_referencia()) - p_dias
  group by 1
  order by 2 desc
  limit p_limite;
$$;

create or replace function public.bi_visao_geral_kpis(
  p_dias integer default 30, p_papel text default null, p_plano text default null)
returns table(
  ativos bigint, ativos_ant bigint, novos bigint, novos_ant bigint,
  aulas bigint, aulas_ant bigint, pageviews bigint, pageviews_ant bigint)
language sql stable set search_path to ''
as $$
  with hoje as materialized (select marts.data_referencia() d),
  clientes as (
    select u.user_id, u.criado_em from marts.dim_usuario u
    where u.e_cliente
      and (p_papel is null or u.papel = p_papel)
      and (p_plano is null or coalesce(u.plano, 'sem_plano') = p_plano)
  ),
  rastreio as (select min(data_brt) as inicio from marts.fact_pageview),
  comparavel as (
    select (h.d - 2 * p_dias) >= r.inicio as ok from hoje h, rastreio r
  ),
  n as (
    select
      (select count(distinct f.user_id) from marts.fact_evento f
         join clientes c on c.user_id = f.user_id, hoje
        where f.data_brt > hoje.d - p_dias) as ativos,
      (select count(distinct f.user_id) from marts.fact_evento f
         join clientes c on c.user_id = f.user_id, hoje
        where f.data_brt > hoje.d - 2*p_dias and f.data_brt <= hoje.d - p_dias) as ativos_ant,
      (select count(*) from clientes c, hoje
        where (c.criado_em at time zone 'America/Sao_Paulo')::date > hoje.d - p_dias) as novos,
      (select count(*) from clientes c, hoje
        where (c.criado_em at time zone 'America/Sao_Paulo')::date > hoje.d - 2*p_dias
          and (c.criado_em at time zone 'America/Sao_Paulo')::date <= hoje.d - p_dias) as novos_ant,
      (select count(*) from marts.fact_evento f join clientes c on c.user_id = f.user_id, hoje
        where f.tipo = 'lesson_completed' and f.data_brt > hoje.d - p_dias) as aulas,
      (select count(*) from marts.fact_evento f join clientes c on c.user_id = f.user_id, hoje
        where f.tipo = 'lesson_completed'
          and f.data_brt > hoje.d - 2*p_dias and f.data_brt <= hoje.d - p_dias) as aulas_ant,
      (select count(*) from marts.fact_pageview p join clientes c on c.user_id = p.user_id, hoje
        where p.data_brt > hoje.d - p_dias) as pageviews,
      (select case when (select ok from comparavel) then
         (select count(*) from marts.fact_pageview p join clientes c on c.user_id = p.user_id, hoje
           where p.data_brt > hoje.d - 2*p_dias and p.data_brt <= hoje.d - p_dias)
       end) as pageviews_ant
  )
  select
    n.ativos,    case when n.ativos    >= 30 and n.ativos_ant    >= 30 then n.ativos_ant    end,
    n.novos,     case when n.novos     >= 30 and n.novos_ant     >= 30 then n.novos_ant     end,
    n.aulas,     case when n.aulas     >= 30 and n.aulas_ant     >= 30 then n.aulas_ant     end,
    n.pageviews, case when n.pageviews >= 30 and n.pageviews_ant >= 30 then n.pageviews_ant end
  from n;
$$;

-- ============ CLIENTES & RETENÇÃO ============

create or replace function public.bi_dias_ativos_distribuicao(
  p_dias integer default 30, p_papel text default null, p_plano text default null)
returns table(faixa text, ordem integer, clientes bigint)
language sql stable set search_path to ''
as $$
  with atv as (
    select f.user_id, count(distinct f.data_brt) as dias
    from marts.fact_evento f
    join marts.dim_usuario u on u.user_id = f.user_id and u.e_cliente
      and (p_papel is null or u.papel = p_papel)
      and (p_plano is null or coalesce(u.plano, 'sem_plano') = p_plano)
    where f.data_brt > (select marts.data_referencia()) - p_dias
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

create or replace function public.bi_amplitude_modulos(
  p_dias integer default 30, p_papel text default null, p_plano text default null)
returns table(modulos integer, clientes bigint)
language sql stable set search_path to ''
as $$
  with atv as (
    select f.user_id, count(distinct marts.modulo_do_evento(f.tipo)) as modulos
    from marts.fact_evento f
    join marts.dim_usuario u on u.user_id = f.user_id and u.e_cliente
      and (p_papel is null or u.papel = p_papel)
      and (p_plano is null or coalesce(u.plano, 'sem_plano') = p_plano)
    where f.data_brt > (select marts.data_referencia()) - p_dias
    group by f.user_id
  )
  select modulos::integer, count(*) from atv group by 1 order by 1;
$$;

create or replace function public.bi_power_users(
  p_dias integer default 30, p_limite integer default 15,
  p_papel text default null, p_plano text default null)
returns table(
  nome text, email text, organizacao text, plano text,
  dias_ativos bigint, eventos bigint, modulos bigint)
language sql stable set search_path to ''
as $$
  select u.nome, u.email, u.organizacao, coalesce(u.plano_display, u.plano),
         count(distinct f.data_brt) as dias_ativos,
         count(*) as eventos,
         count(distinct marts.modulo_do_evento(f.tipo)) as modulos
  from marts.fact_evento f
  join marts.dim_usuario u on u.user_id = f.user_id and u.e_cliente
    and (p_papel is null or u.papel = p_papel)
    and (p_plano is null or coalesce(u.plano, 'sem_plano') = p_plano)
  where f.data_brt > (select marts.data_referencia()) - p_dias
  group by u.user_id, u.nome, u.email, u.organizacao, u.plano_display, u.plano
  order by count(distinct f.data_brt) desc, count(*) desc
  limit p_limite;
$$;

create or replace function public.bi_engajamento_clientes(
  p_dias integer default 30, p_papel text default null, p_plano text default null)
returns table(
  mau bigint, dau_medio numeric, stickiness numeric, pct_habito_semanal numeric,
  dias_ativos_medio numeric, pct_multimodulo numeric, pct_mais_de_um_dia numeric,
  base_habito bigint)
language sql stable set search_path to ''
as $$
  with hoje as materialized (select marts.data_referencia() d),
  atv as materialized (
    select f.user_id, f.data_brt, f.tipo
    from marts.fact_evento f
    join marts.dim_usuario u on u.user_id = f.user_id and u.e_cliente
      and (p_papel is null or u.papel = p_papel)
      and (p_plano is null or coalesce(u.plano, 'sem_plano') = p_plano), hoje h
    where f.data_brt > h.d - p_dias
  ),
  por_usuario as materialized (
    select user_id,
           count(distinct data_brt) as dias_ativos,
           count(distinct marts.modulo_do_evento(tipo)) as modulos
    from atv group by user_id
  ),
  por_dia as (
    select data_brt, count(distinct user_id) as dau from atv group by data_brt
  ),
  habito as materialized (
    select f.user_id, count(distinct ((h.d - 1 - f.data_brt) / 7)) as semanas
    from marts.fact_evento f
    join marts.dim_usuario u on u.user_id = f.user_id and u.e_cliente
      and (p_papel is null or u.papel = p_papel)
      and (p_plano is null or coalesce(u.plano, 'sem_plano') = p_plano), hoje h
    where f.data_brt > h.d - 28 and f.data_brt <= h.d
    group by f.user_id
  )
  select
    (select count(*) from por_usuario),
    round((select avg(dau) from por_dia), 1),
    case when (select count(*) from por_usuario) >= 30 then
      round((select avg(dau) from por_dia) / nullif((select count(*) from por_usuario), 0), 4) end,
    case when (select count(*) from habito) >= 30 then
      round((select count(*) filter (where semanas >= 3) from habito)::numeric
        / nullif((select count(*) from habito), 0), 4) end,
    case when (select count(*) from por_usuario) >= 30 then
      round((select avg(dias_ativos) from por_usuario), 1) end,
    case when (select count(*) from por_usuario) >= 30 then
      round((select count(*) filter (where modulos >= 2) from por_usuario)::numeric
        / nullif((select count(*) from por_usuario), 0), 4) end,
    case when (select count(*) from por_usuario) >= 30 then
      round((select count(*) filter (where dias_ativos > 1) from por_usuario)::numeric
        / nullif((select count(*) from por_usuario), 0), 4) end,
    (select count(*) from habito);
$$;

create or replace function public.bi_retencao_cohort(
  p_papel text default null, p_plano text default null)
returns table(
  cohort_mes date, clientes bigint,
  ret_7d numeric, ret_30d numeric, ret_90d numeric, ret_180d numeric)
language sql stable set search_path to ''
as $$
  with hoje as materialized (select marts.data_referencia() d),
  base as materialized (
    select u.user_id,
           (u.criado_em at time zone 'America/Sao_Paulo')::date as entrada,
           u.cohort_mes
    from marts.dim_usuario u
    where u.e_cliente and u.cohort_mes >= date '2025-05-01'
      and (p_papel is null or u.papel = p_papel)
      and (p_plano is null or coalesce(u.plano, 'sem_plano') = p_plano)
  )
  select
    b.cohort_mes,
    count(*) as clientes,
    case when count(*) >= 30 then
      round(avg(case when b.entrada + 37 <= h.d then
        (exists (select 1 from marts.fact_evento e
                 where e.user_id = b.user_id
                   and e.data_brt >= b.entrada + 7 and e.data_brt < b.entrada + 37))::int::numeric
        end), 4) end as ret_7d,
    case when count(*) >= 30 then
      round(avg(case when b.entrada + 60 <= h.d then
        (exists (select 1 from marts.fact_evento e
                 where e.user_id = b.user_id
                   and e.data_brt >= b.entrada + 30 and e.data_brt < b.entrada + 60))::int::numeric
        end), 4) end as ret_30d,
    case when count(*) >= 30 then
      round(avg(case when b.entrada + 120 <= h.d then
        (exists (select 1 from marts.fact_evento e
                 where e.user_id = b.user_id
                   and e.data_brt >= b.entrada + 90 and e.data_brt < b.entrada + 120))::int::numeric
        end), 4) end as ret_90d,
    case when count(*) >= 30 then
      round(avg(case when b.entrada + 210 <= h.d then
        (exists (select 1 from marts.fact_evento e
                 where e.user_id = b.user_id
                   and e.data_brt >= b.entrada + 180 and e.data_brt < b.entrada + 210))::int::numeric
        end), 4) end as ret_180d
  from base b, hoje h
  group by b.cohort_mes
  order by b.cohort_mes desc;
$$;

create or replace function public.bi_retencao_por_amplitude(
  p_papel text default null, p_plano text default null)
returns table(modulos integer, clientes bigint, pct_retidos numeric)
language sql stable set search_path to ''
as $$
  with hoje as materialized (select marts.data_referencia() d),
  primeira as materialized (
    select f.user_id, min(f.data_brt) as inicio
    from marts.fact_evento f
    join marts.dim_usuario u on u.user_id = f.user_id and u.e_cliente
      and (p_papel is null or u.papel = p_papel)
      and (p_plano is null or coalesce(u.plano, 'sem_plano') = p_plano)
    group by f.user_id
  ),
  elegiveis as materialized (
    select p.user_id, p.inicio from primeira p, hoje h where p.inicio <= h.d - 120
  ),
  amplitude_inicial as materialized (
    select e.user_id,
           count(distinct marts.modulo_do_evento(f.tipo)) as modulos
    from elegiveis e
    join marts.fact_evento f on f.user_id = e.user_id
      and f.data_brt >= e.inicio and f.data_brt < e.inicio + 30
    group by e.user_id
  ),
  retido as materialized (
    select e.user_id,
           exists (select 1 from marts.fact_evento f, hoje h
                   where f.user_id = e.user_id and f.data_brt > h.d - 30) as ativo
    from elegiveis e
  )
  select a.modulos::integer, count(*) as clientes,
         case when count(*) >= 30 then round(avg(r.ativo::int::numeric), 4) end as pct_retidos
  from amplitude_inicial a
  join retido r on r.user_id = a.user_id
  group by a.modulos
  order by a.modulos;
$$;

create or replace function public.bi_retencao_por_papel(p_plano text default null)
returns table(papel text, clientes bigint, pct_retidos numeric)
language sql stable set search_path to ''
as $$
  with hoje as materialized (select marts.data_referencia() d),
  primeira as materialized (
    select f.user_id, u.papel, min(f.data_brt) as inicio
    from marts.fact_evento f
    join marts.dim_usuario u on u.user_id = f.user_id and u.e_cliente
      and u.papel in ('hands_on', 'master_user', 'membro_club')
      and (p_plano is null or coalesce(u.plano, 'sem_plano') = p_plano)
    group by f.user_id, u.papel
  ),
  elegiveis as materialized (
    select p.user_id, p.papel from primeira p, hoje h where p.inicio <= h.d - 120
  ),
  retido as materialized (
    select e.user_id, e.papel,
           exists (select 1 from marts.fact_evento f, hoje h
                   where f.user_id = e.user_id and f.data_brt > h.d - 30) as ativo
    from elegiveis e
  )
  select r.papel, count(*) as clientes,
         case when count(*) >= 30 then round(avg(r.ativo::int::numeric), 4) end as pct_retidos
  from retido r
  group by r.papel
  order by 3 desc nulls last;
$$;

create or replace function public.bi_churn_resumo(
  p_papel text default null, p_plano text default null)
returns table(churned bigint, ativos bigint, pct_churn numeric, vida_media_dias numeric)
language sql stable set search_path to ''
as $$
  with hoje as materialized (select marts.data_referencia() d),
  vida as materialized (
    select f.user_id, min(f.data_brt) as primeira, max(f.data_brt) as ultima
    from marts.fact_evento f
    join marts.dim_usuario u on u.user_id = f.user_id and u.e_cliente
      and (p_papel is null or u.papel = p_papel)
      and (p_plano is null or coalesce(u.plano, 'sem_plano') = p_plano)
    group by f.user_id
  )
  select
    count(*) filter (where v.ultima < h.d - 60),
    count(*) filter (where v.ultima >= h.d - 60),
    case when count(*) >= 30 then
      round(count(*) filter (where v.ultima < h.d - 60)::numeric / nullif(count(*), 0), 4) end,
    case when count(*) filter (where v.ultima < h.d - 60) >= 30 then
      round(avg(v.ultima - v.primeira) filter (where v.ultima < h.d - 60), 1) end
  from vida v, hoje h;
$$;

create or replace function public.bi_churn_modulos(
  p_papel text default null, p_plano text default null)
returns table(
  modulo text, medido_desde date,
  pct_churned_nunca_usou numeric, pct_ativos_nunca_usou numeric, gap_pp numeric)
language sql stable set search_path to ''
as $$
  with hoje as materialized (select marts.data_referencia() d),
  vida as materialized (
    select f.user_id, max(f.data_brt) as ultima
    from marts.fact_evento f
    join marts.dim_usuario u on u.user_id = f.user_id and u.e_cliente
      and (p_papel is null or u.papel = p_papel)
      and (p_plano is null or coalesce(u.plano, 'sem_plano') = p_plano)
    group by f.user_id
  ),
  grupos as materialized (
    select v.user_id, (v.ultima < h.d - 60) as churned from vida v, hoje h
  ),
  modulos as (
    select * from (values
      ('Formações',  date '2025-05-09'),
      ('Soluções',   date '2025-07-17'),
      ('Builder',    date '2025-10-24'),
      ('Consultor',  date '2026-05-11'),
      ('Comunidade', date '2025-08-12'),
      ('Networking', date '2025-07-12'),
      ('Mentoria',   date '2025-11-29')
    ) as m(modulo, medido_desde)
  ),
  -- A função de módulo é imutável e roda por linha: sobre os 330.847 eventos
  -- ela era chamada 330 mil vezes para produzir 25.231 pares distintos. Passar
  -- o distinct primeiro corta 13× o trabalho — 4.337ms para 946ms.
  usou as materialized (
    select distinct t.user_id, marts.modulo_do_evento(t.tipo) as modulo
    from (select distinct user_id, tipo from marts.fact_evento) t
    union
    select distinct p.user_id, 'Soluções'::text
    from marts.fact_progresso_solucao p
  )
  select
    m.modulo,
    m.medido_desde,
    case when count(*) filter (where g.churned) >= 30 then
      round(1 - count(u.user_id) filter (where g.churned)::numeric
        / nullif(count(*) filter (where g.churned), 0), 4) end,
    case when count(*) filter (where not g.churned) >= 30 then
      round(1 - count(u.user_id) filter (where not g.churned)::numeric
        / nullif(count(*) filter (where not g.churned), 0), 4) end,
    case when count(*) filter (where g.churned) >= 30
          and count(*) filter (where not g.churned) >= 30 then
      round((
        (1 - count(u.user_id) filter (where g.churned)::numeric
          / nullif(count(*) filter (where g.churned), 0))
        - (1 - count(u.user_id) filter (where not g.churned)::numeric
          / nullif(count(*) filter (where not g.churned), 0))
      ) * 100, 1) end
  from modulos m
  cross join grupos g
  left join usou u on u.user_id = g.user_id and u.modulo = m.modulo
  group by m.modulo, m.medido_desde
  order by 5 desc nulls last;
$$;

create or replace function public.bi_churn_ultimo_modulo(
  p_papel text default null, p_plano text default null)
returns table(modulo text, clientes bigint, pct numeric)
language sql stable set search_path to ''
as $$
  with hoje as materialized (select marts.data_referencia() d),
  vida as materialized (
    select f.user_id, max(f.data_brt) as ultima
    from marts.fact_evento f
    join marts.dim_usuario u on u.user_id = f.user_id and u.e_cliente
      and (p_papel is null or u.papel = p_papel)
      and (p_plano is null or coalesce(u.plano, 'sem_plano') = p_plano)
    group by f.user_id
  ),
  churned as materialized (
    select v.user_id, v.ultima from vida v, hoje h where v.ultima < h.d - 60
  ),
  ultimo as (
    select c.user_id,
           (array_agg(marts.modulo_do_evento(f.tipo) order by f.criado_em desc))[1] as modulo
    from churned c
    join marts.fact_evento f on f.user_id = c.user_id and f.data_brt = c.ultima
    group by c.user_id
  )
  select modulo,
         count(*),
         case when sum(count(*)) over () >= 30
              then round(count(*)::numeric / sum(count(*)) over (), 4) end
  from ultimo group by 1 order by 2 desc;
$$;

create or replace function public.bi_aha_moment(
  p_papel text default null, p_plano text default null)
returns table(
  acao text, fizeram bigint, ret_fizeram numeric,
  nao_fizeram bigint, ret_nao_fizeram numeric, lift numeric)
language sql stable set search_path to ''
as $$
  with hoje as materialized (select marts.data_referencia() d),
  base as materialized (
    select u.user_id,
           (u.criado_em at time zone 'America/Sao_Paulo')::date as entrada
    from marts.dim_usuario u, hoje h
    where u.e_cliente
      and u.cohort_mes >= date '2025-05-01'
      and (u.criado_em at time zone 'America/Sao_Paulo')::date <= h.d - 120
      and (p_papel is null or u.papel = p_papel)
      and (p_plano is null or coalesce(u.plano, 'sem_plano') = p_plano)
  ),
  acoes7 as materialized (
    select distinct b.user_id, f.tipo
    from base b
    join marts.fact_evento f on f.user_id = b.user_id
      and f.data_brt >= b.entrada and f.data_brt < b.entrada + 7
  ),
  ret as materialized (
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
    case when count(*) filter (where a.user_id is null) >= 30 then
      round(avg(r.retido::int::numeric) filter (where a.user_id is null), 4) end as ret_nao_fizeram,
    case when count(*) filter (where a.user_id is null) >= 30 then
      round(
        avg(r.retido::int::numeric) filter (where a.user_id is not null)
        / nullif(avg(r.retido::int::numeric) filter (where a.user_id is null), 0), 2) end as lift
  from tipos t
  cross join base b
  join ret r on r.user_id = b.user_id
  left join acoes7 a on a.user_id = b.user_id and a.tipo = t.tipo
  group by t.tipo
  having count(*) filter (where a.user_id is not null) >= 50
  order by 6 desc nulls last;
$$;

create or replace function public.bi_clientes_em_risco(
  p_limite integer default 30, p_papel text default null, p_plano text default null)
returns table(
  nome text, email text, organizacao text, plano text, motivo text,
  ultima_atividade date, dias_inativo integer, dias_ate_vencer integer)
language sql stable set search_path to ''
as $$
  with hoje as materialized (select marts.data_referencia() d),
  ult as materialized (
    select f.user_id, max(f.data_brt) as ultima
    from marts.fact_evento f
    group by f.user_id
  ),
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
      and (p_papel is null or u.papel = p_papel)
      and (p_plano is null or coalesce(u.plano, 'sem_plano') = p_plano)
      and l.ultima < h.d - 14
      and l.ultima >= h.d - 74
  ),
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
      and (p_papel is null or u.papel = p_papel)
      and (p_plano is null or coalesce(u.plano, 'sem_plano') = p_plano)
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

create or replace function public.bi_formacoes_kpis(p_dias integer default 30)
returns table(alunos_ativos bigint, aulas_concluidas bigint, certificados bigint, nps_medio numeric)
language sql stable set search_path to ''
as $$
  with hoje as materialized (select marts.data_referencia() d)
  select
    (select count(distinct f.user_id)
     from marts.fact_progresso_aula f
     join marts.dim_usuario u on u.user_id = f.user_id and u.e_cliente, hoje h
     where f.concluido_em is not null
       and (f.concluido_em at time zone 'America/Sao_Paulo')::date > h.d - p_dias),
    (select count(*)
     from marts.fact_progresso_aula f
     join marts.dim_usuario u on u.user_id = f.user_id and u.e_cliente, hoje h
     where f.concluido_em is not null
       and (f.concluido_em at time zone 'America/Sao_Paulo')::date > h.d - p_dias),
    (select count(*)
     from marts.fact_certificado c
     join marts.dim_usuario u on u.user_id = c.user_id and u.e_cliente, hoje h
     where (c.emitido_em at time zone 'America/Sao_Paulo')::date > h.d - p_dias),
    (select round(avg(n.score), 2)
     from marts.fact_nps_aula n
     join marts.dim_usuario u on u.user_id = n.user_id and u.e_cliente, hoje h
     where (n.criado_em at time zone 'America/Sao_Paulo')::date > h.d - p_dias);
$$;
