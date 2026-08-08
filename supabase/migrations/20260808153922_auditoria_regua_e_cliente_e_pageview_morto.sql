-- Auditoria de dados (08/ago/2026). Dois defeitos corrigidos aqui.
--
-- 1) RÉGUA `e_cliente` INCONSISTENTE. Parte das RPCs filtrava cliente e parte
--    não — inclusive dentro da MESMA tela e, em v_metricas_solucao, dentro da
--    MESMA LINHA (iniciadas com régua, nota/favoritos sem). Volume interno
--    medido: soluções 8,6% · builder 21,8% · aula 2,5% · NPS 2,6%.
--    Régua unificada abaixo. (fact_navegacao já filtra no sync — E8 estava ok.)
--
-- 2) `fact_pageview.solution_id` É 100% NULO (0 de 383.188). A plataforma não
--    preenche a coluna; o discovery supunha que sim. A coluna "Pageviews" da
--    tela de Soluções exibia 0 em toda linha, com legenda "desde jul/2026" que
--    fazia o zero passar por dado real. Sai da view, das RPCs e da tela.
--    O dado EXISTE no `path` (/solucoes/<slug>) — reintroduzir contando por
--    slug exige `plataforma.solutions.slug` na dim_solucao, o que depende do
--    FDW estar de pé. Registrado no roadmap; até lá, nada falso na tela.

drop function if exists public.bi_solucoes_ranking(integer);
drop function if exists public.bi_solucoes_candidatas_remocao();
drop function if exists public.bi_solucoes_por_categoria();
drop function if exists public.bi_duracao_ideal();
drop function if exists public.bi_dropoff_posicao();
drop function if exists public.bi_jornada_cursos(integer);
drop function if exists public.bi_nps_cursos(integer);
drop function if exists public.bi_builder_steps(integer);
drop view if exists marts.v_metricas_solucao;

-- ── 1. Soluções ──────────────────────────────────────────────────────────────
create view marts.v_metricas_solucao as
with prog as (
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
       coalesce(prog.iniciadas, 0) as iniciadas,
       coalesce(prog.concluidas, 0) as concluidas,
       round(coalesce(prog.concluidas, 0)::numeric / nullif(prog.iniciadas, 0)::numeric, 4) as taxa_conclusao,
       aval.nota,
       coalesce(aval.avaliacoes, 0) as avaliacoes,
       coalesce(fav.favoritos, 0) as favoritos
from marts.dim_solucao s
left join prog on prog.solution_id = s.id
left join aval on aval.solution_id = s.id
left join fav  on fav.solution_id  = s.id;

comment on view marts.v_metricas_solucao is
  'Métricas por solução, todas sob a régua e_cliente. Sem pageviews: a origem não preenche analytics.solution_id.';

grant select on marts.v_metricas_solucao to authenticated;

create function public.bi_solucoes_ranking(p_limite integer default 20)
returns table (
  solucao text, categoria text, publicada boolean,
  iniciadas bigint, concluidas bigint, taxa_conclusao numeric,
  nota numeric, avaliacoes bigint, favoritos bigint
)
language sql stable security invoker set search_path = ''
as $$
  select titulo, categoria, publicada, iniciadas, concluidas,
         taxa_conclusao, nota, avaliacoes, favoritos
  from marts.v_metricas_solucao
  where publicada
  order by iniciadas desc
  limit p_limite;
$$;

create function public.bi_solucoes_candidatas_remocao()
returns table (
  solucao text, categoria text, iniciadas bigint, concluidas bigint,
  nota numeric, favoritos bigint, motivo text
)
language sql stable security invoker set search_path = ''
as $$
  with base as (
    select * from marts.v_metricas_solucao where publicada and not em_breve
  ),
  corte as (
    select percentile_cont(0.25) within group (order by iniciadas) as p25 from base
  )
  select b.titulo, b.categoria, b.iniciadas, b.concluidas, b.nota, b.favoritos,
         case
           when b.iniciadas = 0 then 'Nunca iniciada'
           when b.concluidas = 0 and b.iniciadas <= c.p25 then 'Baixo uso e nenhuma conclusão'
           when b.concluidas = 0 then 'Nenhuma conclusão'
           else 'Baixo uso (quartil inferior)'
         end
  from base b, corte c
  where b.iniciadas <= c.p25 or b.concluidas = 0
  order by b.iniciadas, b.concluidas;
$$;

create function public.bi_solucoes_por_categoria()
returns table (
  categoria text, solucoes bigint, iniciadas bigint,
  concluidas bigint, taxa_conclusao numeric
)
language sql stable security invoker set search_path = ''
as $$
  select coalesce(s.categoria, '(sem categoria)'),
         count(distinct s.id),
         count(p.id),
         count(p.id) filter (where p.concluido),
         round(count(p.id) filter (where p.concluido)::numeric / nullif(count(p.id), 0), 4)
  from marts.dim_solucao s
  left join marts.fact_progresso_solucao p on p.solution_id = s.id
  left join marts.dim_usuario u on u.user_id = p.user_id and u.e_cliente
  where s.publicada and (p.id is null or u.user_id is not null)
  group by 1
  order by 3 desc;
$$;

-- índice sobre coluna 100% nula: sem uso possível enquanto a origem não preencher
drop index if exists marts.fact_pageview_solucao_idx;

-- ── 2. Formações ─────────────────────────────────────────────────────────────
create function public.bi_duracao_ideal()
returns table (faixa text, ordem integer, aulas bigint, taxa_media numeric)
language sql stable security invoker set search_path = ''
as $$
  with conc as (
    select a.curso_id, a.id as lesson_id, a.duracao_s, count(*) as n
    from marts.dim_aula a
    join marts.fact_progresso_aula f on f.lesson_id = a.id and f.concluido_em is not null
    join marts.dim_usuario u on u.user_id = f.user_id and u.e_cliente
    where a.publicada and a.duracao_s > 0
    group by a.curso_id, a.id, a.duracao_s
  ),
  cursos_estaveis as (
    select curso_id, max(n) as mx from conc group by curso_id having max(n) >= 50
  ),
  taxas as (
    select c.duracao_s, c.n::numeric / ce.mx as taxa
    from conc c join cursos_estaveis ce on ce.curso_id = c.curso_id
  )
  select faixa, ordem, count(*), round(avg(taxa), 4)
  from (
    select taxa,
      case
        when duracao_s < 300 then 'Até 5 min' when duracao_s < 600 then '5–10 min'
        when duracao_s < 1200 then '10–20 min' when duracao_s < 1800 then '20–30 min'
        when duracao_s < 3600 then '30–60 min' else '60+ min'
      end as faixa,
      case
        when duracao_s < 300 then 1 when duracao_s < 600 then 2
        when duracao_s < 1200 then 3 when duracao_s < 1800 then 4
        when duracao_s < 3600 then 5 else 6
      end as ordem
    from taxas
  ) s
  group by faixa, ordem order by ordem;
$$;

create function public.bi_dropoff_posicao()
returns table (decil integer, taxa_media numeric)
language sql stable security invoker set search_path = ''
as $$
  with conc as (
    select a.curso_id, a.posicao, count(*) as n
    from marts.dim_aula a
    join marts.fact_progresso_aula f on f.lesson_id = a.id and f.concluido_em is not null
    join marts.dim_usuario u on u.user_id = f.user_id and u.e_cliente
    where a.publicada
    group by a.curso_id, a.posicao
  ),
  total_curso as (select curso_id, max(posicao) as total from conc group by curso_id),
  base as (select c.curso_id, c.n as base_n from conc c where c.posicao = 1 and c.n >= 50),
  taxas as (
    select ceil(c.posicao * 10.0 / t.total)::integer as decil, c.n::numeric / b.base_n as taxa
    from conc c
    join total_curso t on t.curso_id = c.curso_id
    join base b on b.curso_id = c.curso_id
    where t.total >= 10
  )
  select decil, round(avg(taxa), 4) from taxas group by decil order by decil;
$$;

create function public.bi_jornada_cursos(p_min_certificados integer default 20)
returns table (curso text, certificados bigint, dias_mediano numeric)
language sql stable security invoker set search_path = ''
as $$
  with inicio as (
    select a.curso_id, f.user_id, min(f.iniciado_em) as comecou
    from marts.fact_progresso_aula f
    join marts.dim_aula a on a.id = f.lesson_id
    join marts.dim_usuario u on u.user_id = f.user_id and u.e_cliente
    group by a.curso_id, f.user_id
  )
  select c.titulo, count(*),
         round(percentile_cont(0.5) within group (
           order by extract(epoch from ce.emitido_em - i.comecou) / 86400.0
         )::numeric, 1)
  from marts.fact_certificado ce
  join inicio i on i.curso_id = ce.curso_id and i.user_id = ce.user_id
  join marts.dim_curso c on c.id = ce.curso_id
  where ce.emitido_em > i.comecou
  group by c.id, c.titulo
  having count(*) >= p_min_certificados
  order by 3;
$$;

create function public.bi_nps_cursos(p_min_respostas integer default 30)
returns table (
  curso text, respostas bigint, media numeric,
  pct_promotores numeric, pct_detratores numeric
)
language sql stable security invoker set search_path = ''
as $$
  select c.titulo, count(*), round(avg(n.score), 2),
         round(count(*) filter (where n.score >= 9)::numeric / count(*), 4),
         round(count(*) filter (where n.score <= 6)::numeric / count(*), 4)
  from marts.fact_nps_aula n
  join marts.dim_usuario u on u.user_id = n.user_id and u.e_cliente
  join marts.dim_aula a on a.id = n.lesson_id
  join marts.dim_curso c on c.id = a.curso_id
  group by c.id, c.titulo
  having count(*) >= p_min_respostas
  order by 3 asc;
$$;

-- ── 3. Builder ───────────────────────────────────────────────────────────────
create function public.bi_builder_steps(p_dias integer default 90)
returns table (step text, geracoes bigint, pct_erro numeric, segundos_medio numeric)
language sql stable security invoker set search_path = ''
as $$
  select s.step,
         count(*),
         round(100.0 * count(*) filter (where s.status = 'error') / count(*), 2),
         round(avg(s.tempo_ms) filter (where s.status = 'completed') / 1000.0, 1)
  from marts.fact_builder_step s
  join marts.fact_builder_solucao b on b.id = s.solution_id
  join marts.dim_usuario u on u.user_id = b.user_id and u.e_cliente
  where (s.criado_em at time zone 'America/Sao_Paulo')::date
        > (now() at time zone 'America/Sao_Paulo')::date - p_dias
  group by s.step
  having count(*) >= 20
  order by 4 desc nulls last;
$$;

-- ── 4. Permissões ────────────────────────────────────────────────────────────
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('bi_solucoes_ranking','bi_solucoes_candidatas_remocao',
                        'bi_solucoes_por_categoria','bi_duracao_ideal','bi_dropoff_posicao',
                        'bi_jornada_cursos','bi_nps_cursos','bi_builder_steps')
  loop
    execute format('revoke execute on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
end $$;
