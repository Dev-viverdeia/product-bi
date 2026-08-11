-- Recorte transversal por persona/plano — Fase A (Visão Geral + Clientes).
--
-- Contrato em docs/roadmap-bi.md (Transversal):
--   · p_papel / p_plano (null = todos) restringem o CONJUNTO DE CLIENTES —
--     eventos, pageviews e progresso contam só os desses clientes.
--     'sem_plano' casa com plano nulo na dim: grupo real, não erro de dado.
--   · Supressão: percentual, taxa e média com denominador < 30 saem NULL, e a
--     contagem que serve de denominador sai na resposta para a tela declarar.
--     Contagem nunca é suprimida. Delta só existe com ≥ 30 nos dois períodos —
--     a RPC anula a coluna *_ant e a UI omite o delta, mesma mecânica da régua
--     de pageviews pré-jul/2026.
--   · O recorte é pelo papel/plano ATUAL (a dim não guarda histórico).
--
-- Assinatura muda em todas → drop + create: PostgREST não resolve duas
-- sobrecargas do mesmo nome.

drop function public.bi_visao_geral_kpis(integer);
drop function public.bi_atividade_diaria(integer);
drop function public.bi_eventos_por_tipo(integer);
drop function public.bi_heatmap_navegacao(integer);
drop function public.bi_top_telas(integer, integer);
drop function public.bi_engajamento_clientes(integer);
drop function public.bi_retencao_cohort();
drop function public.bi_dias_ativos_distribuicao(integer);
drop function public.bi_amplitude_modulos(integer);
drop function public.bi_retencao_por_amplitude();
drop function public.bi_power_users(integer, integer);
drop function public.bi_clientes_em_risco(integer);
drop function public.bi_aha_moment();
drop function public.bi_churn_resumo();
drop function public.bi_churn_modulos();
drop function public.bi_churn_ultimo_modulo();

-- ============ VISÃO GERAL ============

create function public.bi_visao_geral_kpis(
  p_dias integer default 30, p_papel text default null, p_plano text default null)
returns table(
  ativos bigint, ativos_ant bigint, novos bigint, novos_ant bigint,
  aulas bigint, aulas_ant bigint, pageviews bigint, pageviews_ant bigint)
language sql stable set search_path to ''
as $$
  with hoje as (select (now() at time zone 'America/Sao_Paulo')::date d),
  clientes as (
    select u.user_id, u.criado_em from marts.dim_usuario u
    where u.e_cliente
      and (p_papel is null or u.papel = p_papel)
      and (p_plano is null or coalesce(u.plano, 'sem_plano') = p_plano)
  ),
  -- início do rastreio de navegação: antes disso não há o que comparar
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
      -- null quando a janela anterior cai antes do rastreio: a UI omite o delta
      (select case when (select ok from comparavel) then
         (select count(*) from marts.fact_pageview p join clientes c on c.user_id = p.user_id, hoje
           where p.data_brt > hoje.d - 2*p_dias and p.data_brt <= hoje.d - p_dias)
       end) as pageviews_ant
  )
  -- contagem sempre aparece; o delta só quando os dois lados sustentam (≥ 30)
  select
    n.ativos,    case when n.ativos    >= 30 and n.ativos_ant    >= 30 then n.ativos_ant    end,
    n.novos,     case when n.novos     >= 30 and n.novos_ant     >= 30 then n.novos_ant     end,
    n.aulas,     case when n.aulas     >= 30 and n.aulas_ant     >= 30 then n.aulas_ant     end,
    n.pageviews, case when n.pageviews >= 30 and n.pageviews_ant >= 30 then n.pageviews_ant end
  from n;
$$;

create function public.bi_atividade_diaria(
  p_dias integer default 30, p_papel text default null, p_plano text default null)
returns table(data date, ativos bigint)
language sql stable set search_path to ''
as $$
  with hoje as (select (now() at time zone 'America/Sao_Paulo')::date d),
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

create function public.bi_eventos_por_tipo(
  p_dias integer default 30, p_papel text default null, p_plano text default null)
returns table(tipo text, eventos bigint)
language sql stable set search_path to ''
as $$
  select f.tipo, count(*)
  from marts.fact_evento f
  join marts.dim_usuario u on u.user_id = f.user_id and u.e_cliente
    and (p_papel is null or u.papel = p_papel)
    and (p_plano is null or coalesce(u.plano, 'sem_plano') = p_plano)
  where f.data_brt > (now() at time zone 'America/Sao_Paulo')::date - p_dias
  group by 1
  order by 2 desc;
$$;

create function public.bi_heatmap_navegacao(
  p_dias integer default 30, p_papel text default null, p_plano text default null)
returns table(dia_semana smallint, hora smallint, pageviews bigint)
language sql stable set search_path to ''
as $$
  select p.dia_semana_brt, p.hora_brt, count(*)
  from marts.fact_pageview p
  join marts.dim_usuario u on u.user_id = p.user_id and u.e_cliente
    and (p_papel is null or u.papel = p_papel)
    and (p_plano is null or coalesce(u.plano, 'sem_plano') = p_plano)
  where p.data_brt > (now() at time zone 'America/Sao_Paulo')::date - p_dias
  group by 1, 2;
$$;

create function public.bi_top_telas(
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
  where p.data_brt > (now() at time zone 'America/Sao_Paulo')::date - p_dias
  group by 1
  order by 2 desc
  limit p_limite;
$$;

-- ============ CLIENTES & RETENÇÃO ============

-- base_habito entra na resposta: é o denominador do hábito semanal (janela
-- fixa de 28d, diferente do mau) e a tela precisa dele para declarar supressão.
create function public.bi_engajamento_clientes(
  p_dias integer default 30, p_papel text default null, p_plano text default null)
returns table(
  mau bigint, dau_medio numeric, stickiness numeric, pct_habito_semanal numeric,
  dias_ativos_medio numeric, pct_multimodulo numeric, base_habito bigint)
language sql stable set search_path to ''
as $$
  with hoje as (select (now() at time zone 'America/Sao_Paulo')::date d),
  atv as (
    select f.user_id, f.data_brt, f.tipo
    from marts.fact_evento f
    join marts.dim_usuario u on u.user_id = f.user_id and u.e_cliente
      and (p_papel is null or u.papel = p_papel)
      and (p_plano is null or coalesce(u.plano, 'sem_plano') = p_plano), hoje h
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
    (select count(*) from habito);
$$;

-- Supressão por safra: com o recorte ligado uma cohort pode ficar com meia
-- dúzia de clientes, e percentual sobre isso é ruído com cara de tendência.
-- A linha continua aparecendo (a contagem é honesta); só as taxas saem null.
create function public.bi_retencao_cohort(
  p_papel text default null, p_plano text default null)
returns table(
  cohort_mes date, clientes bigint,
  ret_7d numeric, ret_30d numeric, ret_90d numeric, ret_180d numeric)
language sql stable set search_path to ''
as $$
  with hoje as (select (now() at time zone 'America/Sao_Paulo')::date d),
  base as (
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

create function public.bi_dias_ativos_distribuicao(
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

create function public.bi_amplitude_modulos(
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
    where f.data_brt > (now() at time zone 'America/Sao_Paulo')::date - p_dias
    group by f.user_id
  )
  select modulos::integer, count(*) from atv group by 1 order by 1;
$$;

create function public.bi_retencao_por_amplitude(
  p_papel text default null, p_plano text default null)
returns table(modulos integer, clientes bigint, pct_retidos numeric)
language sql stable set search_path to ''
as $$
  with hoje as (select (now() at time zone 'America/Sao_Paulo')::date d),
  primeira as (
    select f.user_id, min(f.data_brt) as inicio
    from marts.fact_evento f
    join marts.dim_usuario u on u.user_id = f.user_id and u.e_cliente
      and (p_papel is null or u.papel = p_papel)
      and (p_plano is null or coalesce(u.plano, 'sem_plano') = p_plano)
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
         case when count(*) >= 30 then round(avg(r.ativo::int::numeric), 4) end as pct_retidos
  from amplitude_inicial a
  join retido r on r.user_id = a.user_id
  group by a.modulos
  order by a.modulos;
$$;

create function public.bi_power_users(
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
  where f.data_brt > (now() at time zone 'America/Sao_Paulo')::date - p_dias
  group by u.user_id, u.nome, u.email, u.organizacao, u.plano_display, u.plano
  order by count(distinct f.data_brt) desc, count(*) desc
  limit p_limite;
$$;

create function public.bi_clientes_em_risco(
  p_limite integer default 30, p_papel text default null, p_plano text default null)
returns table(
  nome text, email text, organizacao text, plano text, motivo text,
  ultima_atividade date, dias_inativo integer, dias_ate_vencer integer)
language sql stable set search_path to ''
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
      and (p_papel is null or u.papel = p_papel)
      and (p_plano is null or coalesce(u.plano, 'sem_plano') = p_plano)
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

-- O piso de 50 "fizeram" já existia (contrato da E2b) e continua; a novidade é
-- o lado de cá: com recorte, "não fizeram" também pode minguar, e lift contra
-- meia dúzia de contraexemplos é falso sinal.
create function public.bi_aha_moment(
  p_papel text default null, p_plano text default null)
returns table(
  acao text, fizeram bigint, ret_fizeram numeric,
  nao_fizeram bigint, ret_nao_fizeram numeric, lift numeric)
language sql stable set search_path to ''
as $$
  with hoje as (select (now() at time zone 'America/Sao_Paulo')::date d),
  base as (
    select u.user_id,
           (u.criado_em at time zone 'America/Sao_Paulo')::date as entrada
    from marts.dim_usuario u, hoje h
    where u.e_cliente
      and u.cohort_mes >= date '2025-05-01'
      and (u.criado_em at time zone 'America/Sao_Paulo')::date <= h.d - 120
      and (p_papel is null or u.papel = p_papel)
      and (p_plano is null or coalesce(u.plano, 'sem_plano') = p_plano)
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

create function public.bi_churn_resumo(
  p_papel text default null, p_plano text default null)
returns table(churned bigint, ativos bigint, pct_churn numeric, vida_media_dias numeric)
language sql stable set search_path to ''
as $$
  with hoje as (select (now() at time zone 'America/Sao_Paulo')::date d),
  vida as (
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

create function public.bi_churn_modulos(
  p_papel text default null, p_plano text default null)
returns table(
  modulo text, medido_desde date,
  pct_churned_nunca_usou numeric, pct_ativos_nunca_usou numeric, gap_pp numeric)
language sql stable set search_path to ''
as $$
  with hoje as (select (now() at time zone 'America/Sao_Paulo')::date d),
  vida as (
    select f.user_id, max(f.data_brt) as ultima
    from marts.fact_evento f
    join marts.dim_usuario u on u.user_id = f.user_id and u.e_cliente
      and (p_papel is null or u.papel = p_papel)
      and (p_plano is null or coalesce(u.plano, 'sem_plano') = p_plano)
    group by f.user_id
  ),
  grupos as (
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
  usou as (
    select distinct f.user_id, marts.modulo_do_evento(f.tipo) as modulo
    from marts.fact_evento f
    union
    -- Soluções: fonte durável (progress) cobre o histórico que os eventos não cobrem
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

create function public.bi_churn_ultimo_modulo(
  p_papel text default null, p_plano text default null)
returns table(modulo text, clientes bigint)
language sql stable set search_path to ''
as $$
  with hoje as (select (now() at time zone 'America/Sao_Paulo')::date d),
  vida as (
    select f.user_id, max(f.data_brt) as ultima
    from marts.fact_evento f
    join marts.dim_usuario u on u.user_id = f.user_id and u.e_cliente
      and (p_papel is null or u.papel = p_papel)
      and (p_plano is null or coalesce(u.plano, 'sem_plano') = p_plano)
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

-- ============ RETENÇÃO POR PAPEL (peça nova da Fase A) ============

-- A resposta direta de "62% no agregado pode ser 80% no master e 55% no
-- hands_on". Régua idêntica à de bi_retencao_por_amplitude para os números
-- conversarem: elegível = 1ª ação há 120+ dias; retido = ativo nos últimos 30.
-- Só os 3 papéis do contrato — os 7 restantes somam 99 clientes e nasceriam
-- suprimidos. Não recebe p_papel de propósito: a comparação É o card.
create function public.bi_retencao_por_papel(p_plano text default null)
returns table(papel text, clientes bigint, pct_retidos numeric)
language sql stable set search_path to ''
as $$
  with hoje as (select (now() at time zone 'America/Sao_Paulo')::date d),
  primeira as (
    select f.user_id, u.papel, min(f.data_brt) as inicio
    from marts.fact_evento f
    join marts.dim_usuario u on u.user_id = f.user_id and u.e_cliente
      and u.papel in ('hands_on', 'master_user', 'membro_club')
      and (p_plano is null or coalesce(u.plano, 'sem_plano') = p_plano)
    group by f.user_id, u.papel
  ),
  elegiveis as (
    select p.user_id, p.papel from primeira p, hoje h where p.inicio <= h.d - 120
  ),
  retido as (
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

comment on function public.bi_retencao_por_papel(text) is
  'Retenção comparada entre os 3 papéis do contrato (elegível = 120+ dias de casa; retido = ativo nos últimos 30d). pct_retidos null = amostra < 30.';

-- ============ PERMISSÕES ============

do $$
declare f text;
begin
  foreach f in array array[
    'public.bi_visao_geral_kpis(integer, text, text)',
    'public.bi_atividade_diaria(integer, text, text)',
    'public.bi_eventos_por_tipo(integer, text, text)',
    'public.bi_heatmap_navegacao(integer, text, text)',
    'public.bi_top_telas(integer, integer, text, text)',
    'public.bi_engajamento_clientes(integer, text, text)',
    'public.bi_retencao_cohort(text, text)',
    'public.bi_dias_ativos_distribuicao(integer, text, text)',
    'public.bi_amplitude_modulos(integer, text, text)',
    'public.bi_retencao_por_amplitude(text, text)',
    'public.bi_power_users(integer, integer, text, text)',
    'public.bi_clientes_em_risco(integer, text, text)',
    'public.bi_aha_moment(text, text)',
    'public.bi_churn_resumo(text, text)',
    'public.bi_churn_modulos(text, text)',
    'public.bi_churn_ultimo_modulo(text, text)',
    'public.bi_retencao_por_papel(text)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
