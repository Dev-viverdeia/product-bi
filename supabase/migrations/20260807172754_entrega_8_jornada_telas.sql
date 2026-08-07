-- Entrega 8 — Jornada & Telas.
-- Validado na origem (2026-08-07):
--   · referrer só existe em 2,8% dos pageviews e é EXTERNO (Google, Bing) —
--     NÃO serve para fluxo interno. Fluxo vem da sequência temporal.
--   · Sessionização com gap de 30min: 18.932 sessões em 14 dias, mediana de
--     3 telas, 30% são de tela única.
--   · 3.324 paths distintos → normalização por padrão é obrigatória.
--   · ⚠️ pageviews existem só desde jul/2026 (36 dias) — janela curta.

-- Normaliza rota para padrão analisável (:id/:slug no lugar dos identificadores)
create or replace function marts.normaliza_path(p_path text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_path is null or p_path = '' then '(desconhecida)'
    when p_path like '/learning/course/%/lesson/%' then '/learning/course/:id/lesson/:id'
    when p_path like '/learning/course/%' then '/learning/course/:id'
    when p_path like '/solucoes/%' then '/solucoes/:slug'
    when p_path like '/formacoes/%' then '/formacoes/:slug'
    when p_path like '/ferramentas/builder-v2/%' then '/ferramentas/builder-v2/:sub'
    when p_path like '/tools/%' then '/tools/:slug'
    when p_path like '/convite/%' then '/convite/:token'
    when p_path like '/certificado/%' or p_path like '/certificate/%' then '/certificado/:id'
    when p_path like '/profile/%' then '/profile/:sub'
    when p_path like '/mentorias/%' then '/mentorias/:sub'
    when p_path like '/consultor-ia/%' then '/consultor-ia/:sub'
    -- fallback: troca segmentos que parecem uuid/hash/número por :id
    else regexp_replace(p_path, '/[0-9a-f]{8}-[0-9a-f-]{27,}|/\d{3,}', '/:id', 'g')
  end;
$$;

grant execute on function marts.normaliza_path(text) to authenticated;

-- Navegação com sessão e ordem — derivada de fact_pageview
create table marts.fact_navegacao (
  id uuid primary key,
  user_id uuid,
  sessao_id text not null,
  tela text not null,
  proxima_tela text,
  ordem_na_sessao integer not null,
  telas_na_sessao integer not null,
  criado_em timestamptz not null,
  data_brt date not null,
  sincronizado_em timestamptz not null default now()
);
comment on table marts.fact_navegacao is
  'Pageviews sessionizados (gap 30min) com tela normalizada e próxima tela — base de fluxos e rotina. Recalculado por janela móvel.';
create index fact_nav_data_idx on marts.fact_navegacao (data_brt);
create index fact_nav_tela_idx on marts.fact_navegacao (tela, data_brt);
create index fact_nav_sessao_idx on marts.fact_navegacao (sessao_id);
alter table marts.fact_navegacao enable row level security;
create policy "leitura_bi" on marts.fact_navegacao for select to authenticated using (true);
grant select on marts.fact_navegacao to authenticated;

-- Sessionização não é incremental por natureza (a última sessão pode continuar):
-- recalcula a janela recente inteira a cada execução.
create or replace function etl.sync_fact_navegacao(p_dias integer default 45)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_inicio timestamptz := now(); v_n integer; v_corte date;
begin
  v_corte := (now() at time zone 'America/Sao_Paulo')::date - p_dias;

  delete from marts.fact_navegacao where data_brt >= v_corte;

  insert into marts.fact_navegacao
    (id, user_id, sessao_id, tela, proxima_tela, ordem_na_sessao, telas_na_sessao, criado_em, data_brt)
  with base as (
    select pv.id, pv.user_id, marts.normaliza_path(pv.path) as tela,
           pv.criado_em, pv.data_brt,
           lag(pv.criado_em) over (partition by pv.user_id order by pv.criado_em) as anterior
    from marts.fact_pageview pv
    join marts.dim_usuario u on u.user_id = pv.user_id and u.e_cliente
    where pv.data_brt >= v_corte
  ),
  marcado as (
    select *,
      case when anterior is null or criado_em - anterior > interval '30 minutes' then 1 else 0 end as nova
    from base
  ),
  sessionizado as (
    select id, user_id, tela, criado_em, data_brt,
           user_id::text || '-' || sum(nova) over (partition by user_id order by criado_em) as sessao_id
    from marcado
  ),
  ordenado as (
    select id, user_id, sessao_id, tela, criado_em, data_brt,
           row_number() over (partition by sessao_id order by criado_em) as ordem,
           count(*) over (partition by sessao_id) as total,
           lead(tela) over (partition by sessao_id order by criado_em) as proxima
    from sessionizado
  )
  select id, user_id, sessao_id, tela, proxima, ordem, total, criado_em, data_brt
  from ordenado;

  get diagnostics v_n = row_count;
  insert into etl.sync_state (tabela, watermark, ultima_execucao, ultimas_linhas)
  values ('fact_navegacao', now(), now(), v_n)
  on conflict (tabela) do update set watermark = excluded.watermark,
    ultima_execucao = excluded.ultima_execucao, ultimas_linhas = excluded.ultimas_linhas;
  insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, linhas, sucesso)
  values ('fact_navegacao', v_inicio, now(), v_n, true);
  return v_n;
exception when others then
  insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, sucesso, erro)
  values ('fact_navegacao', v_inicio, now(), false, sqlerrm);
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
  begin perform etl.sync_organizacoes(); exception when others then null; end;
  -- por último: depende de fact_pageview já atualizado
  begin perform etl.sync_fact_navegacao(); exception when others then null; end;
end; $$;

select etl.sync_fact_navegacao(45);

-- ============ RPCs ============

create or replace function public.bi_jornada_kpis(p_dias integer default 30)
returns table (
  sessoes bigint, telas_por_sessao numeric, minutos_medianos numeric, pct_uma_tela numeric
)
language sql stable security invoker set search_path = '' as $$
  with sess as (
    select sessao_id, max(telas_na_sessao) as telas,
           extract(epoch from max(criado_em) - min(criado_em)) / 60 as minutos
    from marts.fact_navegacao
    where data_brt > (now() at time zone 'America/Sao_Paulo')::date - p_dias
    group by sessao_id
  )
  select count(*),
         round(avg(telas), 1),
         round(percentile_cont(0.5) within group (order by minutos)::numeric, 1),
         round(count(*) filter (where telas = 1)::numeric / nullif(count(*), 0), 4)
  from sess;
$$;

-- Raio-x por tela: uso, alcance, papel na sessão (entrada/saída)
create or replace function public.bi_raio_x_telas(p_dias integer default 30, p_limite integer default 20)
returns table (
  tela text, pageviews bigint, usuarios bigint,
  pct_entrada numeric, pct_saida numeric, posicao_media numeric
)
language sql stable security invoker set search_path = '' as $$
  select n.tela,
         count(*),
         count(distinct n.user_id),
         round(count(*) filter (where n.ordem_na_sessao = 1)::numeric / count(*), 4),
         round(count(*) filter (where n.proxima_tela is null)::numeric / count(*), 4),
         round(avg(n.ordem_na_sessao), 1)
  from marts.fact_navegacao n
  where n.data_brt > (now() at time zone 'America/Sao_Paulo')::date - p_dias
  group by n.tela
  order by 2 desc
  limit p_limite;
$$;

-- Fluxo: para onde vão a partir de uma tela
create or replace function public.bi_fluxo_da_tela(p_tela text, p_dias integer default 30)
returns table (destino text, transicoes bigint, pct numeric)
language sql stable security invoker set search_path = '' as $$
  with saidas as (
    select coalesce(n.proxima_tela, '(fim da sessão)') as destino
    from marts.fact_navegacao n
    where n.tela = p_tela
      and n.data_brt > (now() at time zone 'America/Sao_Paulo')::date - p_dias
  )
  select destino, count(*), round(count(*)::numeric / sum(count(*)) over (), 4)
  from saidas
  group by destino
  order by 2 desc
  limit 10;
$$;

-- Portas de entrada da sessão
create or replace function public.bi_portas_entrada(p_dias integer default 30, p_limite integer default 10)
returns table (tela text, sessoes bigint, pct numeric)
language sql stable security invoker set search_path = '' as $$
  with entradas as (
    select n.tela
    from marts.fact_navegacao n
    where n.ordem_na_sessao = 1
      and n.data_brt > (now() at time zone 'America/Sao_Paulo')::date - p_dias
  )
  select tela, count(*), round(count(*)::numeric / sum(count(*)) over (), 4)
  from entradas group by tela order by 2 desc limit p_limite;
$$;

-- Onde a sessão morre (últimas telas) — só sessões com 2+ telas, para não
-- confundir saída real com visita de tela única.
create or replace function public.bi_pontos_saida(p_dias integer default 30, p_limite integer default 10)
returns table (tela text, saidas bigint, pct_da_tela numeric)
language sql stable security invoker set search_path = '' as $$
  select n.tela,
         count(*) filter (where n.proxima_tela is null),
         round(count(*) filter (where n.proxima_tela is null)::numeric / count(*), 4)
  from marts.fact_navegacao n
  where n.telas_na_sessao > 1
    and n.data_brt > (now() at time zone 'America/Sao_Paulo')::date - p_dias
  group by n.tela
  having count(*) >= 100
  order by 2 desc
  limit p_limite;
$$;

-- Rotina: profundidade das sessões
create or replace function public.bi_profundidade_sessao(p_dias integer default 30)
returns table (faixa text, ordem integer, sessoes bigint)
language sql stable security invoker set search_path = '' as $$
  with sess as (
    select sessao_id, max(telas_na_sessao) as telas
    from marts.fact_navegacao
    where data_brt > (now() at time zone 'America/Sao_Paulo')::date - p_dias
    group by sessao_id
  )
  select faixa, ordem, count(*)
  from (
    select case
      when telas = 1 then '1 tela'
      when telas <= 3 then '2–3 telas'
      when telas <= 7 then '4–7 telas'
      when telas <= 15 then '8–15 telas'
      else '16+ telas'
    end as faixa,
    case
      when telas = 1 then 1 when telas <= 3 then 2 when telas <= 7 then 3
      when telas <= 15 then 4 else 5
    end as ordem
    from sess
  ) s group by faixa, ordem order by ordem;
$$;

revoke execute on function public.bi_jornada_kpis(integer) from public, anon;
revoke execute on function public.bi_raio_x_telas(integer, integer) from public, anon;
revoke execute on function public.bi_fluxo_da_tela(text, integer) from public, anon;
revoke execute on function public.bi_portas_entrada(integer, integer) from public, anon;
revoke execute on function public.bi_pontos_saida(integer, integer) from public, anon;
revoke execute on function public.bi_profundidade_sessao(integer) from public, anon;
grant execute on function public.bi_jornada_kpis(integer) to authenticated;
grant execute on function public.bi_raio_x_telas(integer, integer) to authenticated;
grant execute on function public.bi_fluxo_da_tela(text, integer) to authenticated;
grant execute on function public.bi_portas_entrada(integer, integer) to authenticated;
grant execute on function public.bi_pontos_saida(integer, integer) to authenticated;
grant execute on function public.bi_profundidade_sessao(integer) to authenticated;
