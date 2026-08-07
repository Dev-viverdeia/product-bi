-- Entrega 3 — Entrada & Crescimento.
-- Realidade medida na origem (2026-08-07):
--   · invite_deliveries.opened_at/clicked_at SEMPRE nulos e delivery_events são
--     100% 'sent' → funil rastreável honesto: criado → enviado → usado.
--   · Envio automático rastreado desde jul/2025 e não cobre convite manual.
--   · Onboarding abandona nos steps 0–1.

-- ============ MARTS ============

create table marts.fact_convite (
  id uuid primary key,
  criado_em timestamptz not null,
  criado_por uuid,
  organization_id uuid,
  usado_em timestamptz,
  usado_por uuid,
  deletado_em timestamptz,
  canal_preferido text,
  sincronizado_em timestamptz not null default now()
);
comment on table marts.fact_convite is 'Espelho incremental de invites (watermark updated_at, upsert).';
create index fact_convite_criado_idx on marts.fact_convite (criado_em);
create index fact_convite_criador_idx on marts.fact_convite (criado_por);
alter table marts.fact_convite enable row level security;
create policy "leitura_bi" on marts.fact_convite for select to authenticated using (true);
grant select on marts.fact_convite to authenticated;

create table marts.fact_convite_envio (
  invite_id uuid primary key,
  primeiro_envio timestamptz,
  canal text,
  sincronizado_em timestamptz not null default now()
);
comment on table marts.fact_convite_envio is 'Primeiro envio rastreado por convite (invite_deliveries).';
alter table marts.fact_convite_envio enable row level security;
create policy "leitura_bi" on marts.fact_convite_envio for select to authenticated using (true);
grant select on marts.fact_convite_envio to authenticated;

create table marts.fact_onboarding (
  user_id uuid primary key,
  criado_em timestamptz,
  concluido boolean not null default false,
  concluido_em timestamptz,
  step_atual integer,
  sincronizado_em timestamptz not null default now()
);
comment on table marts.fact_onboarding is 'Espelho incremental de onboarding_final (watermark updated_at, upsert).';
alter table marts.fact_onboarding enable row level security;
create policy "leitura_bi" on marts.fact_onboarding for select to authenticated using (true);
grant select on marts.fact_onboarding to authenticated;

create table marts.fact_erro_login (
  id uuid primary key,
  criado_em timestamptz not null,
  categoria text not null,
  status integer
);
comment on table marts.fact_erro_login is 'Espelho de auth_error_telemetry SEM PII (categoria apenas).';
create index fact_erro_login_data_idx on marts.fact_erro_login (criado_em);
alter table marts.fact_erro_login enable row level security;
create policy "leitura_bi" on marts.fact_erro_login for select to authenticated using (true);
grant select on marts.fact_erro_login to authenticated;

create table marts.fact_erro_cliente (
  id uuid primary key,
  criado_em timestamptz not null,
  tipo text,
  tela text,
  origem text
);
comment on table marts.fact_erro_cliente is 'Espelho de client_error_logs (url normalizada para path).';
create index fact_erro_cliente_data_idx on marts.fact_erro_cliente (criado_em);
alter table marts.fact_erro_cliente enable row level security;
create policy "leitura_bi" on marts.fact_erro_cliente for select to authenticated using (true);
grant select on marts.fact_erro_cliente to authenticated;

-- ============ SYNCS ============

create or replace function etl.sync_fact_convite(p_max_dias integer default 90)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_inicio timestamptz := now(); v_wm timestamptz; v_ate timestamptz; v_n integer;
begin
  select watermark into v_wm from etl.sync_state where tabela = 'fact_convite';
  if v_wm is null then v_wm := timestamptz '2025-07-01 00:00:00-03'; end if;
  v_ate := least(v_wm + make_interval(days => p_max_dias), now() - interval '1 minute');
  if v_ate <= v_wm then
    insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, linhas, sucesso)
    values ('fact_convite', v_inicio, now(), 0, true);
    return 0;
  end if;

  insert into marts.fact_convite as d
    (id, criado_em, criado_por, organization_id, usado_em, usado_por, deletado_em, canal_preferido, sincronizado_em)
  select i.id, i.created_at, i.created_by, i.organization_id, i.used_at,
         i.used_by_user_id, i.deleted_at, i.preferred_channel, now()
  from plataforma.invites i
  where coalesce(i.updated_at, i.created_at) > v_wm
    and coalesce(i.updated_at, i.created_at) <= v_ate
  on conflict (id) do update set
    usado_em = excluded.usado_em,
    usado_por = excluded.usado_por,
    deletado_em = excluded.deletado_em,
    sincronizado_em = excluded.sincronizado_em;

  get diagnostics v_n = row_count;
  insert into etl.sync_state (tabela, watermark, ultima_execucao, ultimas_linhas)
  values ('fact_convite', v_ate, now(), v_n)
  on conflict (tabela) do update set watermark = excluded.watermark,
    ultima_execucao = excluded.ultima_execucao, ultimas_linhas = excluded.ultimas_linhas;
  insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, linhas, sucesso)
  values ('fact_convite', v_inicio, now(), v_n, true);
  return v_n;
exception when others then
  insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, sucesso, erro)
  values ('fact_convite', v_inicio, now(), false, sqlerrm);
  raise;
end; $$;

create or replace function etl.sync_fact_convite_envio(p_max_dias integer default 90)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_inicio timestamptz := now(); v_wm timestamptz; v_ate timestamptz; v_n integer;
begin
  select watermark into v_wm from etl.sync_state where tabela = 'fact_convite_envio';
  if v_wm is null then v_wm := timestamptz '2025-07-01 00:00:00-03'; end if;
  v_ate := least(v_wm + make_interval(days => p_max_dias), now() - interval '1 minute');
  if v_ate <= v_wm then
    insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, linhas, sucesso)
    values ('fact_convite_envio', v_inicio, now(), 0, true);
    return 0;
  end if;

  insert into marts.fact_convite_envio as d (invite_id, primeiro_envio, canal, sincronizado_em)
  select dd.invite_id, min(coalesce(dd.sent_at, dd.created_at)), min(dd.channel::text), now()
  from plataforma.invite_deliveries dd
  where coalesce(dd.updated_at, dd.created_at) > v_wm
    and coalesce(dd.updated_at, dd.created_at) <= v_ate
  group by dd.invite_id
  on conflict (invite_id) do update set
    primeiro_envio = least(coalesce(d.primeiro_envio, excluded.primeiro_envio), excluded.primeiro_envio),
    sincronizado_em = excluded.sincronizado_em;

  get diagnostics v_n = row_count;
  insert into etl.sync_state (tabela, watermark, ultima_execucao, ultimas_linhas)
  values ('fact_convite_envio', v_ate, now(), v_n)
  on conflict (tabela) do update set watermark = excluded.watermark,
    ultima_execucao = excluded.ultima_execucao, ultimas_linhas = excluded.ultimas_linhas;
  insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, linhas, sucesso)
  values ('fact_convite_envio', v_inicio, now(), v_n, true);
  return v_n;
exception when others then
  insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, sucesso, erro)
  values ('fact_convite_envio', v_inicio, now(), false, sqlerrm);
  raise;
end; $$;

create or replace function etl.sync_fact_onboarding(p_max_dias integer default 90)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_inicio timestamptz := now(); v_wm timestamptz; v_ate timestamptz; v_n integer;
begin
  select watermark into v_wm from etl.sync_state where tabela = 'fact_onboarding';
  if v_wm is null then v_wm := timestamptz '2025-07-01 00:00:00-03'; end if;
  v_ate := least(v_wm + make_interval(days => p_max_dias), now() - interval '1 minute');
  if v_ate <= v_wm then
    insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, linhas, sucesso)
    values ('fact_onboarding', v_inicio, now(), 0, true);
    return 0;
  end if;

  insert into marts.fact_onboarding as d
    (user_id, criado_em, concluido, concluido_em, step_atual, sincronizado_em)
  select o.user_id, o.created_at, coalesce(o.is_completed, false),
         o.completed_at, o.current_step, now()
  from plataforma.onboarding_final o
  where coalesce(o.updated_at, o.created_at) > v_wm
    and coalesce(o.updated_at, o.created_at) <= v_ate
  on conflict (user_id) do update set
    concluido = excluded.concluido,
    concluido_em = excluded.concluido_em,
    step_atual = excluded.step_atual,
    sincronizado_em = excluded.sincronizado_em;

  get diagnostics v_n = row_count;
  insert into etl.sync_state (tabela, watermark, ultima_execucao, ultimas_linhas)
  values ('fact_onboarding', v_ate, now(), v_n)
  on conflict (tabela) do update set watermark = excluded.watermark,
    ultima_execucao = excluded.ultima_execucao, ultimas_linhas = excluded.ultimas_linhas;
  insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, linhas, sucesso)
  values ('fact_onboarding', v_inicio, now(), v_n, true);
  return v_n;
exception when others then
  insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, sucesso, erro)
  values ('fact_onboarding', v_inicio, now(), false, sqlerrm);
  raise;
end; $$;

create or replace function etl.sync_fact_erros(p_max_dias integer default 90)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_inicio timestamptz := now(); v_wm timestamptz; v_ate timestamptz; v_n integer; v_n2 integer;
begin
  select watermark into v_wm from etl.sync_state where tabela = 'fact_erros';
  if v_wm is null then v_wm := timestamptz '2026-04-01 00:00:00-03'; end if;
  v_ate := least(v_wm + make_interval(days => p_max_dias), now() - interval '1 minute');
  if v_ate <= v_wm then
    insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, linhas, sucesso)
    values ('fact_erros', v_inicio, now(), 0, true);
    return 0;
  end if;

  insert into marts.fact_erro_login (id, criado_em, categoria, status)
  select a.id, a.created_at,
         coalesce(a.matched_pattern, a.error_code, 'outro'), a.error_status
  from plataforma.auth_error_telemetry a
  where a.created_at > v_wm and a.created_at <= v_ate
  on conflict (id) do nothing;
  get diagnostics v_n = row_count;

  insert into marts.fact_erro_cliente (id, criado_em, tipo, tela, origem)
  select c.id, c.created_at, c.error_type,
         coalesce(nullif(regexp_replace(regexp_replace(coalesce(c.url, ''), '^https?://[^/]+', ''), '\?.*$', ''), ''), '(desconhecida)'),
         c.source
  from plataforma.client_error_logs c
  where c.created_at > v_wm and c.created_at <= v_ate
  on conflict (id) do nothing;
  get diagnostics v_n2 = row_count;

  insert into etl.sync_state (tabela, watermark, ultima_execucao, ultimas_linhas)
  values ('fact_erros', v_ate, now(), v_n + v_n2)
  on conflict (tabela) do update set watermark = excluded.watermark,
    ultima_execucao = excluded.ultima_execucao, ultimas_linhas = excluded.ultimas_linhas;
  insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, linhas, sucesso)
  values ('fact_erros', v_inicio, now(), v_n + v_n2, true);
  return v_n + v_n2;
exception when others then
  insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, sucesso, erro)
  values ('fact_erros', v_inicio, now(), false, sqlerrm);
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
end; $$;

-- ============ RPCs ============

create or replace function public.bi_entrada_kpis(p_dias integer default 30)
returns table (
  convites bigint, conversao numeric, onboarding_pct numeric, erros_login bigint
)
language sql stable security invoker set search_path = '' as $$
  with hoje as (select (now() at time zone 'America/Sao_Paulo')::date d),
  janela as (
    select c.* from marts.fact_convite c, hoje h
    where c.deletado_em is null
      and (c.criado_em at time zone 'America/Sao_Paulo')::date > h.d - p_dias
  )
  select
    (select count(*) from janela),
    round((select count(usado_em) from janela)::numeric
      / nullif((select count(*) from janela), 0), 4),
    (select round(count(*) filter (where o.concluido)::numeric / nullif(count(*), 0), 4)
     from janela j join marts.fact_onboarding o on o.user_id = j.usado_por),
    (select count(*) from marts.fact_erro_login e, hoje h
     where (e.criado_em at time zone 'America/Sao_Paulo')::date > h.d - p_dias);
$$;

-- (versão inicial com etapa "Enviados"; substituída na migration seguinte —
-- o rastreamento de envio parou em abr/2026)
create or replace function public.bi_funil_entrada(p_dias integer default 30)
returns table (etapa text, ordem integer, quantidade bigint, pct_do_inicio numeric)
language sql stable security invoker set search_path = '' as $$
  with hoje as (select (now() at time zone 'America/Sao_Paulo')::date d),
  janela as (
    select c.* from marts.fact_convite c, hoje h
    where c.deletado_em is null
      and (c.criado_em at time zone 'America/Sao_Paulo')::date > h.d - p_dias
  ),
  n as (
    select
      (select count(*) from janela) as criados,
      (select count(*) from janela j join marts.fact_convite_envio e on e.invite_id = j.id) as enviados,
      (select count(usado_em) from janela) as usados,
      (select count(*) from janela j
        join marts.fact_onboarding o on o.user_id = j.usado_por and o.concluido) as onboarding,
      (select count(distinct j.usado_por) from janela j
        where j.usado_por is not null
          and exists (select 1 from marts.fact_evento f where f.user_id = j.usado_por)) as primeira_acao
  )
  select e.etapa, e.ordem, e.quantidade,
         round(e.quantidade::numeric / nullif(n.criados, 0), 4)
  from n, lateral (values
    ('Convites criados', 1, n.criados),
    ('Enviados (rastreado)', 2, n.enviados),
    ('Cadastros (convite usado)', 3, n.usados),
    ('Onboarding concluído', 4, n.onboarding),
    ('1ª ação de produto', 5, n.primeira_acao)
  ) as e(etapa, ordem, quantidade)
  order by e.ordem;
$$;

create or replace function public.bi_tempo_primeiro_valor()
returns table (faixa text, ordem integer, clientes bigint)
language sql stable security invoker set search_path = '' as $$
  with hoje as (select (now() at time zone 'America/Sao_Paulo')::date d),
  base as (
    select u.user_id, (u.criado_em at time zone 'America/Sao_Paulo')::date as entrada
    from marts.dim_usuario u, hoje h
    where u.e_cliente
      and (u.criado_em at time zone 'America/Sao_Paulo')::date between h.d - 180 and h.d - 30
  ),
  primeira as (
    select b.user_id, b.entrada, min(f.data_brt) as primeira_acao
    from base b
    left join marts.fact_evento f on f.user_id = b.user_id
    group by b.user_id, b.entrada
  ),
  faixas as (
    select case
      when primeira_acao is null then 'Nunca agiu'
      when primeira_acao - entrada <= 0 then 'No mesmo dia'
      when primeira_acao - entrada = 1 then '1 dia'
      when primeira_acao - entrada <= 3 then '2–3 dias'
      when primeira_acao - entrada <= 7 then '4–7 dias'
      when primeira_acao - entrada <= 30 then '8–30 dias'
      else '31+ dias'
    end as faixa,
    case
      when primeira_acao is null then 7
      when primeira_acao - entrada <= 0 then 1
      when primeira_acao - entrada = 1 then 2
      when primeira_acao - entrada <= 3 then 3
      when primeira_acao - entrada <= 7 then 4
      when primeira_acao - entrada <= 30 then 5
      else 6
    end as ordem
    from primeira
  )
  select faixa, ordem, count(*) from faixas group by 1, 2 order by 2;
$$;

create or replace function public.bi_onboarding_abandono()
returns table (step_atual integer, clientes bigint)
language sql stable security invoker set search_path = '' as $$
  select o.step_atual, count(*)
  from marts.fact_onboarding o
  where not o.concluido and o.step_atual is not null
  group by 1 order by 1;
$$;

create or replace function public.bi_masters_convites_resumo()
returns table (
  masters_total bigint, masters_convidaram bigint, pct_convidam numeric, conversao_convites numeric
)
language sql stable security invoker set search_path = '' as $$
  with masters as (
    select user_id from marts.dim_usuario where e_cliente and is_master
  ),
  convites_masters as (
    select c.criado_por, c.usado_em
    from marts.fact_convite c
    join masters m on m.user_id = c.criado_por
    where c.deletado_em is null
  )
  select
    (select count(*) from masters),
    (select count(distinct criado_por) from convites_masters),
    round((select count(distinct criado_por) from convites_masters)::numeric
      / nullif((select count(*) from masters), 0), 4),
    round((select count(usado_em) from convites_masters)::numeric
      / nullif((select count(*) from convites_masters), 0), 4);
$$;

create or replace function public.bi_masters_top_convidadores(p_limite integer default 12)
returns table (
  nome text, email text, organizacao text,
  convites bigint, usados bigint, conversao numeric
)
language sql stable security invoker set search_path = '' as $$
  select u.nome, u.email, u.organizacao,
         count(*) as convites,
         count(c.usado_em) as usados,
         round(count(c.usado_em)::numeric / nullif(count(*), 0), 4) as conversao
  from marts.fact_convite c
  join marts.dim_usuario u on u.user_id = c.criado_por and u.e_cliente and u.is_master
  where c.deletado_em is null
  group by u.user_id, u.nome, u.email, u.organizacao
  order by count(*) desc
  limit p_limite;
$$;

create or replace function public.bi_erros_login(p_dias integer default 30)
returns table (categoria text, ocorrencias bigint)
language sql stable security invoker set search_path = '' as $$
  select e.categoria, count(*)
  from marts.fact_erro_login e
  where (e.criado_em at time zone 'America/Sao_Paulo')::date
        > (now() at time zone 'America/Sao_Paulo')::date - p_dias
  group by 1 order by 2 desc;
$$;

create or replace function public.bi_erros_por_tela(p_dias integer default 30, p_limite integer default 12)
returns table (tela text, ocorrencias bigint)
language sql stable security invoker set search_path = '' as $$
  select e.tela, count(*)
  from marts.fact_erro_cliente e
  where (e.criado_em at time zone 'America/Sao_Paulo')::date
        > (now() at time zone 'America/Sao_Paulo')::date - p_dias
  group by 1 order by 2 desc
  limit p_limite;
$$;

revoke execute on function public.bi_entrada_kpis(integer) from public, anon;
revoke execute on function public.bi_funil_entrada(integer) from public, anon;
revoke execute on function public.bi_tempo_primeiro_valor() from public, anon;
revoke execute on function public.bi_onboarding_abandono() from public, anon;
revoke execute on function public.bi_masters_convites_resumo() from public, anon;
revoke execute on function public.bi_masters_top_convidadores(integer) from public, anon;
revoke execute on function public.bi_erros_login(integer) from public, anon;
revoke execute on function public.bi_erros_por_tela(integer, integer) from public, anon;
grant execute on function public.bi_entrada_kpis(integer) to authenticated;
grant execute on function public.bi_funil_entrada(integer) to authenticated;
grant execute on function public.bi_tempo_primeiro_valor() to authenticated;
grant execute on function public.bi_onboarding_abandono() to authenticated;
grant execute on function public.bi_masters_convites_resumo() to authenticated;
grant execute on function public.bi_masters_top_convidadores(integer) to authenticated;
grant execute on function public.bi_erros_login(integer) to authenticated;
grant execute on function public.bi_erros_por_tela(integer, integer) to authenticated;
