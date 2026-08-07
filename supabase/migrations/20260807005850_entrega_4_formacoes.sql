-- Entrega 4 — Formações.
-- Semântica validada na origem (2026-08-07): learning_progress tem started_at
-- sempre preenchido e completed_at em 98,5%; NPS escala 0–10 (média 9,48 —
-- viés de positividade, reportar detratores); certificados usam issued_at
-- (completion_date é ~sempre nulo); duração por aula = soma dos vídeos.
-- RESULTADO-CHAVE (validado): conclusão normalizada cai monotonicamente com a
-- duração — até 5min 74,7% · 5–10 70,4% · 10–20 65,2% · 20–30 56,6% · 30–60 36,3%.

-- ============ DIMENSÕES (full refresh) ============

create table marts.dim_curso (
  id uuid primary key,
  titulo text,
  categoria text,
  nivel text,
  publicado boolean,
  total_aulas integer,
  duracao_total_s integer,
  sincronizado_em timestamptz not null default now()
);
comment on table marts.dim_curso is 'Catálogo de formações (full refresh a cada sync).';
alter table marts.dim_curso enable row level security;
create policy "leitura_bi" on marts.dim_curso for select to authenticated using (true);
grant select on marts.dim_curso to authenticated;

create table marts.dim_aula (
  id uuid primary key,
  curso_id uuid,
  titulo text,
  posicao integer,
  duracao_s integer,
  publicada boolean,
  sincronizado_em timestamptz not null default now()
);
comment on table marts.dim_aula is 'Aulas com posição sequencial no curso e duração (soma dos vídeos).';
create index dim_aula_curso_idx on marts.dim_aula (curso_id);
alter table marts.dim_aula enable row level security;
create policy "leitura_bi" on marts.dim_aula for select to authenticated using (true);
grant select on marts.dim_aula to authenticated;

-- ============ FATOS ============

create table marts.fact_progresso_aula (
  id uuid primary key,
  user_id uuid not null,
  lesson_id uuid not null,
  iniciado_em timestamptz,
  concluido_em timestamptz,
  pct integer,
  sincronizado_em timestamptz not null default now()
);
comment on table marts.fact_progresso_aula is 'Espelho incremental de learning_progress (watermark updated_at, upsert).';
create index fact_prog_aula_user_idx on marts.fact_progresso_aula (user_id);
create index fact_prog_aula_aula_idx on marts.fact_progresso_aula (lesson_id);
create index fact_prog_aula_conc_idx on marts.fact_progresso_aula (concluido_em);
alter table marts.fact_progresso_aula enable row level security;
create policy "leitura_bi" on marts.fact_progresso_aula for select to authenticated using (true);
grant select on marts.fact_progresso_aula to authenticated;

create table marts.fact_certificado (
  id uuid primary key,
  user_id uuid not null,
  curso_id uuid not null,
  emitido_em timestamptz not null,
  sincronizado_em timestamptz not null default now()
);
comment on table marts.fact_certificado is 'Espelho incremental de learning_certificates.';
create index fact_cert_curso_idx on marts.fact_certificado (curso_id);
create index fact_cert_user_idx on marts.fact_certificado (user_id);
alter table marts.fact_certificado enable row level security;
create policy "leitura_bi" on marts.fact_certificado for select to authenticated using (true);
grant select on marts.fact_certificado to authenticated;

create table marts.fact_nps_aula (
  id uuid primary key,
  user_id uuid,
  lesson_id uuid not null,
  score integer not null,
  criado_em timestamptz not null,
  sincronizado_em timestamptz not null default now()
);
comment on table marts.fact_nps_aula is 'Espelho incremental de learning_lesson_nps (escala 0–10).';
create index fact_nps_aula_idx on marts.fact_nps_aula (lesson_id);
alter table marts.fact_nps_aula enable row level security;
create policy "leitura_bi" on marts.fact_nps_aula for select to authenticated using (true);
grant select on marts.fact_nps_aula to authenticated;

-- ============ SYNCS ============

create or replace function etl.sync_dim_learning()
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_inicio timestamptz := now(); v_n integer; v_n2 integer;
begin
  -- cursos
  insert into marts.dim_curso as d (id, titulo, categoria, nivel, publicado, total_aulas, duracao_total_s, sincronizado_em)
  select c.id, c.title, c.category, c.level, coalesce(c.published, false),
         (select count(*) from plataforma.learning_lessons l
            join plataforma.learning_modules m on m.id = l.module_id
           where m.course_id = c.id and coalesce(l.published, false)),
         cd.total_duration_seconds,
         now()
  from plataforma.learning_courses c
  left join plataforma.course_durations cd on cd.course_id = c.id
  on conflict (id) do update set
    titulo = excluded.titulo, categoria = excluded.categoria, nivel = excluded.nivel,
    publicado = excluded.publicado, total_aulas = excluded.total_aulas,
    duracao_total_s = excluded.duracao_total_s, sincronizado_em = excluded.sincronizado_em;
  get diagnostics v_n = row_count;

  -- aulas com posição sequencial e duração
  insert into marts.dim_aula as d (id, curso_id, titulo, posicao, duracao_s, publicada, sincronizado_em)
  select l.id, m.course_id, l.title,
         row_number() over (partition by m.course_id order by m.order_index, l.order_index),
         (select coalesce(sum(v.duration_seconds), 0) from plataforma.learning_lesson_videos v where v.lesson_id = l.id),
         coalesce(l.published, false),
         now()
  from plataforma.learning_lessons l
  join plataforma.learning_modules m on m.id = l.module_id
  on conflict (id) do update set
    curso_id = excluded.curso_id, titulo = excluded.titulo, posicao = excluded.posicao,
    duracao_s = excluded.duracao_s, publicada = excluded.publicada,
    sincronizado_em = excluded.sincronizado_em;
  get diagnostics v_n2 = row_count;

  insert into etl.sync_state (tabela, watermark, ultima_execucao, ultimas_linhas)
  values ('dim_learning', now(), now(), v_n + v_n2)
  on conflict (tabela) do update set watermark = excluded.watermark,
    ultima_execucao = excluded.ultima_execucao, ultimas_linhas = excluded.ultimas_linhas;
  insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, linhas, sucesso)
  values ('dim_learning', v_inicio, now(), v_n + v_n2, true);
  return v_n + v_n2;
exception when others then
  insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, sucesso, erro)
  values ('dim_learning', v_inicio, now(), false, sqlerrm);
  raise;
end; $$;

create or replace function etl.sync_fact_progresso_aula(p_max_dias integer default 60)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_inicio timestamptz := now(); v_wm timestamptz; v_ate timestamptz; v_n integer;
begin
  select watermark into v_wm from etl.sync_state where tabela = 'fact_progresso_aula';
  if v_wm is null then v_wm := timestamptz '2025-05-01 00:00:00-03'; end if;
  v_ate := least(v_wm + make_interval(days => p_max_dias), now() - interval '1 minute');
  if v_ate <= v_wm then
    insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, linhas, sucesso)
    values ('fact_progresso_aula', v_inicio, now(), 0, true);
    return 0;
  end if;

  insert into marts.fact_progresso_aula as d
    (id, user_id, lesson_id, iniciado_em, concluido_em, pct, sincronizado_em)
  select p.id, p.user_id, p.lesson_id, p.started_at, p.completed_at, p.progress_percentage, now()
  from plataforma.learning_progress p
  where coalesce(p.updated_at, p.created_at) > v_wm
    and coalesce(p.updated_at, p.created_at) <= v_ate
  on conflict (id) do update set
    concluido_em = excluded.concluido_em,
    pct = excluded.pct,
    sincronizado_em = excluded.sincronizado_em;

  get diagnostics v_n = row_count;
  insert into etl.sync_state (tabela, watermark, ultima_execucao, ultimas_linhas)
  values ('fact_progresso_aula', v_ate, now(), v_n)
  on conflict (tabela) do update set watermark = excluded.watermark,
    ultima_execucao = excluded.ultima_execucao, ultimas_linhas = excluded.ultimas_linhas;
  insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, linhas, sucesso)
  values ('fact_progresso_aula', v_inicio, now(), v_n, true);
  return v_n;
exception when others then
  insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, sucesso, erro)
  values ('fact_progresso_aula', v_inicio, now(), false, sqlerrm);
  raise;
end; $$;

create or replace function etl.sync_fact_certificado(p_max_dias integer default 120)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_inicio timestamptz := now(); v_wm timestamptz; v_ate timestamptz; v_n integer;
begin
  select watermark into v_wm from etl.sync_state where tabela = 'fact_certificado';
  if v_wm is null then v_wm := timestamptz '2025-08-01 00:00:00-03'; end if;
  v_ate := least(v_wm + make_interval(days => p_max_dias), now() - interval '1 minute');
  if v_ate <= v_wm then
    insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, linhas, sucesso)
    values ('fact_certificado', v_inicio, now(), 0, true);
    return 0;
  end if;

  insert into marts.fact_certificado (id, user_id, curso_id, emitido_em)
  select c.id, c.user_id, c.course_id, c.issued_at
  from plataforma.learning_certificates c
  where c.issued_at > v_wm and c.issued_at <= v_ate
  on conflict (id) do nothing;

  get diagnostics v_n = row_count;
  insert into etl.sync_state (tabela, watermark, ultima_execucao, ultimas_linhas)
  values ('fact_certificado', v_ate, now(), v_n)
  on conflict (tabela) do update set watermark = excluded.watermark,
    ultima_execucao = excluded.ultima_execucao, ultimas_linhas = excluded.ultimas_linhas;
  insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, linhas, sucesso)
  values ('fact_certificado', v_inicio, now(), v_n, true);
  return v_n;
exception when others then
  insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, sucesso, erro)
  values ('fact_certificado', v_inicio, now(), false, sqlerrm);
  raise;
end; $$;

create or replace function etl.sync_fact_nps_aula(p_max_dias integer default 120)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_inicio timestamptz := now(); v_wm timestamptz; v_ate timestamptz; v_n integer;
begin
  select watermark into v_wm from etl.sync_state where tabela = 'fact_nps_aula';
  if v_wm is null then v_wm := timestamptz '2025-05-01 00:00:00-03'; end if;
  v_ate := least(v_wm + make_interval(days => p_max_dias), now() - interval '1 minute');
  if v_ate <= v_wm then
    insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, linhas, sucesso)
    values ('fact_nps_aula', v_inicio, now(), 0, true);
    return 0;
  end if;

  insert into marts.fact_nps_aula as d (id, user_id, lesson_id, score, criado_em, sincronizado_em)
  select n.id, n.user_id, n.lesson_id, n.score, n.created_at, now()
  from plataforma.learning_lesson_nps n
  where coalesce(n.updated_at, n.created_at) > v_wm
    and coalesce(n.updated_at, n.created_at) <= v_ate
  on conflict (id) do update set
    score = excluded.score, sincronizado_em = excluded.sincronizado_em;

  get diagnostics v_n = row_count;
  insert into etl.sync_state (tabela, watermark, ultima_execucao, ultimas_linhas)
  values ('fact_nps_aula', v_ate, now(), v_n)
  on conflict (tabela) do update set watermark = excluded.watermark,
    ultima_execucao = excluded.ultima_execucao, ultimas_linhas = excluded.ultimas_linhas;
  insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, linhas, sucesso)
  values ('fact_nps_aula', v_inicio, now(), v_n, true);
  return v_n;
exception when others then
  insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, sucesso, erro)
  values ('fact_nps_aula', v_inicio, now(), false, sqlerrm);
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
end; $$;

-- carga inicial das dimensões
select etl.sync_dim_learning();

-- ============ RPCs ============

create or replace function public.bi_formacoes_kpis(p_dias integer default 30)
returns table (
  alunos_ativos bigint, aulas_concluidas bigint, certificados bigint, nps_medio numeric
)
language sql stable security invoker set search_path = '' as $$
  with hoje as (select (now() at time zone 'America/Sao_Paulo')::date d)
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
     from marts.fact_nps_aula n, hoje h
     where (n.criado_em at time zone 'America/Sao_Paulo')::date > h.d - p_dias);
$$;

create or replace function public.bi_formacoes_uso(p_dias integer default 30)
returns table (
  curso text, categoria text,
  alunos bigint, aulas_concluidas bigint,
  alunos_historico bigint, certificados_historico bigint, conclusao_historica numeric
)
language sql stable security invoker set search_path = '' as $$
  with hoje as (select (now() at time zone 'America/Sao_Paulo')::date d),
  progresso as (
    select a.curso_id, f.user_id, f.concluido_em
    from marts.fact_progresso_aula f
    join marts.dim_aula a on a.id = f.lesson_id
    join marts.dim_usuario u on u.user_id = f.user_id and u.e_cliente
    where f.concluido_em is not null
  )
  select
    c.titulo, c.categoria,
    count(distinct p.user_id) filter (where (p.concluido_em at time zone 'America/Sao_Paulo')::date > h.d - p_dias),
    count(*) filter (where (p.concluido_em at time zone 'America/Sao_Paulo')::date > h.d - p_dias),
    count(distinct p.user_id),
    (select count(*) from marts.fact_certificado ce
      join marts.dim_usuario u2 on u2.user_id = ce.user_id and u2.e_cliente
      where ce.curso_id = c.id),
    round(
      (select count(distinct ce.user_id) from marts.fact_certificado ce
        join marts.dim_usuario u2 on u2.user_id = ce.user_id and u2.e_cliente
        where ce.curso_id = c.id)::numeric
      / nullif(count(distinct p.user_id), 0), 4)
  from marts.dim_curso c
  left join progresso p on p.curso_id = c.id
  cross join hoje h
  where c.publicado
  group by c.id, c.titulo, c.categoria, h.d
  order by 3 desc nulls last;
$$;

create or replace function public.bi_duracao_ideal()
returns table (faixa text, ordem integer, aulas bigint, taxa_media numeric)
language sql stable security invoker set search_path = '' as $$
  with conc as (
    select a.curso_id, a.id as lesson_id, a.duracao_s, count(*) as n
    from marts.dim_aula a
    join marts.fact_progresso_aula f on f.lesson_id = a.id and f.concluido_em is not null
    where a.publicada and a.duracao_s > 0
    group by a.curso_id, a.id, a.duracao_s
  ),
  cursos_estaveis as (
    select curso_id, max(n) as mx from conc group by curso_id having max(n) >= 50
  ),
  taxas as (
    select c.duracao_s, c.n::numeric / ce.mx as taxa
    from conc c
    join cursos_estaveis ce on ce.curso_id = c.curso_id
  )
  select faixa, ordem, count(*), round(avg(taxa), 4)
  from (
    select taxa,
      case
        when duracao_s < 300 then 'Até 5 min'
        when duracao_s < 600 then '5–10 min'
        when duracao_s < 1200 then '10–20 min'
        when duracao_s < 1800 then '20–30 min'
        when duracao_s < 3600 then '30–60 min'
        else '60+ min'
      end as faixa,
      case
        when duracao_s < 300 then 1
        when duracao_s < 600 then 2
        when duracao_s < 1200 then 3
        when duracao_s < 1800 then 4
        when duracao_s < 3600 then 5
        else 6
      end as ordem
    from taxas
  ) s
  group by faixa, ordem
  order by ordem;
$$;

create or replace function public.bi_dropoff_posicao()
returns table (decil integer, taxa_media numeric)
language sql stable security invoker set search_path = '' as $$
  with conc as (
    select a.curso_id, a.posicao, count(*) as n
    from marts.dim_aula a
    join marts.fact_progresso_aula f on f.lesson_id = a.id and f.concluido_em is not null
    where a.publicada
    group by a.curso_id, a.posicao
  ),
  total_curso as (
    select curso_id, max(posicao) as total from conc group by curso_id
  ),
  base as (
    select c.curso_id, c.n as base_n
    from conc c
    where c.posicao = 1 and c.n >= 50
  ),
  taxas as (
    select ceil(c.posicao * 10.0 / t.total)::integer as decil,
           c.n::numeric / b.base_n as taxa
    from conc c
    join total_curso t on t.curso_id = c.curso_id
    join base b on b.curso_id = c.curso_id
    where t.total >= 10
  )
  select decil, round(avg(taxa), 4)
  from taxas
  group by decil
  order by decil;
$$;

create or replace function public.bi_nps_cursos(p_min_respostas integer default 10)
returns table (
  curso text, respostas bigint, media numeric, pct_promotores numeric, pct_detratores numeric
)
language sql stable security invoker set search_path = '' as $$
  select c.titulo, count(*),
         round(avg(n.score), 2),
         round(count(*) filter (where n.score >= 9)::numeric / count(*), 4),
         round(count(*) filter (where n.score <= 6)::numeric / count(*), 4)
  from marts.fact_nps_aula n
  join marts.dim_aula a on a.id = n.lesson_id
  join marts.dim_curso c on c.id = a.curso_id
  group by c.id, c.titulo
  having count(*) >= p_min_respostas
  order by 3 asc;
$$;

create or replace function public.bi_jornada_cursos(p_min_certificados integer default 20)
returns table (curso text, certificados bigint, mediana_dias numeric)
language sql stable security invoker set search_path = '' as $$
  with inicio as (
    select a.curso_id, f.user_id, min(f.iniciado_em) as comecou
    from marts.fact_progresso_aula f
    join marts.dim_aula a on a.id = f.lesson_id
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

create or replace function public.bi_assuntos(p_dias integer default 30)
returns table (categoria text, aulas_concluidas bigint, alunos bigint)
language sql stable security invoker set search_path = '' as $$
  select coalesce(c.categoria, '(sem categoria)'),
         count(*),
         count(distinct f.user_id)
  from marts.fact_progresso_aula f
  join marts.dim_aula a on a.id = f.lesson_id
  join marts.dim_curso c on c.id = a.curso_id
  join marts.dim_usuario u on u.user_id = f.user_id and u.e_cliente
  where f.concluido_em is not null
    and (f.concluido_em at time zone 'America/Sao_Paulo')::date
        > (now() at time zone 'America/Sao_Paulo')::date - p_dias
  group by 1
  order by 2 desc;
$$;

revoke execute on function public.bi_formacoes_kpis(integer) from public, anon;
revoke execute on function public.bi_formacoes_uso(integer) from public, anon;
revoke execute on function public.bi_duracao_ideal() from public, anon;
revoke execute on function public.bi_dropoff_posicao() from public, anon;
revoke execute on function public.bi_nps_cursos(integer) from public, anon;
revoke execute on function public.bi_jornada_cursos(integer) from public, anon;
revoke execute on function public.bi_assuntos(integer) from public, anon;
grant execute on function public.bi_formacoes_kpis(integer) to authenticated;
grant execute on function public.bi_formacoes_uso(integer) to authenticated;
grant execute on function public.bi_duracao_ideal() to authenticated;
grant execute on function public.bi_dropoff_posicao() to authenticated;
grant execute on function public.bi_nps_cursos(integer) to authenticated;
grant execute on function public.bi_jornada_cursos(integer) to authenticated;
grant execute on function public.bi_assuntos(integer) to authenticated;
