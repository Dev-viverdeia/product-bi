-- Mart de pageviews (preserva histórico além da retenção de 365d da plataforma)
-- + RPCs de leitura do módulo Visão Geral.
-- Definição de "usuário ativo": cliente (e_cliente) com pageview OU evento de
-- domínio no dia — consistente com a bi_dau_mau da plataforma, que usa pageviews.
-- NOTA (medido): pageviews existem desde jul/2026 (tracking ligado nessa data).

create table marts.fact_pageview (
  id uuid primary key,
  user_id uuid,
  path text not null,
  referrer text,
  solution_id uuid,
  criado_em timestamptz not null,
  data_brt date not null,
  hora_brt smallint not null,
  dia_semana_brt smallint not null -- 0 = domingo … 6 = sábado
);

comment on table marts.fact_pageview is
  'Pageviews do app (espelho incremental de analytics event_type=view). A plataforma apaga >365d; aqui o histórico é permanente.';

create index fact_pageview_data_idx on marts.fact_pageview (data_brt);
create index fact_pageview_path_data_idx on marts.fact_pageview (path, data_brt);
create index fact_pageview_usuario_data_idx on marts.fact_pageview (user_id, data_brt);

alter table marts.fact_pageview enable row level security;

create or replace function etl.sync_fact_pageview(p_max_dias integer default 45)
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
  select watermark into v_wm from etl.sync_state where tabela = 'fact_pageview';
  if v_wm is null then
    v_wm := timestamptz '2025-06-01 00:00:00-03';
  end if;

  v_ate := least(v_wm + make_interval(days => p_max_dias), now() - interval '1 minute');
  if v_ate <= v_wm then
    insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, linhas, sucesso)
    values ('fact_pageview', v_inicio, now(), 0, true);
    return 0;
  end if;

  insert into marts.fact_pageview (id, user_id, path, referrer, solution_id, criado_em, data_brt, hora_brt, dia_semana_brt)
  select
    a.id, a.user_id,
    coalesce(a.event_data->>'path', '(desconhecido)'),
    nullif(a.event_data->>'referrer', ''),
    a.solution_id, a.created_at,
    (a.created_at at time zone 'America/Sao_Paulo')::date,
    extract(hour from a.created_at at time zone 'America/Sao_Paulo')::smallint,
    extract(dow from a.created_at at time zone 'America/Sao_Paulo')::smallint
  from plataforma.analytics a
  where a.event_type = 'view'
    and a.created_at > v_wm and a.created_at <= v_ate
  on conflict (id) do nothing;

  get diagnostics v_n = row_count;

  insert into etl.sync_state (tabela, watermark, ultima_execucao, ultimas_linhas)
  values ('fact_pageview', v_ate, now(), v_n)
  on conflict (tabela) do update
    set watermark = excluded.watermark,
        ultima_execucao = excluded.ultima_execucao,
        ultimas_linhas = excluded.ultimas_linhas;

  insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, linhas, sucesso)
  values ('fact_pageview', v_inicio, now(), v_n, true);

  return v_n;
exception when others then
  insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, sucesso, erro)
  values ('fact_pageview', v_inicio, now(), false, sqlerrm);
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
end;
$$;

-- ============ RPCs DO MÓDULO VISÃO GERAL ============
-- security definer (leem marts sem expor o schema); execute só p/ authenticated.
-- Janela: últimos p_dias completos em BRT; período anterior = janela igual imediatamente antes.

create or replace function public.bi_visao_geral_kpis(p_dias integer default 30)
returns table (
  ativos bigint, ativos_ant bigint,
  novos bigint, novos_ant bigint,
  aulas bigint, aulas_ant bigint,
  pageviews bigint, pageviews_ant bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with hoje as (select (now() at time zone 'America/Sao_Paulo')::date d),
  clientes as (select user_id from marts.dim_usuario where e_cliente),
  uso as (
    select f.user_id, f.data_brt from marts.fact_evento f
    union all
    select p.user_id, p.data_brt from marts.fact_pageview p
  )
  select
    (select count(distinct u.user_id) from uso u join clientes c on c.user_id = u.user_id, hoje
      where u.data_brt > hoje.d - p_dias),
    (select count(distinct u.user_id) from uso u join clientes c on c.user_id = u.user_id, hoje
      where u.data_brt > hoje.d - 2*p_dias and u.data_brt <= hoje.d - p_dias),
    (select count(*) from marts.dim_usuario du, hoje
      where du.e_cliente and (du.criado_em at time zone 'America/Sao_Paulo')::date > hoje.d - p_dias),
    (select count(*) from marts.dim_usuario du, hoje
      where du.e_cliente
        and (du.criado_em at time zone 'America/Sao_Paulo')::date > hoje.d - 2*p_dias
        and (du.criado_em at time zone 'America/Sao_Paulo')::date <= hoje.d - p_dias),
    (select count(*) from marts.fact_evento f join clientes c on c.user_id = f.user_id, hoje
      where f.tipo = 'lesson_completed' and f.data_brt > hoje.d - p_dias),
    (select count(*) from marts.fact_evento f join clientes c on c.user_id = f.user_id, hoje
      where f.tipo = 'lesson_completed' and f.data_brt > hoje.d - 2*p_dias and f.data_brt <= hoje.d - p_dias),
    (select count(*) from marts.fact_pageview p join clientes c on c.user_id = p.user_id, hoje
      where p.data_brt > hoje.d - p_dias),
    (select count(*) from marts.fact_pageview p join clientes c on c.user_id = p.user_id, hoje
      where p.data_brt > hoje.d - 2*p_dias and p.data_brt <= hoje.d - p_dias);
$$;

create or replace function public.bi_atividade_diaria(p_dias integer default 30)
returns table (data date, ativos bigint)
language sql
stable
security definer
set search_path = ''
as $$
  with hoje as (select (now() at time zone 'America/Sao_Paulo')::date d),
  clientes as (select user_id from marts.dim_usuario where e_cliente),
  uso as (
    select f.user_id, f.data_brt from marts.fact_evento f
    union all
    select p.user_id, p.data_brt from marts.fact_pageview p
  )
  select u.data_brt, count(distinct u.user_id)
  from uso u
  join clientes c on c.user_id = u.user_id, hoje
  where u.data_brt > hoje.d - p_dias
  group by u.data_brt
  order by u.data_brt;
$$;

create or replace function public.bi_heatmap_navegacao(p_dias integer default 30)
returns table (dia_semana smallint, hora smallint, pageviews bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select p.dia_semana_brt, p.hora_brt, count(*)
  from marts.fact_pageview p
  join marts.dim_usuario u on u.user_id = p.user_id and u.e_cliente
  where p.data_brt > (now() at time zone 'America/Sao_Paulo')::date - p_dias
  group by 1, 2;
$$;

create or replace function public.bi_eventos_por_tipo(p_dias integer default 30)
returns table (tipo text, eventos bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select f.tipo, count(*)
  from marts.fact_evento f
  join marts.dim_usuario u on u.user_id = f.user_id and u.e_cliente
  where f.data_brt > (now() at time zone 'America/Sao_Paulo')::date - p_dias
  group by 1
  order by 2 desc;
$$;

create or replace function public.bi_top_telas(p_dias integer default 30, p_limite integer default 10)
returns table (path text, views bigint, usuarios bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select p.path, count(*), count(distinct p.user_id)
  from marts.fact_pageview p
  join marts.dim_usuario u on u.user_id = p.user_id and u.e_cliente
  where p.data_brt > (now() at time zone 'America/Sao_Paulo')::date - p_dias
  group by 1
  order by 2 desc
  limit p_limite;
$$;

create or replace function public.bi_ultima_sincronizacao()
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select max(ultima_execucao) from etl.sync_state;
$$;

revoke execute on function public.bi_visao_geral_kpis(integer) from public, anon;
revoke execute on function public.bi_atividade_diaria(integer) from public, anon;
revoke execute on function public.bi_heatmap_navegacao(integer) from public, anon;
revoke execute on function public.bi_eventos_por_tipo(integer) from public, anon;
revoke execute on function public.bi_top_telas(integer, integer) from public, anon;
revoke execute on function public.bi_ultima_sincronizacao() from public, anon;
grant execute on function public.bi_visao_geral_kpis(integer) to authenticated;
grant execute on function public.bi_atividade_diaria(integer) to authenticated;
grant execute on function public.bi_heatmap_navegacao(integer) to authenticated;
grant execute on function public.bi_eventos_por_tipo(integer) to authenticated;
grant execute on function public.bi_top_telas(integer, integer) to authenticated;
grant execute on function public.bi_ultima_sincronizacao() to authenticated;
