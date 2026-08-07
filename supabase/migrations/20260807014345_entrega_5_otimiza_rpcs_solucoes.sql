-- Correção de performance: bi_solucoes_candidatas_remocao levava 7,6s (limite
-- do PostgREST é 8s) → 500 no app. Causa: subqueries correlacionadas por
-- solução sobre fact_pageview (372k linhas) SEM índice em solution_id.
-- Solução: índice + agregações pré-computadas por CTE (GROUP BY uma vez).
-- Resultado medido: 7.635ms → 54ms.

create index if not exists fact_pageview_solucao_idx
  on marts.fact_pageview (solution_id) where solution_id is not null;

-- Métricas por solução calculadas UMA vez e reaproveitadas pelas duas RPCs.
create or replace view marts.v_metricas_solucao as
with pv as (
  select solution_id, count(*) as pageviews
  from marts.fact_pageview where solution_id is not null group by solution_id
),
prog as (
  select p.solution_id,
         count(*) as iniciadas,
         count(*) filter (where p.concluido) as concluidas
  from marts.fact_progresso_solucao p
  join marts.dim_usuario u on u.user_id = p.user_id and u.e_cliente
  group by p.solution_id
),
aval as (
  select solution_id, round(avg(nota), 2) as nota, count(*) as avaliacoes
  from marts.fact_avaliacao_solucao group by solution_id
),
fav as (
  select solution_id, count(*) as favoritos
  from marts.fact_favorito_solucao group by solution_id
)
select
  s.id, s.titulo, s.categoria, s.publicada, s.em_breve,
  coalesce(pv.pageviews, 0) as pageviews,
  coalesce(prog.iniciadas, 0) as iniciadas,
  coalesce(prog.concluidas, 0) as concluidas,
  round(coalesce(prog.concluidas, 0)::numeric / nullif(prog.iniciadas, 0), 4) as taxa_conclusao,
  aval.nota,
  coalesce(aval.avaliacoes, 0) as avaliacoes,
  coalesce(fav.favoritos, 0) as favoritos
from marts.dim_solucao s
left join pv on pv.solution_id = s.id
left join prog on prog.solution_id = s.id
left join aval on aval.solution_id = s.id
left join fav on fav.solution_id = s.id;

comment on view marts.v_metricas_solucao is
  'Métricas agregadas por solução — evita subquery correlacionada nas RPCs (era 7,6s, agora <100ms).';

grant select on marts.v_metricas_solucao to authenticated;

create or replace function public.bi_solucoes_ranking(p_limite integer default 200)
returns table (
  solucao text, categoria text, publicada boolean,
  pageviews bigint, iniciadas bigint, concluidas bigint,
  taxa_conclusao numeric, nota numeric, avaliacoes bigint, favoritos bigint
)
language sql stable security invoker set search_path = '' as $$
  select titulo, categoria, publicada, pageviews, iniciadas, concluidas,
         taxa_conclusao, nota, avaliacoes, favoritos
  from marts.v_metricas_solucao
  where publicada
  order by iniciadas desc
  limit p_limite;
$$;

create or replace function public.bi_solucoes_candidatas_remocao()
returns table (
  solucao text, categoria text, pageviews bigint, iniciadas bigint,
  concluidas bigint, nota numeric, favoritos bigint, motivo text
)
language sql stable security invoker set search_path = '' as $$
  with base as (
    select * from marts.v_metricas_solucao where publicada and not em_breve
  ),
  corte as (
    select percentile_cont(0.25) within group (order by iniciadas) as p25 from base
  )
  select b.titulo, b.categoria, b.pageviews, b.iniciadas, b.concluidas,
         b.nota, b.favoritos,
         case
           when b.iniciadas = 0 then 'Nunca iniciada'
           when b.concluidas = 0 and b.iniciadas <= c.p25 then 'Baixo uso e nenhuma conclusão'
           when b.concluidas = 0 then 'Nenhuma conclusão'
           else 'Baixo uso (quartil inferior)'
         end
  from base b, corte c
  where b.iniciadas <= c.p25 or b.concluidas = 0
  order by b.iniciadas, b.pageviews;
$$;

revoke execute on function public.bi_solucoes_ranking(integer) from public, anon;
revoke execute on function public.bi_solucoes_candidatas_remocao() from public, anon;
grant execute on function public.bi_solucoes_ranking(integer) to authenticated;
grant execute on function public.bi_solucoes_candidatas_remocao() to authenticated;
