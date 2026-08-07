-- Entrega 5 — Soluções.
-- Semântica validada na origem (2026-08-07):
--   · progress.completion_percentage é BINÁRIO (0 ou 100) e current_module é
--     sempre 0 → NÃO há progresso parcial; "onde trava" vem das abas.
--   · solution_ratings usa escala 0–10 (média 8,76), não 1–5.
--   · Ordem real das abas medida por sequência temporal (ordem média):
--     tools 1,24 → resources 1,99 → video 2,28 → checklist 3,47 →
--     comments 3,69 → completion 4,82 (nunca é a primeira).
--   · fact_progresso_solucao já existe (criado na Entrega 2b).

-- ============ DIMENSÃO ============

create table marts.dim_solucao (
  id uuid primary key,
  titulo text,
  categoria text,
  dificuldade text,
  area text,
  setor text,
  publicada boolean,
  em_breve boolean,
  criada_em timestamptz,
  sincronizado_em timestamptz not null default now()
);
comment on table marts.dim_solucao is 'Catálogo de soluções (full refresh a cada sync).';
alter table marts.dim_solucao enable row level security;
create policy "leitura_bi" on marts.dim_solucao for select to authenticated using (true);
grant select on marts.dim_solucao to authenticated;

-- ============ FATOS ============

create table marts.fact_aba_implementacao (
  id uuid primary key,
  user_id uuid not null,
  solution_id uuid not null,
  aba text not null,
  concluida_em timestamptz,
  sincronizado_em timestamptz not null default now()
);
comment on table marts.fact_aba_implementacao is
  'Espelho incremental de implementation_tab_progress — granularidade real do funil de implementação.';
create index fact_aba_sol_idx on marts.fact_aba_implementacao (solution_id);
create index fact_aba_user_idx on marts.fact_aba_implementacao (user_id);
alter table marts.fact_aba_implementacao enable row level security;
create policy "leitura_bi" on marts.fact_aba_implementacao for select to authenticated using (true);
grant select on marts.fact_aba_implementacao to authenticated;

create table marts.fact_avaliacao_solucao (
  id uuid primary key,
  user_id uuid,
  solution_id uuid not null,
  nota integer not null,
  criado_em timestamptz not null,
  sincronizado_em timestamptz not null default now()
);
comment on table marts.fact_avaliacao_solucao is 'Espelho de solution_ratings (escala 0–10).';
create index fact_aval_sol_idx on marts.fact_avaliacao_solucao (solution_id);
alter table marts.fact_avaliacao_solucao enable row level security;
create policy "leitura_bi" on marts.fact_avaliacao_solucao for select to authenticated using (true);
grant select on marts.fact_avaliacao_solucao to authenticated;

create table marts.fact_favorito_solucao (
  id uuid primary key,
  user_id uuid not null,
  solution_id uuid not null,
  criado_em timestamptz not null
);
comment on table marts.fact_favorito_solucao is 'Espelho de solution_favorites (sinal de interesse).';
create index fact_fav_sol_idx on marts.fact_favorito_solucao (solution_id);
alter table marts.fact_favorito_solucao enable row level security;
create policy "leitura_bi" on marts.fact_favorito_solucao for select to authenticated using (true);
grant select on marts.fact_favorito_solucao to authenticated;

-- ============ SYNCS ============

create or replace function etl.sync_dim_solucao()
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_inicio timestamptz := now(); v_n integer;
begin
  insert into marts.dim_solucao as d
    (id, titulo, categoria, dificuldade, area, setor, publicada, em_breve, criada_em, sincronizado_em)
  select s.id, s.title, s.category::text, s.difficulty::text, ar.name, se.name,
         coalesce(s.published, false), coalesce(s.coming_soon, false), s.created_at, now()
  from plataforma.solutions s
  left join plataforma.solution_areas ar on ar.id = s.area_id
  left join plataforma.solution_sectors se on se.id = s.sector_id
  on conflict (id) do update set
    titulo = excluded.titulo, categoria = excluded.categoria,
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
end; $$;

create or replace function etl.sync_fact_solucoes_apoio(p_max_dias integer default 120)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_inicio timestamptz := now(); v_wm timestamptz; v_ate timestamptz;
  v_a integer; v_b integer; v_c integer;
begin
  select watermark into v_wm from etl.sync_state where tabela = 'fact_solucoes_apoio';
  if v_wm is null then v_wm := timestamptz '2021-01-01 00:00:00-03'; end if;
  v_ate := least(v_wm + make_interval(days => p_max_dias), now() - interval '1 minute');
  if v_ate <= v_wm then
    insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, linhas, sucesso)
    values ('fact_solucoes_apoio', v_inicio, now(), 0, true);
    return 0;
  end if;

  insert into marts.fact_aba_implementacao as d
    (id, user_id, solution_id, aba, concluida_em, sincronizado_em)
  select t.id, t.user_id, t.solution_id, t.tab_id, t.completed_at, now()
  from plataforma.implementation_tab_progress t
  where coalesce(t.updated_at, t.completed_at) > v_wm
    and coalesce(t.updated_at, t.completed_at) <= v_ate
  on conflict (id) do update set
    concluida_em = excluded.concluida_em, sincronizado_em = excluded.sincronizado_em;
  get diagnostics v_a = row_count;

  insert into marts.fact_avaliacao_solucao as d
    (id, user_id, solution_id, nota, criado_em, sincronizado_em)
  select r.id, r.user_id, r.solution_id, r.rating, r.created_at, now()
  from plataforma.solution_ratings r
  where coalesce(r.updated_at, r.created_at) > v_wm
    and coalesce(r.updated_at, r.created_at) <= v_ate
  on conflict (id) do update set
    nota = excluded.nota, sincronizado_em = excluded.sincronizado_em;
  get diagnostics v_b = row_count;

  insert into marts.fact_favorito_solucao (id, user_id, solution_id, criado_em)
  select f.id, f.user_id, f.solution_id, f.created_at
  from plataforma.solution_favorites f
  where f.created_at > v_wm and f.created_at <= v_ate
  on conflict (id) do nothing;
  get diagnostics v_c = row_count;

  insert into etl.sync_state (tabela, watermark, ultima_execucao, ultimas_linhas)
  values ('fact_solucoes_apoio', v_ate, now(), v_a + v_b + v_c)
  on conflict (tabela) do update set watermark = excluded.watermark,
    ultima_execucao = excluded.ultima_execucao, ultimas_linhas = excluded.ultimas_linhas;
  insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, linhas, sucesso)
  values ('fact_solucoes_apoio', v_inicio, now(), v_a + v_b + v_c, true);
  return v_a + v_b + v_c;
exception when others then
  insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, sucesso, erro)
  values ('fact_solucoes_apoio', v_inicio, now(), false, sqlerrm);
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
  begin perform etl.sync_dim_solucao(); exception when others then null; end;
  begin perform etl.sync_fact_solucoes_apoio(); exception when others then null; end;
end; $$;

select etl.sync_dim_solucao();

-- ============ RPCs ============
-- (bi_solucoes_ranking e bi_solucoes_candidatas_remocao são substituídas na
--  migration seguinte por versões otimizadas — a original estourava o timeout)

create or replace function public.bi_solucoes_kpis(p_dias integer default 30)
returns table (
  publicadas bigint, iniciadas_periodo bigint, concluidas_periodo bigint,
  taxa_conclusao_historica numeric
)
language sql stable security invoker set search_path = '' as $$
  with hoje as (select (now() at time zone 'America/Sao_Paulo')::date d)
  select
    (select count(*) from marts.dim_solucao where publicada and not em_breve),
    (select count(*) from marts.fact_progresso_solucao p
      join marts.dim_usuario u on u.user_id = p.user_id and u.e_cliente, hoje h
     where (p.iniciado_em at time zone 'America/Sao_Paulo')::date > h.d - p_dias),
    (select count(*) from marts.fact_progresso_solucao p
      join marts.dim_usuario u on u.user_id = p.user_id and u.e_cliente, hoje h
     where p.concluido_em is not null
       and (p.concluido_em at time zone 'America/Sao_Paulo')::date > h.d - p_dias),
    (select round(count(*) filter (where p.concluido)::numeric / nullif(count(*), 0), 4)
     from marts.fact_progresso_solucao p
     join marts.dim_usuario u on u.user_id = p.user_id and u.e_cliente);
$$;

create or replace function public.bi_solucoes_funil_abas()
returns table (aba text, ordem integer, usuarios bigint, pct_do_topo numeric)
language sql stable security invoker set search_path = '' as $$
  with por_aba as (
    select a.aba, count(distinct a.user_id) as usuarios
    from marts.fact_aba_implementacao a
    join marts.dim_usuario u on u.user_id = a.user_id and u.e_cliente
    where a.concluida_em is not null
    group by a.aba
  ),
  ordenado as (
    select * from (values
      ('tools', 1, 'Ferramentas'),
      ('resources', 2, 'Materiais'),
      ('video', 3, 'Vídeo'),
      ('checklist', 4, 'Checklist'),
      ('comments', 5, 'Comentários'),
      ('completion', 6, 'Conclusão')
    ) as o(aba, ordem, rotulo)
  ),
  topo as (select usuarios from por_aba where aba = 'tools')
  select o.rotulo, o.ordem, coalesce(p.usuarios, 0),
         round(coalesce(p.usuarios, 0)::numeric / nullif((select usuarios from topo), 0), 4)
  from ordenado o
  left join por_aba p on p.aba = o.aba
  order by o.ordem;
$$;

create or replace function public.bi_solucoes_conversao_tela(p_dias integer default 30)
returns table (etapa text, ordem integer, usuarios bigint, pct numeric)
language sql stable security invoker set search_path = '' as $$
  with hoje as (select (now() at time zone 'America/Sao_Paulo')::date d),
  catalogo as (
    select count(distinct pv.user_id) as n
    from marts.fact_pageview pv
    join marts.dim_usuario u on u.user_id = pv.user_id and u.e_cliente, hoje h
    where pv.path = '/solucoes' and pv.data_brt > h.d - p_dias
  ),
  detalhe as (
    select count(distinct pv.user_id) as n
    from marts.fact_pageview pv
    join marts.dim_usuario u on u.user_id = pv.user_id and u.e_cliente, hoje h
    where pv.path like '/solucoes/%' and pv.data_brt > h.d - p_dias
  ),
  iniciou as (
    select count(distinct p.user_id) as n
    from marts.fact_progresso_solucao p
    join marts.dim_usuario u on u.user_id = p.user_id and u.e_cliente, hoje h
    where (p.iniciado_em at time zone 'America/Sao_Paulo')::date > h.d - p_dias
  ),
  concluiu as (
    select count(distinct p.user_id) as n
    from marts.fact_progresso_solucao p
    join marts.dim_usuario u on u.user_id = p.user_id and u.e_cliente, hoje h
    where p.concluido and (p.concluido_em at time zone 'America/Sao_Paulo')::date > h.d - p_dias
  )
  select e.etapa, e.ordem, e.n,
         round(e.n::numeric / nullif((select n from catalogo), 0), 4)
  from (values
    ('Abriu o catálogo /solucoes', 1, (select n from catalogo)),
    ('Abriu alguma solução', 2, (select n from detalhe)),
    ('Iniciou uma solução', 3, (select n from iniciou)),
    ('Concluiu uma solução', 4, (select n from concluiu))
  ) as e(etapa, ordem, n)
  order by e.ordem;
$$;

create or replace function public.bi_solucoes_por_categoria()
returns table (categoria text, solucoes bigint, iniciadas bigint, concluidas bigint, taxa numeric)
language sql stable security invoker set search_path = '' as $$
  select coalesce(s.categoria, '(sem categoria)'),
         count(distinct s.id),
         count(p.id),
         count(p.id) filter (where p.concluido),
         round(count(p.id) filter (where p.concluido)::numeric / nullif(count(p.id), 0), 4)
  from marts.dim_solucao s
  left join marts.fact_progresso_solucao p on p.solution_id = s.id
  where s.publicada
  group by 1
  order by 3 desc;
$$;

revoke execute on function public.bi_solucoes_kpis(integer) from public, anon;
revoke execute on function public.bi_solucoes_funil_abas() from public, anon;
revoke execute on function public.bi_solucoes_conversao_tela(integer) from public, anon;
revoke execute on function public.bi_solucoes_por_categoria() from public, anon;
grant execute on function public.bi_solucoes_kpis(integer) to authenticated;
grant execute on function public.bi_solucoes_funil_abas() to authenticated;
grant execute on function public.bi_solucoes_conversao_tela(integer) to authenticated;
grant execute on function public.bi_solucoes_por_categoria() to authenticated;
