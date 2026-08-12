-- ==========================================================================
-- Sync incremental por watermark. Mesmo esqueleto de etl.sync_fact_convite:
-- watermark → fatia ≤ 45 dias → upsert → sync_state → sync_runs → raise no erro.
-- Semente 2026-03-01: o contrato bi_pulse começa em 06/04/2026 (avulsos) e
-- 25/05/2026 (campanhas/logs); a margem cobre carga retroativa da origem.
-- Backfill = 4 chamadas por função, EM SEQUÊNCIA.
-- ==========================================================================

create or replace function etl.sync_cs_disparo(p_max_dias integer default 45)
 returns integer language plpgsql security definer set search_path to ''
as $function$
declare
  v_inicio timestamptz := now(); v_wm timestamptz; v_ate timestamptz;
  v_retoque timestamptz; v_n integer;
begin
  select watermark into v_wm from etl.sync_state where tabela = 'cs_disparo';
  if v_wm is null then v_wm := timestamptz '2026-03-01 00:00:00-03'; end if;
  v_ate := least(v_wm + make_interval(days => p_max_dias), now() - interval '1 minute');
  -- Campanha muda depois de criada (agendada→enviada, contador subindo, cancelamento) e a
  -- origem não tem updated_at: só a fatia por created_at congelaria o estado. Daí revarrer
  -- os últimos 14 dias junto. Medido: a maior distância entre criação e disparo agendado é
  -- 0,35 dia — 14 dias é margem de 40x. Vai em variável (e não now() inline) porque só assim
  -- o postgres_fdw manda o filtro para o outro lado em vez de trazer a tabela inteira.
  v_retoque := now() - interval '14 days';

  if v_ate <= v_wm then
    insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, linhas, sucesso)
    values ('cs_disparo', v_inicio, now(), 0, true);
    return 0;
  end if;

  -- UPSERT: o registro muta (ver acima). criado_em/criado_em_brt ficam de fora do update
  -- porque a data de criação não se reescreve.
  insert into marts.fact_cs_disparo as d
    (disparo_id, canal, status, template, template_categoria, template_de_sistema,
     destinatarios, enviados, falhas, ignorados,
     criado_em, criado_em_brt, agendado_para, agendado_para_brt, carregado_em)
  select c.broadcast_id, c.channel, c.status, c.template, c.template_categoria,
         coalesce(c.template_de_sistema, false),
         c.recipients_count, c.sent_count, c.failed_count, c.skipped_count,
         c.created_at, (c.created_at at time zone 'America/Sao_Paulo')::date,
         c.scheduled_at, (c.scheduled_at at time zone 'America/Sao_Paulo')::date,
         now()
  from pulse.disparos_campanhas c
  where (c.created_at > v_wm and c.created_at <= v_ate)
     or c.created_at > v_retoque
  on conflict (disparo_id) do update set
    status              = excluded.status,
    template            = excluded.template,
    template_categoria  = excluded.template_categoria,
    template_de_sistema = excluded.template_de_sistema,
    destinatarios       = excluded.destinatarios,
    enviados            = excluded.enviados,
    falhas              = excluded.falhas,
    ignorados           = excluded.ignorados,
    agendado_para       = excluded.agendado_para,
    agendado_para_brt   = excluded.agendado_para_brt,
    carregado_em        = excluded.carregado_em
  -- Guarda de mudança, mesmo desenho do grupo de atendimento. Sem ela o retoque de
  -- 14 dias regravaria as ~250 campanhas recentes 48x/dia: `ultimas_linhas` nunca
  -- chegaria a zero (ninguém distinguiria "campanha nova" de "retoque tocou as
  -- mesmas de sempre") e carregado_em seria reescrito em massa sem dado novo.
  where (d.status, d.template, d.template_categoria, d.template_de_sistema,
         d.destinatarios, d.enviados, d.falhas, d.ignorados, d.agendado_para)
        is distinct from
        (excluded.status, excluded.template, excluded.template_categoria,
         excluded.template_de_sistema, excluded.destinatarios, excluded.enviados,
         excluded.falhas, excluded.ignorados, excluded.agendado_para);

  get diagnostics v_n = row_count;
  insert into etl.sync_state (tabela, watermark, ultima_execucao, ultimas_linhas)
  values ('cs_disparo', v_ate, now(), v_n)
  on conflict (tabela) do update set watermark = excluded.watermark,
    ultima_execucao = excluded.ultima_execucao, ultimas_linhas = excluded.ultimas_linhas;
  insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, linhas, sucesso)
  values ('cs_disparo', v_inicio, now(), v_n, true);
  return v_n;
exception when others then
  insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, sucesso, erro)
  values ('cs_disparo', v_inicio, now(), false, sqlerrm);
  raise;
end; $function$;


create or replace function etl.sync_cs_envio(p_max_dias integer default 45)
 returns integer language plpgsql security definer set search_path to ''
as $function$
declare
  v_inicio timestamptz := now(); v_wm timestamptz; v_ate timestamptz; v_n integer;
begin
  select watermark into v_wm from etl.sync_state where tabela = 'cs_envio';
  if v_wm is null then v_wm := timestamptz '2026-03-01 00:00:00-03'; end if;
  -- Maior tabela do contrato (49.472). A fatia mais cheia de 45 dias traz 29.310 linhas
  -- pelo FDW — por isso nada de janela maior e nada de rodar junto com outro passo.
  v_ate := least(v_wm + make_interval(days => p_max_dias), now() - interval '1 minute');

  if v_ate <= v_wm then
    insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, linhas, sucesso)
    values ('cs_envio', v_inicio, now(), 0, true);
    return 0;
  end if;

  -- APPEND-ONLY, sem retoque: o log nasce com status terminal no instante do envio — os
  -- 49.472 registros só têm sent/failed/skipped_dedup, nenhum estado intermediário para
  -- virar outra coisa depois. O 'do nothing' não é upsert disfarçado: é a garantia de que
  -- reprocessar uma fatia (ciclo que morreu no meio, watermark rebobinado na mão) não
  -- estoura a PK e derruba o ciclo inteiro.
  insert into marts.fact_cs_envio
    (envio_id, disparo_id, template_id, canal, status,
     criado_em, criado_em_brt, email_hash, fone_hash, pessoa_hash, carregado_em)
  select l.log_id, l.broadcast_id, l.template_id, l.channel, l.status,
         l.created_at, (l.created_at at time zone 'America/Sao_Paulo')::date,
         l.email_hash, l.fone_hash, coalesce(l.email_hash, l.fone_hash), now()
  from pulse.disparos_destinatarios l
  where l.created_at > v_wm and l.created_at <= v_ate
  on conflict (envio_id) do nothing;

  get diagnostics v_n = row_count;
  insert into etl.sync_state (tabela, watermark, ultima_execucao, ultimas_linhas)
  values ('cs_envio', v_ate, now(), v_n)
  on conflict (tabela) do update set watermark = excluded.watermark,
    ultima_execucao = excluded.ultima_execucao, ultimas_linhas = excluded.ultimas_linhas;
  insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, linhas, sucesso)
  values ('cs_envio', v_inicio, now(), v_n, true);
  return v_n;
exception when others then
  insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, sucesso, erro)
  values ('cs_envio', v_inicio, now(), false, sqlerrm);
  raise;
end; $function$;


create or replace function etl.sync_cs_avulso(p_max_dias integer default 45)
 returns integer language plpgsql security definer set search_path to ''
as $function$
declare
  v_inicio timestamptz := now(); v_wm timestamptz; v_ate timestamptz; v_n integer;
begin
  select watermark into v_wm from etl.sync_state where tabela = 'cs_avulso';
  if v_wm is null then v_wm := timestamptz '2026-03-01 00:00:00-03'; end if;
  v_ate := least(v_wm + make_interval(days => p_max_dias), now() - interval '1 minute');

  if v_ate <= v_wm then
    insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, linhas, sucesso)
    values ('cs_avulso', v_inicio, now(), 0, true);
    return 0;
  end if;

  -- APPEND-ONLY (mesmo argumento do envio: só sent/failed, status terminal na criação) e,
  -- na prática, congelado: nada novo desde 06/07/2026. O watermark continua andando de
  -- propósito — ele mede até onde a gente LEU, não até onde a origem escreveu. Quem separa
  -- "sync quebrado" de "origem parada" é a v_cs_frescor, olhando o último evento.
  insert into marts.fact_cs_disparo_avulso
    (envio_id, template_id, status, fone_hash, criado_em, criado_em_brt, carregado_em)
  select a.envio_id, a.template_id, a.status, a.fone_hash,
         a.created_at, (a.created_at at time zone 'America/Sao_Paulo')::date, now()
  from pulse.disparos_avulsos a
  where a.created_at > v_wm and a.created_at <= v_ate
  on conflict (envio_id) do nothing;

  get diagnostics v_n = row_count;
  insert into etl.sync_state (tabela, watermark, ultima_execucao, ultimas_linhas)
  values ('cs_avulso', v_ate, now(), v_n)
  on conflict (tabela) do update set watermark = excluded.watermark,
    ultima_execucao = excluded.ultima_execucao, ultimas_linhas = excluded.ultimas_linhas;
  insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, linhas, sucesso)
  values ('cs_avulso', v_inicio, now(), v_n, true);
  return v_n;
exception when others then
  insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, sucesso, erro)
  values ('cs_avulso', v_inicio, now(), false, sqlerrm);
  raise;
end; $function$;
