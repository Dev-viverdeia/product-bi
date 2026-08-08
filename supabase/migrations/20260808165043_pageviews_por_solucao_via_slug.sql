-- Auditoria 08/ago/2026, pendência 1: recupera os pageviews por solução.
--
-- `analytics.solution_id` vem 100% nulo da origem, mas o dado existe no path
-- (/solucoes/<slug>). Com o FDW de volta dá para fazer isso de forma
-- determinística: `plataforma.solutions.slug` entra na dim e a contagem casa
-- path ↔ slug — sem a heurística de normalizar título que eu havia descartado.
--
-- Cobertura medida: 84,7% dos pageviews de solução casam. O resto são 171
-- slugs de soluções que não existem mais (excluídas corretamente) e 12 que
-- parecem renomeações (2,7% dos pageviews) — perda conhecida e imaterial.

alter table marts.dim_solucao add column if not exists slug text;

create index if not exists dim_solucao_slug_idx on marts.dim_solucao (slug);
-- o casamento é por path exato montado a partir do slug
create index if not exists fact_pageview_path_idx on marts.fact_pageview (path);

create or replace function etl.sync_dim_solucao()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inicio timestamptz := now(); v_n integer;
begin
  insert into marts.dim_solucao as d
    (id, titulo, slug, categoria, dificuldade, area, setor, publicada, em_breve, criada_em, sincronizado_em)
  select s.id, s.title, s.slug, s.category::text, s.difficulty::text, ar.name, se.name,
         coalesce(s.published, false), coalesce(s.coming_soon, false), s.created_at, now()
  from plataforma.solutions s
  left join plataforma.solution_areas ar on ar.id = s.area_id
  left join plataforma.solution_sectors se on se.id = s.sector_id
  on conflict (id) do update set
    titulo = excluded.titulo, slug = excluded.slug, categoria = excluded.categoria,
    dificuldade = excluded.dificuldade, area = excluded.area, setor = excluded.setor,
    publicada = excluded.publicada, em_breve = excluded.em_breve,
    sincronizado_em = excluded.sincronizado_em;

  get diagnostics v_n = row_count;
  insert into etl.sync_state (tabela, watermark, ultima_execucao, ultimas_linhas)
  values ('dim_solucao', now(), now(), v_n)
  on conflict (tabela) do update set watermark = excluded.watermark,
    ultima_execucao = excluded.ultima_execucao, ultimas_linhas = excluded.ultimas_linhas;
  insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, linhas, sucesso)
  values ('dim_solucao', v_inicio, now(), v_n, true);
  return v_n;
exception when others then
  insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, sucesso, erro)
  values ('dim_solucao', v_inicio, now(), false, sqlerrm);
  raise;
end;
$$;

select etl.sync_dim_solucao();

-- ── view e RPCs voltam a ter pageviews, agora sob a régua e_cliente ──────────
drop function if exists public.bi_solucoes_ranking(integer);
drop function if exists public.bi_solucoes_candidatas_remocao();
drop view if exists marts.v_metricas_solucao;

create view marts.v_metricas_solucao as
with pv as (
  select s.id as solution_id, count(*) as pageviews
  from marts.dim_solucao s
  join marts.fact_pageview p on p.path = '/solucoes/' || s.slug
  join marts.dim_usuario u on u.user_id = p.user_id and u.e_cliente
  where s.slug is not null
  group by s.id
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
  select a.solution_id, round(avg(a.nota), 2) as nota, count(*) as avaliacoes
  from marts.fact_avaliacao_solucao a
  join marts.dim_usuario u on u.user_id = a.user_id and u.e_cliente
  group by a.solution_id
),
fav as (
  select f.solution_id, count(*) as favoritos
  from marts.fact_favorito_solucao f
  join marts.dim_usuario u on u.user_id = f.user_id and u.e_cliente
  group by f.solution_id
)
select s.id, s.titulo, s.categoria, s.publicada, s.em_breve,
       coalesce(pv.pageviews, 0) as pageviews,
       coalesce(prog.iniciadas, 0) as iniciadas,
       coalesce(prog.concluidas, 0) as concluidas,
       round(coalesce(prog.concluidas, 0)::numeric / nullif(prog.iniciadas, 0)::numeric, 4) as taxa_conclusao,
       aval.nota,
       coalesce(aval.avaliacoes, 0) as avaliacoes,
       coalesce(fav.favoritos, 0) as favoritos
from marts.dim_solucao s
left join pv   on pv.solution_id   = s.id
left join prog on prog.solution_id = s.id
left join aval on aval.solution_id = s.id
left join fav  on fav.solution_id  = s.id;

comment on view marts.v_metricas_solucao is
  'Métricas por solução sob a régua e_cliente. Pageviews contados por path (/solucoes/<slug>) porque a origem não preenche analytics.solution_id.';

grant select on marts.v_metricas_solucao to authenticated;

create function public.bi_solucoes_ranking(p_limite integer default 20)
returns table (
  solucao text, categoria text, publicada boolean,
  pageviews bigint, iniciadas bigint, concluidas bigint, taxa_conclusao numeric,
  nota numeric, avaliacoes bigint, favoritos bigint
)
language sql stable security invoker set search_path = ''
as $$
  select titulo, categoria, publicada, pageviews, iniciadas, concluidas,
         taxa_conclusao, nota, avaliacoes, favoritos
  from marts.v_metricas_solucao
  where publicada
  order by iniciadas desc
  limit p_limite;
$$;

create function public.bi_solucoes_candidatas_remocao()
returns table (
  solucao text, categoria text, pageviews bigint, iniciadas bigint,
  concluidas bigint, nota numeric, favoritos bigint, motivo text
)
language sql stable security invoker set search_path = ''
as $$
  with base as (
    select * from marts.v_metricas_solucao where publicada and not em_breve
  ),
  corte as (
    select percentile_cont(0.25) within group (order by iniciadas) as p25 from base
  )
  select b.titulo, b.categoria, b.pageviews, b.iniciadas, b.concluidas, b.nota, b.favoritos,
         case
           when b.pageviews = 0 and b.iniciadas = 0 then 'Sem acesso e sem uso'
           when b.iniciadas = 0 then 'Nunca iniciada'
           when b.concluidas = 0 and b.iniciadas <= c.p25 then 'Baixo uso e nenhuma conclusão'
           when b.concluidas = 0 then 'Nenhuma conclusão'
           else 'Baixo uso (quartil inferior)'
         end
  from base b, corte c
  where b.iniciadas <= c.p25 or b.concluidas = 0
  order by b.iniciadas, b.pageviews;
$$;

do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('bi_solucoes_ranking','bi_solucoes_candidatas_remocao')
  loop
    execute format('revoke execute on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
end $$;
