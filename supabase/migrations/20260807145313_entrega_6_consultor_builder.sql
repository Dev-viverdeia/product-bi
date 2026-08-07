-- Entrega 6 — Consultor & Builder.
-- Validado na origem (2026-08-07):
--   · Consultor: 2 modos (chat, planejamento), 2.439 usuários, 52k mensagens
--     (roles user/assistant), tracking desde mai/2026 (= lançamento).
--   · Builder: 2.582 usuários, 6.727 soluções, 37k gerações de step em 19 steps
--     distintos; status completed/error/pending.
--   · Taxa de erro por step é BAIXA (<0,5%), mas os tempos são altos
--     (doc_plano 87s, estrutura 83s, prompt_lovable 68s).
-- Lição da E5 aplicada: agregações por view, nunca subquery correlacionada.

-- ============ MARTS ============

create table marts.fact_consultor_thread (
  id uuid primary key,
  user_id uuid not null,
  modo text,
  mensagens integer,
  criado_em timestamptz not null,
  sincronizado_em timestamptz not null default now()
);
comment on table marts.fact_consultor_thread is
  'Espelho incremental de consultor_threads (uma linha por conversa).';
create index fact_cons_thread_user_idx on marts.fact_consultor_thread (user_id);
create index fact_cons_thread_data_idx on marts.fact_consultor_thread (criado_em);
alter table marts.fact_consultor_thread enable row level security;
create policy "leitura_bi" on marts.fact_consultor_thread for select to authenticated using (true);
grant select on marts.fact_consultor_thread to authenticated;

-- Mensagens agregadas por usuário+dia (52k linhas viram poucos milhares e o
-- conteúdo das conversas — dado sensível — nunca sai da plataforma).
create table marts.fact_consultor_uso_diario (
  user_id uuid not null,
  data_brt date not null,
  mensagens_usuario integer not null default 0,
  mensagens_assistente integer not null default 0,
  tokens_entrada bigint not null default 0,
  tokens_saida bigint not null default 0,
  sincronizado_em timestamptz not null default now(),
  primary key (user_id, data_brt)
);
comment on table marts.fact_consultor_uso_diario is
  'Uso do Consultor agregado por usuário+dia — o TEXTO das mensagens nunca é copiado para o BI.';
create index fact_cons_uso_data_idx on marts.fact_consultor_uso_diario (data_brt);
alter table marts.fact_consultor_uso_diario enable row level security;
create policy "leitura_bi" on marts.fact_consultor_uso_diario for select to authenticated using (true);
grant select on marts.fact_consultor_uso_diario to authenticated;

create table marts.fact_builder_solucao (
  id uuid primary key,
  user_id uuid not null,
  criado_em timestamptz not null,
  completa boolean,
  status_geracao text,
  versao text,
  tempo_geracao_ms integer,
  sincronizado_em timestamptz not null default now()
);
comment on table marts.fact_builder_solucao is 'Espelho incremental de ai_generated_solutions.';
create index fact_builder_sol_user_idx on marts.fact_builder_solucao (user_id);
create index fact_builder_sol_data_idx on marts.fact_builder_solucao (criado_em);
alter table marts.fact_builder_solucao enable row level security;
create policy "leitura_bi" on marts.fact_builder_solucao for select to authenticated using (true);
grant select on marts.fact_builder_solucao to authenticated;

create table marts.fact_builder_step (
  id uuid primary key,
  solution_id uuid,
  step text not null,
  status text,
  tempo_ms integer,
  modelo text,
  criado_em timestamptz not null,
  sincronizado_em timestamptz not null default now()
);
comment on table marts.fact_builder_step is
  'Espelho incremental de builder_v2_step_generations (confiabilidade e tempo por etapa).';
create index fact_builder_step_data_idx on marts.fact_builder_step (criado_em);
create index fact_builder_step_step_idx on marts.fact_builder_step (step);
alter table marts.fact_builder_step enable row level security;
create policy "leitura_bi" on marts.fact_builder_step for select to authenticated using (true);
grant select on marts.fact_builder_step to authenticated;

-- ============ SYNCS ============

create or replace function etl.sync_fact_consultor(p_max_dias integer default 60)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_inicio timestamptz := now(); v_wm timestamptz; v_ate timestamptz;
  v_a integer; v_b integer;
begin
  select watermark into v_wm from etl.sync_state where tabela = 'fact_consultor';
  if v_wm is null then v_wm := timestamptz '2026-05-01 00:00:00-03'; end if;
  v_ate := least(v_wm + make_interval(days => p_max_dias), now() - interval '1 minute');
  if v_ate <= v_wm then
    insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, linhas, sucesso)
    values ('fact_consultor', v_inicio, now(), 0, true);
    return 0;
  end if;

  insert into marts.fact_consultor_thread as d
    (id, user_id, modo, mensagens, criado_em, sincronizado_em)
  select t.id, t.user_id, t.mode, t.message_count, t.created_at, now()
  from plataforma.consultor_threads t
  where coalesce(t.updated_at, t.created_at) > v_wm
    and coalesce(t.updated_at, t.created_at) <= v_ate
  on conflict (id) do update set
    modo = excluded.modo, mensagens = excluded.mensagens,
    sincronizado_em = excluded.sincronizado_em;
  get diagnostics v_a = row_count;

  -- agregação por usuário+dia (sem copiar o conteúdo das mensagens)
  insert into marts.fact_consultor_uso_diario as d
    (user_id, data_brt, mensagens_usuario, mensagens_assistente, tokens_entrada, tokens_saida, sincronizado_em)
  select m.user_id,
         (m.created_at at time zone 'America/Sao_Paulo')::date,
         count(*) filter (where m.role = 'user'),
         count(*) filter (where m.role = 'assistant'),
         coalesce(sum(m.llm_input_tokens), 0),
         coalesce(sum(m.llm_output_tokens), 0),
         now()
  from plataforma.consultor_messages m
  where m.created_at > v_wm and m.created_at <= v_ate and m.user_id is not null
  group by m.user_id, (m.created_at at time zone 'America/Sao_Paulo')::date
  on conflict (user_id, data_brt) do update set
    mensagens_usuario = excluded.mensagens_usuario,
    mensagens_assistente = excluded.mensagens_assistente,
    tokens_entrada = excluded.tokens_entrada,
    tokens_saida = excluded.tokens_saida,
    sincronizado_em = excluded.sincronizado_em;
  get diagnostics v_b = row_count;

  insert into etl.sync_state (tabela, watermark, ultima_execucao, ultimas_linhas)
  values ('fact_consultor', v_ate, now(), v_a + v_b)
  on conflict (tabela) do update set watermark = excluded.watermark,
    ultima_execucao = excluded.ultima_execucao, ultimas_linhas = excluded.ultimas_linhas;
  insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, linhas, sucesso)
  values ('fact_consultor', v_inicio, now(), v_a + v_b, true);
  return v_a + v_b;
exception when others then
  insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, sucesso, erro)
  values ('fact_consultor', v_inicio, now(), false, sqlerrm);
  raise;
end; $$;

create or replace function etl.sync_fact_builder(p_max_dias integer default 90)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_inicio timestamptz := now(); v_wm timestamptz; v_ate timestamptz;
  v_a integer; v_b integer;
begin
  select watermark into v_wm from etl.sync_state where tabela = 'fact_builder';
  if v_wm is null then v_wm := timestamptz '2025-10-01 00:00:00-03'; end if;
  v_ate := least(v_wm + make_interval(days => p_max_dias), now() - interval '1 minute');
  if v_ate <= v_wm then
    insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, linhas, sucesso)
    values ('fact_builder', v_inicio, now(), 0, true);
    return 0;
  end if;

  insert into marts.fact_builder_solucao as d
    (id, user_id, criado_em, completa, status_geracao, versao, tempo_geracao_ms, sincronizado_em)
  select s.id, s.user_id, s.created_at, s.is_complete, s.generation_status,
         s.version, s.generation_time_ms, now()
  from plataforma.ai_generated_solutions s
  where coalesce(s.updated_at, s.created_at) > v_wm
    and coalesce(s.updated_at, s.created_at) <= v_ate
  on conflict (id) do update set
    completa = excluded.completa, status_geracao = excluded.status_geracao,
    sincronizado_em = excluded.sincronizado_em;
  get diagnostics v_a = row_count;

  insert into marts.fact_builder_step as d
    (id, solution_id, step, status, tempo_ms, modelo, criado_em, sincronizado_em)
  select g.id, g.solution_id, g.step_key, g.status, g.generation_time_ms,
         g.model_used, g.created_at, now()
  from plataforma.builder_v2_step_generations g
  where coalesce(g.updated_at, g.created_at) > v_wm
    and coalesce(g.updated_at, g.created_at) <= v_ate
  on conflict (id) do update set
    status = excluded.status, tempo_ms = excluded.tempo_ms,
    sincronizado_em = excluded.sincronizado_em;
  get diagnostics v_b = row_count;

  insert into etl.sync_state (tabela, watermark, ultima_execucao, ultimas_linhas)
  values ('fact_builder', v_ate, now(), v_a + v_b)
  on conflict (tabela) do update set watermark = excluded.watermark,
    ultima_execucao = excluded.ultima_execucao, ultimas_linhas = excluded.ultimas_linhas;
  insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, linhas, sucesso)
  values ('fact_builder', v_inicio, now(), v_a + v_b, true);
  return v_a + v_b;
exception when others then
  insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, sucesso, erro)
  values ('fact_builder', v_inicio, now(), false, sqlerrm);
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
  begin perform etl.sync_fact_consultor(); exception when others then null; end;
  begin perform etl.sync_fact_builder(); exception when others then null; end;
end; $$;

-- ============ RPCs ============

create or replace function public.bi_ia_kpis(p_dias integer default 30)
returns table (
  usuarios_consultor bigint, mensagens_consultor bigint,
  usuarios_builder bigint, solucoes_builder bigint
)
language sql stable security invoker set search_path = '' as $$
  with hoje as (select (now() at time zone 'America/Sao_Paulo')::date d)
  select
    (select count(distinct c.user_id) from marts.fact_consultor_uso_diario c
      join marts.dim_usuario u on u.user_id = c.user_id and u.e_cliente, hoje h
     where c.data_brt > h.d - p_dias),
    (select coalesce(sum(c.mensagens_usuario), 0) from marts.fact_consultor_uso_diario c
      join marts.dim_usuario u on u.user_id = c.user_id and u.e_cliente, hoje h
     where c.data_brt > h.d - p_dias),
    (select count(distinct b.user_id) from marts.fact_builder_solucao b
      join marts.dim_usuario u on u.user_id = b.user_id and u.e_cliente, hoje h
     where (b.criado_em at time zone 'America/Sao_Paulo')::date > h.d - p_dias),
    (select count(*) from marts.fact_builder_solucao b
      join marts.dim_usuario u on u.user_id = b.user_id and u.e_cliente, hoje h
     where (b.criado_em at time zone 'America/Sao_Paulo')::date > h.d - p_dias);
$$;

-- Adoção: dos clientes ativos no período, quantos usam cada ferramenta de IA
create or replace function public.bi_ia_adocao(p_dias integer default 30)
returns table (ferramenta text, usuarios bigint, pct_dos_ativos numeric)
language sql stable security invoker set search_path = '' as $$
  with hoje as (select (now() at time zone 'America/Sao_Paulo')::date d),
  ativos as (
    select count(distinct f.user_id) as n
    from marts.fact_evento f
    join marts.dim_usuario u on u.user_id = f.user_id and u.e_cliente, hoje h
    where f.data_brt > h.d - p_dias
  ),
  cons as (
    select count(distinct c.user_id) as n
    from marts.fact_consultor_uso_diario c
    join marts.dim_usuario u on u.user_id = c.user_id and u.e_cliente, hoje h
    where c.data_brt > h.d - p_dias
  ),
  buil as (
    select count(distinct b.user_id) as n
    from marts.fact_builder_solucao b
    join marts.dim_usuario u on u.user_id = b.user_id and u.e_cliente, hoje h
    where (b.criado_em at time zone 'America/Sao_Paulo')::date > h.d - p_dias
  ),
  ambos as (
    select count(*) as n from (
      select c.user_id from marts.fact_consultor_uso_diario c, hoje h
      where c.data_brt > h.d - p_dias
      intersect
      select b.user_id from marts.fact_builder_solucao b, hoje h
      where (b.criado_em at time zone 'America/Sao_Paulo')::date > h.d - p_dias
    ) i
  )
  select e.ferramenta, e.n, round(e.n::numeric / nullif((select n from ativos), 0), 4)
  from (values
    ('Consultor IA', (select n from cons)),
    ('Builder', (select n from buil)),
    ('Usam os dois', (select n from ambos))
  ) as e(ferramenta, n);
$$;

-- Recorrência: dias de uso do Consultor por usuário no período
create or replace function public.bi_consultor_recorrencia(p_dias integer default 30)
returns table (faixa text, ordem integer, usuarios bigint)
language sql stable security invoker set search_path = '' as $$
  with uso as (
    select c.user_id, count(*) as dias
    from marts.fact_consultor_uso_diario c
    join marts.dim_usuario u on u.user_id = c.user_id and u.e_cliente
    where c.data_brt > (now() at time zone 'America/Sao_Paulo')::date - p_dias
    group by c.user_id
  )
  select faixa, ordem, count(*)
  from (
    select case
      when dias = 1 then '1 dia'
      when dias <= 3 then '2–3 dias'
      when dias <= 7 then '4–7 dias'
      when dias <= 15 then '8–15 dias'
      else '16+ dias'
    end as faixa,
    case
      when dias = 1 then 1 when dias <= 3 then 2 when dias <= 7 then 3
      when dias <= 15 then 4 else 5
    end as ordem
    from uso
  ) s group by faixa, ordem order by ordem;
$$;

-- Confiabilidade e tempo por etapa do Builder
create or replace function public.bi_builder_steps(p_dias integer default 90)
returns table (
  step text, geracoes bigint, pct_erro numeric, segundos_medio numeric
)
language sql stable security invoker set search_path = '' as $$
  select s.step,
         count(*),
         round(100.0 * count(*) filter (where s.status = 'error') / count(*), 2),
         round(avg(s.tempo_ms) filter (where s.status = 'completed') / 1000.0, 1)
  from marts.fact_builder_step s
  where (s.criado_em at time zone 'America/Sao_Paulo')::date
        > (now() at time zone 'America/Sao_Paulo')::date - p_dias
  group by s.step
  having count(*) >= 20
  order by 4 desc nulls last;
$$;

-- Impacto: quem usou IA na 1ª semana retém mais? (mesma régua do aha moment)
create or replace function public.bi_ia_impacto_retencao()
returns table (
  grupo text, clientes bigint, retidos bigint, pct_retencao numeric
)
language sql stable security invoker set search_path = '' as $$
  with hoje as (select (now() at time zone 'America/Sao_Paulo')::date d),
  base as (
    select u.user_id, (u.criado_em at time zone 'America/Sao_Paulo')::date as entrada
    from marts.dim_usuario u, hoje h
    where u.e_cliente
      -- só cohorts em que Consultor e Builder já existiam (Consultor: mai/2026)
      and (u.criado_em at time zone 'America/Sao_Paulo')::date >= date '2026-05-11'
      and (u.criado_em at time zone 'America/Sao_Paulo')::date <= h.d - 60
  ),
  usou_ia as (
    select distinct b.user_id from base b
    where exists (
      select 1 from marts.fact_consultor_uso_diario c
      where c.user_id = b.user_id and c.data_brt >= b.entrada and c.data_brt < b.entrada + 7
    ) or exists (
      select 1 from marts.fact_builder_solucao s
      where s.user_id = b.user_id
        and (s.criado_em at time zone 'America/Sao_Paulo')::date >= b.entrada
        and (s.criado_em at time zone 'America/Sao_Paulo')::date < b.entrada + 7
    )
  ),
  retencao as (
    select b.user_id,
           (i.user_id is not null) as com_ia,
           exists (
             select 1 from marts.fact_evento f
             where f.user_id = b.user_id
               and f.data_brt >= b.entrada + 30 and f.data_brt < b.entrada + 60
           ) as retido
    from base b
    left join usou_ia i on i.user_id = b.user_id
  )
  select case when com_ia then 'Usou IA na 1ª semana' else 'Não usou IA' end,
         count(*), count(*) filter (where retido),
         round(count(*) filter (where retido)::numeric / nullif(count(*), 0), 4)
  from retencao
  group by com_ia
  order by com_ia desc;
$$;

create or replace function public.bi_consultor_modos()
returns table (modo text, threads bigint, usuarios bigint)
language sql stable security invoker set search_path = '' as $$
  select coalesce(t.modo, '(sem modo)'), count(*), count(distinct t.user_id)
  from marts.fact_consultor_thread t
  join marts.dim_usuario u on u.user_id = t.user_id and u.e_cliente
  group by 1 order by 2 desc;
$$;

revoke execute on function public.bi_ia_kpis(integer) from public, anon;
revoke execute on function public.bi_ia_adocao(integer) from public, anon;
revoke execute on function public.bi_consultor_recorrencia(integer) from public, anon;
revoke execute on function public.bi_builder_steps(integer) from public, anon;
revoke execute on function public.bi_ia_impacto_retencao() from public, anon;
revoke execute on function public.bi_consultor_modos() from public, anon;
grant execute on function public.bi_ia_kpis(integer) to authenticated;
grant execute on function public.bi_ia_adocao(integer) to authenticated;
grant execute on function public.bi_consultor_recorrencia(integer) to authenticated;
grant execute on function public.bi_builder_steps(integer) to authenticated;
grant execute on function public.bi_ia_impacto_retencao() to authenticated;
grant execute on function public.bi_consultor_modos() to authenticated;
