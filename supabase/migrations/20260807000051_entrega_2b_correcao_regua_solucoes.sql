-- Correção de régua da autópsia de churn: "usou Soluções" passa a vir do
-- espelho de `progress` (histórico desde jul/2025), não dos eventos (abr/2026+).
-- Sem isso, churned antigos apareceriam como "nunca usou Soluções" por não
-- existir tracking na época — viés de instrumentação.
-- Contexto (medido na origem): tipos de evento têm início distinto —
-- lesson_completed mai/25 · solution_* abr/26 · consultor mai/26 · builder out/25.

create table marts.fact_progresso_solucao (
  id uuid primary key,
  user_id uuid not null,
  solution_id uuid not null,
  iniciado_em timestamptz,
  concluido boolean not null default false,
  concluido_em timestamptz,
  pct_conclusao integer,
  ultima_atividade timestamptz,
  sincronizado_em timestamptz not null default now()
);

comment on table marts.fact_progresso_solucao is
  'Espelho incremental de progress (soluções) — histórico desde jul/2025. Watermark por last_activity com upsert.';

create index fact_prog_sol_user_idx on marts.fact_progresso_solucao (user_id);
create index fact_prog_sol_solucao_idx on marts.fact_progresso_solucao (solution_id);

alter table marts.fact_progresso_solucao enable row level security;
create policy "leitura_bi" on marts.fact_progresso_solucao for select to authenticated using (true);
grant select on marts.fact_progresso_solucao to authenticated;

create or replace function etl.sync_fact_progresso_solucao(p_max_dias integer default 60)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inicio timestamptz := now();
  v_wm timestamptz;
  v_ate timestamptz;
  v_n integer;
begin
  select watermark into v_wm from etl.sync_state where tabela = 'fact_progresso_solucao';
  if v_wm is null then
    v_wm := timestamptz '2025-07-01 00:00:00-03';
  end if;

  v_ate := least(v_wm + make_interval(days => p_max_dias), now() - interval '1 minute');
  if v_ate <= v_wm then
    insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, linhas, sucesso)
    values ('fact_progresso_solucao', v_inicio, now(), 0, true);
    return 0;
  end if;

  insert into marts.fact_progresso_solucao as d
    (id, user_id, solution_id, iniciado_em, concluido, concluido_em, pct_conclusao, ultima_atividade, sincronizado_em)
  select p.id, p.user_id, p.solution_id, p.created_at,
         coalesce(p.is_completed, false), p.completed_at, p.completion_percentage,
         p.last_activity, now()
  from plataforma.progress p
  where coalesce(p.last_activity, p.created_at) > v_wm
    and coalesce(p.last_activity, p.created_at) <= v_ate
  on conflict (id) do update set
    concluido = excluded.concluido,
    concluido_em = excluded.concluido_em,
    pct_conclusao = excluded.pct_conclusao,
    ultima_atividade = excluded.ultima_atividade,
    sincronizado_em = excluded.sincronizado_em;

  get diagnostics v_n = row_count;

  insert into etl.sync_state (tabela, watermark, ultima_execucao, ultimas_linhas)
  values ('fact_progresso_solucao', v_ate, now(), v_n)
  on conflict (tabela) do update
    set watermark = excluded.watermark,
        ultima_execucao = excluded.ultima_execucao,
        ultimas_linhas = excluded.ultimas_linhas;

  insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, linhas, sucesso)
  values ('fact_progresso_solucao', v_inicio, now(), v_n, true);
  return v_n;
exception when others then
  insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, sucesso, erro)
  values ('fact_progresso_solucao', v_inicio, now(), false, sqlerrm);
  raise;
end;
$$;

create or replace function etl.executar_sync()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    perform etl.sync_dim_usuario();
  exception when others then null;
  end;
  begin
    perform etl.sync_fact_evento();
  exception when others then null;
  end;
  begin
    perform etl.sync_fact_pageview();
  exception when others then null;
  end;
  begin
    perform etl.sync_master_snapshot();
  exception when others then null;
  end;
  begin
    perform etl.sync_fact_progresso_solucao();
  exception when others then null;
  end;
end;
$$;

-- Autópsia v2: fonte certa por módulo + transparência da janela de medição.
-- (drop antes: o tipo de retorno ganhou a coluna medido_desde)
drop function if exists public.bi_churn_modulos();

create function public.bi_churn_modulos()
returns table (
  modulo text, medido_desde date,
  pct_churned_nunca_usou numeric, pct_ativos_nunca_usou numeric, gap_pp numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  with hoje as (select (now() at time zone 'America/Sao_Paulo')::date d),
  vida as (
    select f.user_id, max(f.data_brt) as ultima
    from marts.fact_evento f
    join marts.dim_usuario u on u.user_id = f.user_id and u.e_cliente
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
    round(1 - count(u.user_id) filter (where g.churned)::numeric
      / nullif(count(*) filter (where g.churned), 0), 4),
    round(1 - count(u.user_id) filter (where not g.churned)::numeric
      / nullif(count(*) filter (where not g.churned), 0), 4),
    round((
      (1 - count(u.user_id) filter (where g.churned)::numeric
        / nullif(count(*) filter (where g.churned), 0))
      - (1 - count(u.user_id) filter (where not g.churned)::numeric
        / nullif(count(*) filter (where not g.churned), 0))
    ) * 100, 1)
  from modulos m
  cross join grupos g
  left join usou u on u.user_id = g.user_id and u.modulo = m.modulo
  group by m.modulo, m.medido_desde
  order by 5 desc;
$$;

revoke execute on function public.bi_churn_modulos() from public, anon;
grant execute on function public.bi_churn_modulos() to authenticated;
