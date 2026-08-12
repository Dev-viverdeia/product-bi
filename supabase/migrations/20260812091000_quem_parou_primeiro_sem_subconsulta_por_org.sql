-- bi_orgs_quem_parou_primeiro levava 6,8 s e estourava o timeout da API na
-- primeira chamada (HTTP 500 visto no navegador). A causa era desenho, nao
-- volume: as duas datas saiam de subconsultas CORRELACIONADAS -- uma varredura
-- de ult x dim_usuario por organizacao, ~2.100 vezes.
--
-- Aqui as duas viram agregados de conjunto, calculados uma vez cada e ligados
-- por join. Mesmo resultado (465 organizacoes com historico dos dois lados),
-- 6.798 ms -> 107 ms.
create or replace function public.bi_orgs_quem_parou_primeiro()
returns table(
  quem text, ordem integer, orgs bigint, pct numeric,
  base_com_historico bigint, fora_sem_historico bigint)
language sql
stable
set search_path to ''
as $function$
  with ref as materialized (select marts.data_referencia() as d),
  ult as materialized (
    select f.user_id, max(f.data_brt) as ultima from marts.fact_evento f group by f.user_id
  ),
  -- Ultima acao do TIME (todo mundo menos o master), uma passada so.
  time_por_org as materialized (
    select u.organization_id, max(l.ultima) as ultima
    from ult l
    join marts.dim_usuario u on u.user_id = l.user_id
    join marts.dim_organizacao o on o.id = u.organization_id
    where u.e_cliente
      and u.organization_id is not null
      and u.user_id is distinct from o.master_user_id
    group by u.organization_id
  ),
  org as materialized (
    select o.id, lm.ultima as master_ultima, t.ultima as time_ultima
    from marts.dim_organizacao o
    left join ult lm on lm.user_id = o.master_user_id
    left join time_por_org t on t.organization_id = o.id
    where o.ativa and o.master_user_id is not null
  ),
  esfriou as materialized (
    select o.* from org o, ref r
    where o.master_ultima is null or o.master_ultima < r.d - 30
  ),
  com_historico as materialized (
    select
      case
        when e.master_ultima < e.time_ultima - 14 then 'O master parou antes'
        when e.time_ultima < e.master_ultima - 14 then 'O time parou antes'
        else 'Pararam na mesma janela'
      end as quem,
      case
        when e.master_ultima < e.time_ultima - 14 then 1
        when e.time_ultima < e.master_ultima - 14 then 3
        else 2
      end as ordem
    from esfriou e
    where e.master_ultima is not null and e.time_ultima is not null
  ),
  tot as (
    select (select count(*) from com_historico) as n,
           (select count(*) from esfriou e
             where e.master_ultima is null or e.time_ultima is null) as fora
  )
  select c.quem, c.ordem, count(*) as orgs,
    case when t.n >= 30 then round(count(*)::numeric / t.n, 4) end as pct,
    t.n, t.fora
  from com_historico c cross join tot t
  group by c.quem, c.ordem, t.n, t.fora
  order by c.ordem;
$function$;

comment on function public.bi_orgs_quem_parou_primeiro() is
  'Entre organizacoes cujo master esta parado ha 30+ dias, quem registrou a ultima acao primeiro. Exclui organizacao sem historico de um dos lados: essa nao esfriou, nunca esquentou.';
