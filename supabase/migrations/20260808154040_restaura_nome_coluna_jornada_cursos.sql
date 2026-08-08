-- A recriação de bi_jornada_cursos na migration anterior trocou o nome da
-- coluna de saída (mediana_dias → dias_mediano) sem necessidade. Restaurado.
drop function if exists public.bi_jornada_cursos(integer);

create function public.bi_jornada_cursos(p_min_certificados integer default 20)
returns table (curso text, certificados bigint, mediana_dias numeric)
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

revoke execute on function public.bi_jornada_cursos(integer) from public, anon;
grant execute on function public.bi_jornada_cursos(integer) to authenticated;
