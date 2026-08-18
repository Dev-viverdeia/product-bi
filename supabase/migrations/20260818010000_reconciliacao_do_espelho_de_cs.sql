-- Reconciliação do espelho de CS: exclusão propaga e valor mutável volta
--
-- Passo 2 de 5 da Fase 2. O espelho do Pulse tinha os dois defeitos que já
-- custaram caro no espelho da plataforma, e nenhuma das redes construídas lá
-- (etl.propagar_exclusoes, etl.reconciliar_valores) o alcançava:
--
-- 1. EXCLUSÃO NÃO PROPAGAVA. Medido em 18/08: 3 cancelamentos e 1 movimento
--    vivos no mart e apagados na origem. O sync é incremental por watermark e
--    linha apagada não tem updated_at — mesmo limite de desenho de 13/08.
--    Pior: a origem nem sempre carimba a exclusão lógica (2 dos 3 fantasmas
--    têm deleted_at posterior ao updated_at).
-- 2. VALOR MUTÁVEL NÃO VOLTAVA. O watermark de sync_cs_cancelamento é o
--    updated_at de pipeline_cancelamentos, mas etapa, plano, base ativa e os
--    hashes vêm do card em pipeline_empresas — que muda sem carimbar o
--    cancelamento. Medido: 113 de 295 linhas com pelo menos uma coluna
--    divergente (38%), nenhuma alcançável pelo watermark. Em atendimento, a
--    cauda só relê ticket aberto: reatribuição de atendente depois do
--    fechamento (28 das 29 divergências) não volta nunca.
--
-- Referência em 18/08, pré-aplicação: cancelamento 524 no mart × 521 na origem
-- (3 fantasmas) · movimento 11.784 × 11.788 (1 fantasma; a origem está à frente
-- por sync pendente, o que é normal) · atendimento 2.650 × 2.650 (zero). No
-- mesmo dia a origem recebeu um BACKFILL de 226 cancelamentos históricos
-- (created_at de 18/08, solicitado_em desde jun/2025, origem 'manual') — os
-- totais crescem, os fantasmas não.
--
-- TRÊS CORREÇÕES SOBRE O DESENHO ORIGINAL, todas da conferência:
--
-- (a) O DELETE de movimento é ESCOPADO POR QUADRO VIVO. bi_pulse.
--     pipeline_movimentos faz INNER JOIN com pipelines, e a tabela base não tem
--     nenhuma foreign key: apagar um quadro do Kanban faz os movimentos dele
--     sumirem da VIEW com as linhas vivas na BASE. Sem o escopo, um quadro
--     pequeno apagado passaria por baixo do teto de 1% e o arquivo seria
--     purgado em silêncio, de madrugada.
-- (b) etl.origem_da_tabela ganha o ramo dos passos de CS. Sem ele, a falha de
--     'etl.propagar_exclusoes_cs()' seria rotulada 'plataforma' e acenderia o
--     card de saúde ERRADO — o alarme de CS ficaria mudo.
-- (c) A reconciliação NÃO grava carregado_em. Gravar now() faria o frescor de
--     CS saltar às 04:35 sem sync nenhum ter rodado.
--
-- SEM purga de insights.achado_cache: CS não tem regra no motor (0 linhas em
-- insights.regra para a tela, 0 chaves 'cs|%' no cache) e nenhum calculador lê
-- fact_cs_*. Nenhuma frase de tela cita número que esta migration move.

-- ---------------------------------------------------------------------------
-- 0) O roteador de saúde aprende o ramo de CS
-- ---------------------------------------------------------------------------

create or replace function etl.origem_da_tabela(p_tabela text)
returns text
language sql immutable
set search_path to ''
as $function$
  select case
    when p_tabela like 'cs\_%' then 'cs'
    when p_tabela = 'saude_cs' then 'cs'
    -- Os passos diários de CS entram pelo rótulo completo da função, porque
    -- etl.executar_passo grava o rótulo verbatim quando o passo falha. Sem
    -- este ramo, a guarda de sanidade abortando apareceria no card de saúde
    -- da PLATAFORMA — e o alarme de CS ficaria mudo.
    when p_tabela like 'etl.%\_cs()' then 'cs'
    else 'plataforma'
  end;
$function$;

-- ---------------------------------------------------------------------------
-- 1) Exclusão propaga — com as duas guardas em cada bloco
-- ---------------------------------------------------------------------------

create or replace function etl.propagar_exclusoes_cs()
returns table (tabela text, criterio text, linhas_removidas bigint)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_origem  bigint;
  v_mart    bigint;
  v_alvo    bigint;
  v_teto    bigint;
  v_n       bigint;
begin
  -- ---- cancelamento -------------------------------------------------------
  -- Exclusão LÓGICA que a view esconde: bi_pulse.cancelamentos filtra
  -- deleted_at is null, então sumir da view é a única evidência que temos.
  select count(*) into v_origem from pulse.cancelamentos;
  select count(*) into v_mart   from marts.fact_cs_cancelamento;

  if v_origem < greatest((v_mart * 0.9)::bigint, 100) then
    raise exception
      'origem implausível em pulse.cancelamentos: % linhas contra % no mart. Exclusão NÃO propagada — suspeitar de view vazia do Pulse ou FDW.',
      v_origem, v_mart;
  end if;

  select count(*) into v_alvo
  from marts.fact_cs_cancelamento f
  where not exists (select 1 from pulse.cancelamentos o
                     where o.cancelamento_id = f.cancelamento_id);

  v_teto := greatest((v_mart * 0.01)::bigint, 20);
  if v_alvo > v_teto then
    raise exception
      'fact_cs_cancelamento: % linhas sumiram da origem, acima do teto de %. Passo abortado — conferir se o Pulse começou a apagar em lote antes de afrouxar o teto.',
      v_alvo, v_teto;
  end if;

  delete from marts.fact_cs_cancelamento f
   where not exists (select 1 from pulse.cancelamentos o
                      where o.cancelamento_id = f.cancelamento_id);
  get diagnostics v_n = row_count;
  tabela := 'fact_cs_cancelamento'; criterio := 'chave'; linhas_removidas := v_n; return next;

  -- ---- movimento ----------------------------------------------------------
  -- ESCOPADO POR QUADRO VIVO, e isso não é opcional. A view faz INNER JOIN com
  -- pipelines e a base não tem FK: quadro apagado leva os movimentos dele para
  -- fora da VIEW com as linhas vivas na BASE. "Sumiu da view" só é prova de
  -- exclusão da LINHA quando o quadro dela ainda está lá.
  select count(*) into v_origem from pulse.pipeline_movimentos;
  select count(*) into v_mart   from marts.fact_cs_movimento;

  if v_origem < greatest((v_mart * 0.9)::bigint, 100) then
    raise exception
      'origem implausível em pulse.pipeline_movimentos: % linhas contra % no mart. Exclusão NÃO propagada.',
      v_origem, v_mart;
  end if;

  select count(*) into v_alvo
  from marts.fact_cs_movimento f
  where not exists (select 1 from pulse.pipeline_movimentos o
                     where o.movimento_id = f.movimento_id)
    and exists (select 1 from pulse.pipeline_movimentos o2
                 where o2.quadro = f.quadro);

  v_teto := greatest((v_mart * 0.01)::bigint, 20);
  if v_alvo > v_teto then
    raise exception
      'fact_cs_movimento: % linhas sumiram da origem, acima do teto de %. Passo abortado — este é o alarme que separa "correção operacional" de "o Pulse ligou retenção e o nosso arquivo está sendo apagado".',
      v_alvo, v_teto;
  end if;

  delete from marts.fact_cs_movimento f
   where not exists (select 1 from pulse.pipeline_movimentos o
                      where o.movimento_id = f.movimento_id)
     and exists (select 1 from pulse.pipeline_movimentos o2
                  where o2.quadro = f.quadro);
  get diagnostics v_n = row_count;
  tabela := 'fact_cs_movimento'; criterio := 'chave+quadro'; linhas_removidas := v_n; return next;

  -- ---- atendimento --------------------------------------------------------
  -- Zero fantasma hoje, e a cadeia de FKs da origem tem ON DELETE CASCADE
  -- (wa_tickets -> wa_threads -> wa_contacts), então ausência na view É
  -- exclusão de verdade. Entra porque o sync é upsert incremental: se o Pulse
  -- apagar um ticket amanhã, ninguém veria. Custo: uma contagem por dia.
  select count(*) into v_origem from pulse.atendimento_tickets;
  select count(*) into v_mart   from marts.fact_cs_atendimento;

  if v_origem < greatest((v_mart * 0.9)::bigint, 100) then
    raise exception
      'origem implausível em pulse.atendimento_tickets: % linhas contra % no mart. Exclusão NÃO propagada.',
      v_origem, v_mart;
  end if;

  select count(*) into v_alvo
  from marts.fact_cs_atendimento f
  where not exists (select 1 from pulse.atendimento_tickets o
                     where o.ticket_id = f.ticket_id);

  v_teto := greatest((v_mart * 0.01)::bigint, 20);
  if v_alvo > v_teto then
    raise exception
      'fact_cs_atendimento: % linhas sumiram da origem, acima do teto de %. Passo abortado.',
      v_alvo, v_teto;
  end if;

  delete from marts.fact_cs_atendimento f
   where not exists (select 1 from pulse.atendimento_tickets o
                      where o.ticket_id = f.ticket_id);
  get diagnostics v_n = row_count;
  tabela := 'fact_cs_atendimento'; criterio := 'chave'; linhas_removidas := v_n; return next;

  return;
end;
$function$;

comment on function etl.propagar_exclusoes_cs() is
  'Apaga do espelho de CS a linha que sumiu da origem do Pulse. Cancelamento por chave (exclusão lógica que a view esconde), movimento por chave ESCOPADA POR QUADRO VIVO (a view faz inner join com pipelines e a base não tem FK — quadro apagado esconderia linhas vivas, e sem o escopo o arquivo seria purgado em silêncio), atendimento por chave (cascade real na origem). Aborta se a origem vier com menos de 90% do mart, ou se a remoção passar de 1% do mart (piso 20). NÃO cobre envio, disparo e status diário de propósito: medidos coluna a coluna, zero divergência, e a política de retenção deles é de outro time.';

revoke all on function etl.propagar_exclusoes_cs() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2) Valor mutável volta — sem tocar no frescor
-- ---------------------------------------------------------------------------

create or replace function etl.reconciliar_valores_cs()
returns table (tabela text, linhas_corrigidas bigint)
language plpgsql
security definer
set search_path to ''
as $function$
declare v_n bigint;
begin
  -- CANCELAMENTO — releitura integral por chave, porque a parte que muda
  -- (etapa, plano, base ativa, hashes) vem do card em pipeline_empresas e
  -- nenhum relógio nosso a cobre. carregado_em fica como está: frescor mede
  -- chegada de dado novo, não manutenção — gravá-lo aqui faria o frescor de
  -- CS saltar às 04:35 sem sync nenhum ter rodado.
  update marts.fact_cs_cancelamento f
     set empresa_id           = c.empresa_id,
         organization_id      = c.organization_id,
         id_via               = c.id_via,
         empresa_hash         = c.empresa_hash,
         plano                = c.plano,
         base_ativa           = c.base_ativa,
         solicitante_email_hash = c.solicitante_email_hash,
         solicitante_fone_hash  = c.solicitante_fone_hash,
         solicitado_em        = c.solicitado_em,
         solicitado_em_brt    = (c.solicitado_em at time zone 'America/Sao_Paulo')::date,
         origem               = c.origem,
         tipo_acordo          = c.tipo_acordo,
         status_financeiro    = c.status_financeiro,
         tipo_pagamento       = c.tipo_pagamento,
         metodo_pagamento     = c.metodo_pagamento,
         meio_pagamento       = c.meio_pagamento,
         valor_contratado     = c.valor_contratado,
         valor_pago           = c.valor_pago,
         valor_reembolso      = c.valor_reembolso,
         valor_multa          = c.valor_multa,
         data_reembolso_multa = c.data_reembolso_multa,
         data_reembolso_brt   = (c.data_reembolso_multa at time zone 'America/Sao_Paulo')::date,
         tem_motivo           = c.tem_motivo,
         etapa_atual          = c.etapa_atual,
         etapa_ordem          = c.etapa_ordem,
         etapa_desde          = c.etapa_desde,
         etapa_desde_brt      = (c.etapa_desde at time zone 'America/Sao_Paulo')::date,
         atualizado_em        = c.updated_at
    from pulse.cancelamentos c
   where c.cancelamento_id = f.cancelamento_id
     -- Só grava o que de fato mudou: sem isto seriam centenas de updates no-op
     -- por dia e `linhas_corrigidas` nunca chegaria a zero.
     and (f.empresa_id, f.organization_id, f.id_via, f.empresa_hash, f.plano, f.base_ativa,
          f.solicitante_email_hash, f.solicitante_fone_hash, f.solicitado_em, f.origem,
          f.tipo_acordo, f.status_financeiro, f.tipo_pagamento, f.metodo_pagamento,
          f.meio_pagamento, f.valor_contratado, f.valor_pago, f.valor_reembolso,
          f.valor_multa, f.data_reembolso_multa, f.tem_motivo,
          f.etapa_atual, f.etapa_ordem, f.etapa_desde, f.atualizado_em)
         is distinct from
         (c.empresa_id, c.organization_id, c.id_via, c.empresa_hash, c.plano, c.base_ativa,
          c.solicitante_email_hash, c.solicitante_fone_hash, c.solicitado_em, c.origem,
          c.tipo_acordo, c.status_financeiro, c.tipo_pagamento, c.metodo_pagamento,
          c.meio_pagamento, c.valor_contratado, c.valor_pago, c.valor_reembolso,
          c.valor_multa, c.data_reembolso_multa, c.tem_motivo,
          c.etapa_atual, c.etapa_ordem, c.etapa_desde, c.updated_at);
  get diagnostics v_n = row_count;
  tabela := 'fact_cs_cancelamento'; linhas_corrigidas := v_n; return next;

  -- ATENDIMENTO — a cauda do sync só relê ticket não fechado; a edição
  -- posterior (reatribuição de atendente: 28 das 29 divergências medidas) não
  -- volta nunca sem este passo. `desfecho`, `*_brt` e os `seg_*` repetem, letra
  -- por letra, a expressão de etl.sync_cs_atendimento — se a REGRA de derivação
  -- mudar, muda nos dois lugares, senão a reconciliação desfaz o sync toda noite.
  update marts.fact_cs_atendimento f
     set thread_id                       = t.thread_id,
         abriu_em                        = t.created_at,
         abriu_em_brt                    = (t.created_at at time zone 'America/Sao_Paulo')::date,
         reaberto_em                     = t.opened_at,
         primeira_resposta_em            = t.first_response_at,
         resolvido_em                    = t.resolved_at,
         resolvido_em_brt                = (t.resolved_at at time zone 'America/Sao_Paulo')::date,
         fechado_em                      = t.closed_at,
         seg_ate_primeira_resposta       = extract(epoch from t.first_response_at - t.created_at)::integer,
         seg_ate_resolucao               = extract(epoch from t.resolved_at      - t.created_at)::integer,
         ticket_status                   = t.status::text,
         prioridade                      = t.priority::text,
         desfecho                        = case
                                             when t.resolved_at is not null then 'resolvido'
                                             when t.closed_at   is not null then 'encerrado_sem_resolucao'
                                             when t.status::text = 'closed' then 'fechado_sem_marcacao'
                                             else 'em_aberto'
                                           end,
         sla_primeira_resposta_estourado = t.sla_first_response_breached,
         sla_resolucao_estourado         = t.sla_resolution_breached,
         pausado                         = t.pausado,
         modo_ia                         = t.ai_mode,
         tem_atendente_humano            = t.tem_atendente_humano,
         atendente_hash                  = t.atendente_hash,
         canal                           = t.canal,
         canal_numero                    = t.canal_numero,
         contato_hash                    = t.contato_hash
    from pulse.atendimento_tickets t
   where t.ticket_id = f.ticket_id
     and (f.thread_id, f.abriu_em, f.reaberto_em, f.primeira_resposta_em, f.resolvido_em,
          f.fechado_em, f.ticket_status, f.prioridade, f.sla_primeira_resposta_estourado,
          f.sla_resolucao_estourado, f.pausado, f.modo_ia, f.tem_atendente_humano,
          f.atendente_hash, f.canal, f.canal_numero, f.contato_hash)
         is distinct from
         (t.thread_id, t.created_at, t.opened_at, t.first_response_at, t.resolved_at,
          t.closed_at, t.status::text, t.priority::text, t.sla_first_response_breached,
          t.sla_resolution_breached, t.pausado, t.ai_mode, t.tem_atendente_humano,
          t.atendente_hash, t.canal, t.canal_numero, t.contato_hash);
  get diagnostics v_n = row_count;
  tabela := 'fact_cs_atendimento'; linhas_corrigidas := v_n; return next;

  return;
end;
$function$;

comment on function etl.reconciliar_valores_cs() is
  'Relê por chave o valor mutável do espelho de CS e regrava só o que mudou. Existe porque o watermark de sync_cs_cancelamento é o updated_at de pipeline_cancelamentos, que não cobre o card em pipeline_empresas de onde a view traz etapa, plano e base ativa; e porque a cauda de sync_cs_atendimento só relê ticket não fechado. NÃO grava carregado_em: frescor mede chegada de dado, não manutenção. Disparo e status diário ficam de fora: medidos coluna a coluna, zero divergência.';

revoke all on function etl.reconciliar_valores_cs() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3) O canário
-- ---------------------------------------------------------------------------

create or replace function marts.contar_linhas_de_apagados_cs()
returns bigint
language sql
security definer
stable
set search_path to ''
as $function$
  select
    (select count(*) from marts.fact_cs_cancelamento f
      where not exists (select 1 from pulse.cancelamentos o
                         where o.cancelamento_id = f.cancelamento_id))
  + (select count(*) from marts.fact_cs_movimento f
      where not exists (select 1 from pulse.pipeline_movimentos o
                         where o.movimento_id = f.movimento_id)
        and exists (select 1 from pulse.pipeline_movimentos o2
                     where o2.quadro = f.quadro))
  + (select count(*) from marts.fact_cs_atendimento f
      where not exists (select 1 from pulse.atendimento_tickets o
                         where o.ticket_id = f.ticket_id));
$function$;

comment on function marts.contar_linhas_de_apagados_cs() is
  'Diagnóstico manual, o par de marts.contar_linhas_de_apagados() para o espelho do Pulse — nenhum cron ou tela o chama, e é assim de propósito. Zera na execução do cron diário (04:25 BRT) e deriva ao longo do dia conforme o Pulse apaga; a régua honesta é a de logo após o cron, conferida junto com a última execução do job em etl.sync_runs, nunca sozinha. Usa o MESMO predicado escopado por quadro vivo do passo de exclusão: linha de quadro que sumiu da view não conta como fantasma, porque não é.';

revoke all on function marts.contar_linhas_de_apagados_cs() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4) Os dois passos entram no ciclo diário
-- ---------------------------------------------------------------------------
-- Horário escolhido, não sorteado: bi_sync_cs roda aos :15 e :45; 07:25 e 07:35
-- UTC (04:25/04:35 BRT) caem na folga entre os ciclos, e depois dos
-- equivalentes da plataforma (07:10 e 07:20) — a madrugada inteira lê a mesma
-- ordem: primeiro apaga o que não existe mais, depois corrige o que sobrou.

select cron.schedule(
  'bi_propagar_exclusoes_cs',
  '25 7 * * *',
  $cron$select etl.executar_passo('etl.propagar_exclusoes_cs()')$cron$
);

select cron.schedule(
  'bi_reconciliar_valores_cs',
  '35 7 * * *',
  $cron$select etl.executar_passo('etl.reconciliar_valores_cs()')$cron$
);

-- ---------------------------------------------------------------------------
-- 5) Primeira execução aqui dentro
-- ---------------------------------------------------------------------------
-- Sem isto a tela só ficaria correta às 04:25 de amanhã. As duas rodam com as
-- guardas ligadas: se alguma abortar, a migration inteira falha — que é o
-- comportamento certo, porque abortar significa origem implausível.

select * from etl.propagar_exclusoes_cs();
select * from etl.reconciliar_valores_cs();

-- Esperado: 0.
select marts.contar_linhas_de_apagados_cs() as linhas_de_apagados_cs;
