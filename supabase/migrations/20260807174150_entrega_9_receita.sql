-- Entrega 9 — Receita & Renovação.
-- ⚠️ ACHADOS CRÍTICOS validados na origem (2026-08-07):
--   1. A view bi_receita_hubla DA PLATAFORMA ESTÁ QUEBRADA: lê
--      payload->'invoice'->'amount'->>'totalCents', mas a estrutura real é
--      payload->'event'->'invoice'->... — o caminho antigo retorna ZERO linhas.
--   2. hubla_webhooks PAROU em 19/abr/2026 (5º rastreamento morto encontrado).
--   3. Há vários eventos por fatura → dedupe obrigatório por (invoice id, tipo).
--   4. Receita reconhecida = invoice.payment_succeeded (236 faturas,
--      R$ 626.535,44, 103 compradores, ticket mediano R$ 1.791,67).
--   5. 79% das faturas casam com profile por e-mail (187 de 236).

create table marts.fact_fatura (
  fatura_id text not null,
  tipo text not null,
  email text,
  user_id uuid,
  valor_brl numeric(12,2),
  ocorrido_em timestamptz not null,
  data_brt date not null,
  sincronizado_em timestamptz not null default now(),
  primary key (fatura_id, tipo)
);
comment on table marts.fact_fatura is
  'Faturas Hubla deduplicadas por (id, tipo) — caminho payload->event->invoice. Fonte parada em abr/2026.';
create index fact_fatura_tipo_idx on marts.fact_fatura (tipo, data_brt);
create index fact_fatura_user_idx on marts.fact_fatura (user_id);
alter table marts.fact_fatura enable row level security;
create policy "leitura_bi" on marts.fact_fatura for select to authenticated using (true);
grant select on marts.fact_fatura to authenticated;

create or replace function etl.sync_fact_fatura()
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_inicio timestamptz := now(); v_n integer;
begin
  -- volume pequeno (3,5k webhooks) e fonte parada: full refresh é mais simples
  -- e garante correção retroativa se a plataforma voltar a emitir.
  delete from marts.fact_fatura;

  insert into marts.fact_fatura
    (fatura_id, tipo, email, user_id, valor_brl, ocorrido_em, data_brt)
  select distinct on (h.payload->'event'->'invoice'->>'id', h.payload->>'type')
    h.payload->'event'->'invoice'->>'id',
    h.payload->>'type',
    lower(h.payload->'event'->'user'->>'email'),
    u.user_id,
    (h.payload->'event'->'invoice'->'amount'->>'totalCents')::numeric / 100,
    h.received_at,
    (h.received_at at time zone 'America/Sao_Paulo')::date
  from plataforma.hubla_webhooks h
  left join marts.dim_usuario u
    on lower(u.email) = lower(h.payload->'event'->'user'->>'email')
  where h.payload->'event'->'invoice'->>'id' is not null
    and h.payload->'event'->'invoice'->'amount'->>'totalCents' is not null
    and h.payload->>'type' is not null
  order by h.payload->'event'->'invoice'->>'id', h.payload->>'type', h.received_at desc;

  get diagnostics v_n = row_count;
  insert into etl.sync_state (tabela, watermark, ultima_execucao, ultimas_linhas)
  values ('fact_fatura', now(), now(), v_n)
  on conflict (tabela) do update set watermark = excluded.watermark,
    ultima_execucao = excluded.ultima_execucao, ultimas_linhas = excluded.ultimas_linhas;
  insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, linhas, sucesso)
  values ('fact_fatura', v_inicio, now(), v_n, true);
  return v_n;
exception when others then
  insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, sucesso, erro)
  values ('fact_fatura', v_inicio, now(), false, sqlerrm);
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
  begin perform etl.sync_fact_fatura(); exception when others then null; end;
  -- por último: depende de fact_pageview já atualizado
  begin perform etl.sync_fact_navegacao(); exception when others then null; end;
end; $$;

select etl.sync_fact_fatura();

-- ============ RPCs ============

create or replace function public.bi_receita_kpis()
returns table (
  receita_brl numeric, faturas bigint, compradores bigint, ticket_mediano numeric,
  reembolsado_brl numeric, dados_ate date
)
language sql stable security invoker set search_path = '' as $$
  select
    round(coalesce(sum(valor_brl) filter (where tipo = 'invoice.payment_succeeded'), 0), 2),
    count(*) filter (where tipo = 'invoice.payment_succeeded'),
    count(distinct email) filter (where tipo = 'invoice.payment_succeeded'),
    round(percentile_cont(0.5) within group (
      order by valor_brl) filter (where tipo = 'invoice.payment_succeeded')::numeric, 2),
    round(coalesce(sum(valor_brl) filter (where tipo = 'invoice.refunded'), 0), 2),
    max(data_brt)
  from marts.fact_fatura;
$$;

create or replace function public.bi_receita_mensal()
returns table (mes date, receita_brl numeric, faturas bigint, compradores bigint)
language sql stable security invoker set search_path = '' as $$
  select date_trunc('month', data_brt)::date,
         round(sum(valor_brl), 2),
         count(*),
         count(distinct email)
  from marts.fact_fatura
  where tipo = 'invoice.payment_succeeded'
  group by 1 order by 1;
$$;

create or replace function public.bi_receita_saude_cobranca()
returns table (evento text, faturas bigint, valor_brl numeric, pct_do_pago numeric)
language sql stable security invoker set search_path = '' as $$
  with pago as (
    select coalesce(sum(valor_brl), 0) v from marts.fact_fatura
    where tipo = 'invoice.payment_succeeded'
  )
  select case f.tipo
           when 'invoice.payment_succeeded' then 'Pagamento aprovado'
           when 'invoice.payment_failed' then 'Pagamento falhou'
           when 'invoice.refunded' then 'Reembolsado'
           when 'invoice.expired' then 'Fatura expirou'
           else f.tipo
         end,
         count(*), round(sum(f.valor_brl), 2),
         round(sum(f.valor_brl) / nullif((select v from pago), 0), 4)
  from marts.fact_fatura f
  where f.tipo in ('invoice.payment_succeeded','invoice.payment_failed',
                   'invoice.refunded','invoice.expired')
  group by f.tipo
  order by 3 desc;
$$;

create or replace function public.bi_ltv_cohort()
returns table (
  cohort_mes date, clientes bigint, compradores bigint,
  receita_brl numeric, receita_por_cliente numeric
)
language sql stable security invoker set search_path = '' as $$
  with receita as (
    select f.user_id, sum(f.valor_brl) as total
    from marts.fact_fatura f
    where f.tipo = 'invoice.payment_succeeded' and f.user_id is not null
    group by f.user_id
  )
  select u.cohort_mes,
         count(*),
         count(r.user_id),
         round(coalesce(sum(r.total), 0), 2),
         round(coalesce(sum(r.total), 0) / nullif(count(*), 0), 2)
  from marts.dim_usuario u
  left join receita r on r.user_id = u.user_id
  where u.e_cliente and u.cohort_mes >= date '2025-05-01'
  group by u.cohort_mes
  having count(r.user_id) > 0
  order by u.cohort_mes desc;
$$;

create or replace function public.bi_uso_vs_receita()
returns table (
  faixa text, ordem integer, clientes bigint,
  receita_media numeric, dias_ativos_medio numeric, pct_ativos_30d numeric
)
language sql stable security invoker set search_path = '' as $$
  with receita as (
    select f.user_id, sum(f.valor_brl) as total
    from marts.fact_fatura f
    where f.tipo = 'invoice.payment_succeeded' and f.user_id is not null
    group by f.user_id
  ),
  dias as (
    select e.user_id, count(distinct e.data_brt) as dias_ativos,
           max(e.data_brt) as ultima
    from marts.fact_evento e
    group by e.user_id
  ),
  faixas as (
    select r.user_id, r.total,
      coalesce(d.dias_ativos, 0) as dias_ativos,
      coalesce(d.ultima > (now() at time zone 'America/Sao_Paulo')::date - 30, false) as ativo_30d,
      case
        when r.total < 1000 then 'Até R$ 1 mil'
        when r.total < 3000 then 'R$ 1–3 mil'
        when r.total < 6000 then 'R$ 3–6 mil'
        else 'R$ 6 mil+'
      end as faixa,
      case
        when r.total < 1000 then 1 when r.total < 3000 then 2
        when r.total < 6000 then 3 else 4
      end as ordem
    from receita r
    left join dias d on d.user_id = r.user_id
  )
  select faixa, ordem, count(*),
         round(avg(total), 2),
         round(avg(dias_ativos), 1),
         round(count(*) filter (where ativo_30d)::numeric / nullif(count(*), 0), 4)
  from faixas
  group by faixa, ordem
  order by ordem;
$$;

revoke execute on function public.bi_receita_kpis() from public, anon;
revoke execute on function public.bi_receita_mensal() from public, anon;
revoke execute on function public.bi_receita_saude_cobranca() from public, anon;
revoke execute on function public.bi_ltv_cohort() from public, anon;
revoke execute on function public.bi_uso_vs_receita() from public, anon;
grant execute on function public.bi_receita_kpis() to authenticated;
grant execute on function public.bi_receita_mensal() to authenticated;
grant execute on function public.bi_receita_saude_cobranca() to authenticated;
grant execute on function public.bi_ltv_cohort() to authenticated;
grant execute on function public.bi_uso_vs_receita() to authenticated;
