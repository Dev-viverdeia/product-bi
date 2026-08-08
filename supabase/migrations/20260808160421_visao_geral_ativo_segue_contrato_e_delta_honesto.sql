-- Auditoria 08/ago/2026 — degrau de instrumentação na tela principal.
--
-- `bi_visao_geral_kpis` e `bi_atividade_diaria` definiam "ativo" como evento
-- OU pageview. Como o pageview só existe desde 03/07/2026, isso produzia:
--
--   · série de 90 dias com degrau de 341 → 735 ativos/dia (+116%) em 03/07 —
--     a base de usuários parecia dobrar, e era só o rastreamento nascendo;
--   · KPI "Usuários ativos +33,5%" e "Pageviews +313,3%" comparando 30 dias
--     instrumentados contra uma janela anterior com só 6 dias de dados;
--   · divergência com Clientes/Retenção (5.457 × 3.451 para o mesmo conceito).
--
-- O contrato do roadmap já dizia: "Ativo (dia) = cliente com ≥1 evento de
-- domínio no dia". Passa a valer — `fact_evento` é estável desde mai/2025.
-- Pageview continua como KPI próprio (métrica de navegação, legítima), mas
-- sem comparativo quando a janela anterior antecede o início do rastreio.

create or replace function public.bi_visao_geral_kpis(p_dias integer default 30)
returns table (
  ativos bigint, ativos_ant bigint,
  novos bigint, novos_ant bigint,
  aulas bigint, aulas_ant bigint,
  pageviews bigint, pageviews_ant bigint
)
language sql stable security invoker set search_path = ''
as $$
  with hoje as (select (now() at time zone 'America/Sao_Paulo')::date d),
  clientes as (select user_id from marts.dim_usuario where e_cliente),
  -- início do rastreio de navegação: antes disso não há o que comparar
  rastreio as (select min(data_brt) as inicio from marts.fact_pageview),
  comparavel as (
    select (h.d - 2 * p_dias) >= r.inicio as ok from hoje h, rastreio r
  )
  select
    (select count(distinct f.user_id) from marts.fact_evento f
       join clientes c on c.user_id = f.user_id, hoje
      where f.data_brt > hoje.d - p_dias),
    (select count(distinct f.user_id) from marts.fact_evento f
       join clientes c on c.user_id = f.user_id, hoje
      where f.data_brt > hoje.d - 2*p_dias and f.data_brt <= hoje.d - p_dias),
    (select count(*) from marts.dim_usuario du, hoje
      where du.e_cliente and (du.criado_em at time zone 'America/Sao_Paulo')::date > hoje.d - p_dias),
    (select count(*) from marts.dim_usuario du, hoje
      where du.e_cliente
        and (du.criado_em at time zone 'America/Sao_Paulo')::date > hoje.d - 2*p_dias
        and (du.criado_em at time zone 'America/Sao_Paulo')::date <= hoje.d - p_dias),
    (select count(*) from marts.fact_evento f join clientes c on c.user_id = f.user_id, hoje
      where f.tipo = 'lesson_completed' and f.data_brt > hoje.d - p_dias),
    (select count(*) from marts.fact_evento f join clientes c on c.user_id = f.user_id, hoje
      where f.tipo = 'lesson_completed' and f.data_brt > hoje.d - 2*p_dias and f.data_brt <= hoje.d - p_dias),
    (select count(*) from marts.fact_pageview p join clientes c on c.user_id = p.user_id, hoje
      where p.data_brt > hoje.d - p_dias),
    -- null quando a janela anterior cai antes do rastreio: a UI omite o delta
    (select case when (select ok from comparavel) then
       (select count(*) from marts.fact_pageview p join clientes c on c.user_id = p.user_id, hoje
         where p.data_brt > hoje.d - 2*p_dias and p.data_brt <= hoje.d - p_dias)
     end);
$$;

comment on function public.bi_visao_geral_kpis(integer) is
  'KPIs da Visão Geral. "Ativo" = ≥1 evento de domínio no dia (contrato do roadmap, fact_evento). pageviews_ant é null quando a janela anterior antecede o início do rastreio.';

create or replace function public.bi_atividade_diaria(p_dias integer default 30)
returns table (data date, ativos bigint)
language sql stable security invoker set search_path = ''
as $$
  with hoje as (select (now() at time zone 'America/Sao_Paulo')::date d),
  clientes as (select user_id from marts.dim_usuario where e_cliente)
  select f.data_brt, count(distinct f.user_id)
  from marts.fact_evento f
  join clientes c on c.user_id = f.user_id, hoje
  where f.data_brt > hoje.d - p_dias
  group by f.data_brt
  order by f.data_brt;
$$;

comment on function public.bi_atividade_diaria(integer) is
  'Ativos por dia sobre fact_evento apenas — série estável desde mai/2025, sem o degrau de instrumentação do pageview (03/07/2026).';
