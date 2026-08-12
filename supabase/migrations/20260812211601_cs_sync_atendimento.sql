-- ============================================================
-- Sync do atendimento — janela móvel + reconciliação de cauda
-- ============================================================
-- POR QUE NÃO É WATERMARK PURO SOBRE created_at:
-- o ticket muta depois de criado (status, resolved_at, closed_at) e o contrato
-- NÃO entrega updated_at. Medido em 12/08/2026: o fechamento acontece com p50 de
-- 6,6 dias após a criação, p90 de 75,8 e p99 de 117,8 (máx 147); 456 tickets
-- fecharam mais de 30 dias depois de criados. Watermark sobre created_at
-- congelaria esses tickets como "em aberto" para sempre.
--
-- O desenho tem duas partes, numa única sentença (uma ida só ao servidor remoto):
--   1. JANELA MÓVEL — created_at OU opened_at dentro da fatia. O ramo de
--      opened_at é o que captura o ticket reaberto, cujo created_at é antigo.
--   2. CAUDA — todo ticket que no mart ainda não é terminal (aberto, ou fechado
--      sem data), relido por ticket_id independentemente da idade. É a única
--      forma de ver um closed_at que chegou 100 dias depois, porque nesse evento
--      nenhuma das duas datas de janela se move. Hoje são 918 linhas.
-- UPSERT, nunca insert puro: o mesmo ticket volta em ciclos diferentes por
-- construção — é essa a razão de existir da cauda.
create or replace function etl.sync_cs_atendimento(
  p_max_dias    integer default 45,
  p_janela_dias integer default 7,
  p_max_cauda   integer default 5000
)
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_inicio timestamptz := now();
  v_wm     timestamptz;
  v_desde  timestamptz;
  v_ate    timestamptz;
  v_cauda  uuid[];
  v_n      integer;
  v_obs    text;
begin
  select watermark into v_wm from etl.sync_state where tabela = 'cs_atendimento';
  -- o dado mais antigo da origem é de 09/03/2026
  if v_wm is null then v_wm := timestamptz '2026-03-01 00:00:00-03'; end if;

  -- a janela recua p_janela_dias antes do watermark (edição recente entra de
  -- novo) e a fatia continua limitada a p_max_dias por chamada
  v_desde := v_wm - make_interval(days => p_janela_dias);
  v_ate   := least(v_desde + make_interval(days => p_max_dias), now() - interval '1 minute');

  select coalesce(array_agg(c.ticket_id), '{}'::uuid[]) into v_cauda
  from (
    select a.ticket_id
    from marts.fact_cs_atendimento a
    where a.ticket_status <> 'closed' or a.fechado_em is null
    order by a.abriu_em desc
    limit p_max_cauda
  ) c;

  insert into marts.fact_cs_atendimento as d (
    ticket_id, thread_id, abriu_em, abriu_em_brt, reaberto_em,
    primeira_resposta_em, resolvido_em, resolvido_em_brt, fechado_em,
    seg_ate_primeira_resposta, seg_ate_resolucao,
    ticket_status, prioridade, desfecho,
    sla_primeira_resposta_estourado, sla_resolucao_estourado, pausado,
    modo_ia, tem_atendente_humano, atendente_hash,
    canal, canal_numero, contato_hash, carregado_em
  )
  select
    t.ticket_id,
    t.thread_id,
    t.created_at,
    (t.created_at at time zone 'America/Sao_Paulo')::date,
    t.opened_at,
    t.first_response_at,
    t.resolved_at,
    (t.resolved_at at time zone 'America/Sao_Paulo')::date,
    t.closed_at,
    extract(epoch from t.first_response_at - t.created_at)::integer,
    extract(epoch from t.resolved_at      - t.created_at)::integer,
    t.status::text,
    t.priority::text,
    case
      when t.resolved_at is not null      then 'resolvido'
      when t.closed_at is not null        then 'encerrado_sem_resolucao'
      when t.status::text = 'closed'      then 'fechado_sem_marcacao'
      else 'em_aberto'
    end,
    t.sla_first_response_breached,
    t.sla_resolution_breached,
    t.pausado,
    t.ai_mode,
    t.tem_atendente_humano,
    t.atendente_hash,
    t.canal,
    t.canal_numero,
    t.contato_hash,
    now()
  from pulse.atendimento_tickets t
  where (t.created_at > v_desde and t.created_at <= v_ate)
     or (t.opened_at  > v_desde and t.opened_at  <= v_ate)
     or (t.ticket_id = any (v_cauda))
  on conflict (ticket_id) do update set
    thread_id                       = excluded.thread_id,
    abriu_em                        = excluded.abriu_em,
    abriu_em_brt                    = excluded.abriu_em_brt,
    reaberto_em                     = excluded.reaberto_em,
    primeira_resposta_em            = excluded.primeira_resposta_em,
    resolvido_em                    = excluded.resolvido_em,
    resolvido_em_brt                = excluded.resolvido_em_brt,
    fechado_em                      = excluded.fechado_em,
    seg_ate_primeira_resposta       = excluded.seg_ate_primeira_resposta,
    seg_ate_resolucao               = excluded.seg_ate_resolucao,
    ticket_status                   = excluded.ticket_status,
    prioridade                      = excluded.prioridade,
    desfecho                        = excluded.desfecho,
    sla_primeira_resposta_estourado = excluded.sla_primeira_resposta_estourado,
    sla_resolucao_estourado         = excluded.sla_resolucao_estourado,
    pausado                         = excluded.pausado,
    modo_ia                         = excluded.modo_ia,
    tem_atendente_humano            = excluded.tem_atendente_humano,
    atendente_hash                  = excluded.atendente_hash,
    canal                           = excluded.canal,
    canal_numero                    = excluded.canal_numero,
    contato_hash                    = excluded.contato_hash,
    carregado_em                    = excluded.carregado_em
  -- Só grava se algum valor de origem mudou de fato. A cauda relê ~918 linhas a
  -- cada 30 min; sem esta cláusula seriam ~44 mil updates no-op por dia numa
  -- tabela de 2,5 mil linhas — bloat e autovacuum sem nenhum dado novo. Com ela,
  -- `linhas` em sync_runs passa a significar "tickets que mudaram", que é o
  -- número que interessa. As colunas derivadas (*_brt, seg_*, desfecho) ficam
  -- fora da comparação porque são função das que estão dentro; se a REGRA de
  -- derivação mudar, isso é backfill de migration, não trabalho do sync.
  where (d.thread_id, d.abriu_em, d.reaberto_em, d.primeira_resposta_em,
         d.resolvido_em, d.fechado_em, d.ticket_status, d.prioridade,
         d.sla_primeira_resposta_estourado, d.sla_resolucao_estourado, d.pausado,
         d.modo_ia, d.tem_atendente_humano, d.atendente_hash,
         d.canal, d.canal_numero, d.contato_hash)
        is distinct from
        (excluded.thread_id, excluded.abriu_em, excluded.reaberto_em,
         excluded.primeira_resposta_em, excluded.resolvido_em, excluded.fechado_em,
         excluded.ticket_status, excluded.prioridade,
         excluded.sla_primeira_resposta_estourado, excluded.sla_resolucao_estourado,
         excluded.pausado, excluded.modo_ia, excluded.tem_atendente_humano,
         excluded.atendente_hash, excluded.canal, excluded.canal_numero,
         excluded.contato_hash);

  get diagnostics v_n = row_count;

  v_obs := format('janela %s -> %s + %s na cauda',
    to_char(v_desde at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI'),
    to_char(v_ate   at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI'),
    cardinality(v_cauda));
  if cardinality(v_cauda) >= p_max_cauda then
    v_obs := v_obs || ' — TETO DA CAUDA ATINGIDO: ticket antigo pode estar sem reconciliação';
  end if;

  -- greatest() para o watermark nunca andar para trás quando a fatia fecha antes
  -- dele (acontece se a função for chamada duas vezes no mesmo minuto)
  insert into etl.sync_state (tabela, watermark, ultima_execucao, ultimas_linhas, observacao)
  values ('cs_atendimento', greatest(v_wm, v_ate), now(), v_n, v_obs)
  on conflict (tabela) do update set watermark = excluded.watermark,
    ultima_execucao = excluded.ultima_execucao, ultimas_linhas = excluded.ultimas_linhas,
    observacao = excluded.observacao;
  insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, linhas, sucesso)
  values ('cs_atendimento', v_inicio, now(), v_n, true);
  return v_n;
exception when others then
  insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, sucesso, erro)
  values ('cs_atendimento', v_inicio, now(), false, sqlerrm);
  raise;
end; $function$;
