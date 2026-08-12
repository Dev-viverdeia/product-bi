-- =====================================================================
-- Carga dos 4 marts de pipeline e retenção a partir do schema `pulse`.
--
-- Estrutura, tratamento de erro e gravação de watermark copiados de
-- etl.sync_fact_convite (incremental) e etl.sync_fact_fatura (full refresh).
-- Consistência com o que existe vale mais que elegância nova.
--
-- CONEXÕES: o role remoto do Pulse tem limite de 5. As 4 funções rodam em
-- sequência dentro da MESMA sessão do pg_cron, e o postgres_fdw mantém uma
-- conexão por (servidor, usuário) por sessão — logo o ciclo inteiro custa 1
-- conexão. Nada aqui pode ser chamado em paralelo.
--
-- MODO DE CARGA POR TABELA (o porquê, tabela a tabela):
--   cs_card         full refresh  · foto, e card removido some da origem
--   cs_movimento    insert        · log append-only, evento não muda
--   cs_cancelamento upsert        · a linha muda de etapa e de status financeiro
--   cs_empresa      full refresh  · a origem não tem nenhum relógio de mutação
--
-- Nome em etl.sync_state / etl.sync_runs: 'cs_card', 'cs_movimento',
-- 'cs_cancelamento', 'cs_empresa' — casa com o rótulo que etl.executar_passo
-- extrai de 'etl.sync_cs_x()' quando precisa registrar falha.
--
-- O REGISTRO NO CICLO NÃO ESTÁ AQUI: quem chama os passos de CS é
-- etl.executar_sync_cs() (cron bi_sync_cs). Recriar etl.executar_sync() a
-- partir deste arquivo faria o CS rodar duas vezes por hora, sem nada acusar.
-- =====================================================================

-- =====================================================================
-- CARDS — full refresh
-- =====================================================================
create or replace function etl.sync_cs_card()
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_inicio timestamptz := now(); v_n integer; v_origem integer;
begin
  -- FULL REFRESH e não watermark, apesar da regra geral. Motivo: o contrato só
  -- expõe card em etapa ativa (medido: 6.572/6.572 com etapa_ativa) e a ação
  -- 'removido' existe no log de movimentos — ou seja, card removido DESAPARECE
  -- da origem. Upsert incremental nunca veria esse desaparecimento e deixaria a
  -- linha morta no mart para sempre, inflando todo funil da tela. Full refresh
  -- se cura sozinho, custa 6,5k linhas de leitura e não perde histórico:
  -- a passagem pelas etapas está em fact_cs_movimento, que é append-only.
  select count(*) into v_origem from pulse.pipeline_cards;

  -- Trava contra origem vazia por acidente (view quebrada do outro time, FDW
  -- respondendo sem dado): dado velho é ruim, mart zerado é pior — a tela
  -- mostraria "0 cards" como se fosse verdade.
  --
  -- REGISTRADO COMO FALHA, não como sucesso: gravar sucesso aqui deixaria a
  -- view quebrada do outro time invisível em todos os lugares onde alguém olha
  -- (v_cs_frescor, v_saude_pipeline_cs, checar_saude_cs) — o mart congela e a
  -- tela segue verde. O único vestígio seria sync_state.observacao, que
  -- nenhuma view e nenhuma RPC lê.
  if v_origem = 0 then
    insert into etl.sync_state (tabela, watermark, ultima_execucao, ultimas_linhas, observacao)
    values ('cs_card', now(), now(), 0, 'origem vazia: refresh abortado, mart preservado')
    on conflict (tabela) do update set ultima_execucao = excluded.ultima_execucao,
      ultimas_linhas = excluded.ultimas_linhas, observacao = excluded.observacao;
    insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, linhas, sucesso, erro)
    values ('cs_card', v_inicio, now(), 0, false,
            'origem vazia em pulse.pipeline_cards: refresh abortado, mart preservado');
    return 0;
  end if;

  delete from marts.fact_cs_card;

  insert into marts.fact_cs_card
    (card_id, empresa_id, organization_id, id_via, empresa_hash,
     quadro, etapa, etapa_ordem, etapa_ativa, plano, base_ativa, prioridade,
     entrou_na_etapa_em, entrou_na_etapa_brt, criado_em, criado_em_brt, carregado_em)
  select c.card_id, c.empresa_id, c.organization_id, c.id_via, c.empresa_hash,
         c.quadro, c.etapa, c.etapa_ordem, c.etapa_ativa, c.plano, c.base_ativa, c.prioridade,
         c.entered_stage_at, (c.entered_stage_at at time zone 'America/Sao_Paulo')::date,
         c.created_at, (c.created_at at time zone 'America/Sao_Paulo')::date,
         now()
  from pulse.pipeline_cards c;

  get diagnostics v_n = row_count;
  insert into etl.sync_state (tabela, watermark, ultima_execucao, ultimas_linhas, observacao)
  values ('cs_card', now(), now(), v_n, null)
  on conflict (tabela) do update set watermark = excluded.watermark,
    ultima_execucao = excluded.ultima_execucao, ultimas_linhas = excluded.ultimas_linhas,
    observacao = excluded.observacao;
  insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, linhas, sucesso)
  values ('cs_card', v_inicio, now(), v_n, true);
  return v_n;
exception when others then
  insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, sucesso, erro)
  values ('cs_card', v_inicio, now(), false, sqlerrm);
  raise;
end; $function$;

-- =====================================================================
-- MOVIMENTOS — incremental append-only
-- =====================================================================
create or replace function etl.sync_cs_movimento(p_max_dias integer default 45)
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_inicio timestamptz := now(); v_wm timestamptz; v_ate timestamptz; v_n integer;
begin
  select watermark into v_wm from etl.sync_state where tabela = 'cs_movimento';
  -- Piso: 01/10/2025, antes de qualquer data de negócio do contrato pulse
  -- (o evento mais antigo é solicitado_em 13/10/2025). Linha com created_at
  -- anterior ao piso nunca seria vista.
  if v_wm is null then v_wm := timestamptz '2025-10-01 00:00:00-03'; end if;
  v_ate := least(v_wm + make_interval(days => p_max_dias), now() - interval '1 minute');
  if v_ate <= v_wm then
    insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, linhas, sucesso)
    values ('cs_movimento', v_inicio, now(), 0, true);
    return 0;
  end if;

  insert into marts.fact_cs_movimento
    (movimento_id, empresa_id, organization_id, quadro,
     de_etapa, de_ordem, para_etapa, para_ordem, acao, origem, ator_hash,
     criado_em, criado_em_brt, carregado_em)
  select m.movimento_id, m.empresa_id, m.organization_id, m.quadro,
         m.de_etapa, m.de_ordem, m.para_etapa, m.para_ordem, m.acao, m.origem, m.ator_hash,
         m.created_at, (m.created_at at time zone 'America/Sao_Paulo')::date,
         now()
  from pulse.pipeline_movimentos m
  where m.created_at > v_wm and m.created_at <= v_ate
  -- INSERT puro (do nothing, não do update): movimento é evento consumado — a
  -- origem não tem updated_at e nada nele muda depois. O `do nothing` existe só
  -- para reprocessar uma fatia à mão sem estourar a PK.
  on conflict (movimento_id) do nothing;

  get diagnostics v_n = row_count;
  insert into etl.sync_state (tabela, watermark, ultima_execucao, ultimas_linhas)
  values ('cs_movimento', v_ate, now(), v_n)
  on conflict (tabela) do update set watermark = excluded.watermark,
    ultima_execucao = excluded.ultima_execucao, ultimas_linhas = excluded.ultimas_linhas;
  insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, linhas, sucesso)
  values ('cs_movimento', v_inicio, now(), v_n, true);
  return v_n;
exception when others then
  insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, sucesso, erro)
  values ('cs_movimento', v_inicio, now(), false, sqlerrm);
  raise;
end; $function$;

-- =====================================================================
-- CANCELAMENTOS — incremental com upsert
-- =====================================================================
create or replace function etl.sync_cs_cancelamento(p_max_dias integer default 45)
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_inicio timestamptz := now(); v_wm timestamptz; v_ate timestamptz; v_n integer;
begin
  select watermark into v_wm from etl.sync_state where tabela = 'cs_cancelamento';
  if v_wm is null then v_wm := timestamptz '2025-10-01 00:00:00-03'; end if;
  v_ate := least(v_wm + make_interval(days => p_max_dias), now() - interval '1 minute');
  if v_ate <= v_wm then
    insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, linhas, sucesso)
    values ('cs_cancelamento', v_inicio, now(), 0, true);
    return 0;
  end if;

  insert into marts.fact_cs_cancelamento as d
    (cancelamento_id, empresa_id, organization_id, id_via, empresa_hash,
     plano, base_ativa, solicitante_email_hash, solicitante_fone_hash,
     solicitado_em, solicitado_em_brt, origem, tipo_acordo, status_financeiro,
     tipo_pagamento, metodo_pagamento, meio_pagamento,
     valor_contratado, valor_pago, valor_reembolso, valor_multa,
     data_reembolso_multa, data_reembolso_brt, tem_motivo,
     etapa_atual, etapa_ordem, etapa_desde, etapa_desde_brt,
     criado_em, atualizado_em, carregado_em)
  select c.cancelamento_id, c.empresa_id, c.organization_id, c.id_via, c.empresa_hash,
         c.plano, c.base_ativa, c.solicitante_email_hash, c.solicitante_fone_hash,
         c.solicitado_em, (c.solicitado_em at time zone 'America/Sao_Paulo')::date,
         c.origem, c.tipo_acordo, c.status_financeiro,
         c.tipo_pagamento, c.metodo_pagamento, c.meio_pagamento,
         c.valor_contratado, c.valor_pago, c.valor_reembolso, c.valor_multa,
         c.data_reembolso_multa, (c.data_reembolso_multa at time zone 'America/Sao_Paulo')::date,
         c.tem_motivo,
         c.etapa_atual, c.etapa_ordem, c.etapa_desde,
         (c.etapa_desde at time zone 'America/Sao_Paulo')::date,
         c.created_at, c.updated_at, now()
  from pulse.cancelamentos c
  -- Janela em OR e não em greatest(created_at, updated_at): a forma com OR é
  -- deparseável pelo postgres_fdw e vai filtrada para o banco do outro time,
  -- enquanto greatest() obrigaria a trazer a tabela inteira e filtrar aqui.
  -- Precisa das duas pernas porque 8 das 271 linhas têm updated_at ANTERIOR a
  -- created_at — olhar só uma coluna deixaria essas para trás.
  where (c.created_at > v_wm and c.created_at <= v_ate)
     or (c.updated_at > v_wm and c.updated_at <= v_ate)
  -- UPSERT: a solicitação é um processo vivo. Ela anda pelas 9 etapas do funil,
  -- fecha acordo, muda status financeiro e ganha valor de reembolso/multa
  -- semanas depois de aberta. Insert puro congelaria a linha no dia 1.
  on conflict (cancelamento_id) do update set
    organization_id = excluded.organization_id,
    id_via = excluded.id_via,
    empresa_hash = excluded.empresa_hash,
    plano = excluded.plano,
    base_ativa = excluded.base_ativa,
    solicitante_email_hash = excluded.solicitante_email_hash,
    solicitante_fone_hash = excluded.solicitante_fone_hash,
    solicitado_em = excluded.solicitado_em,
    solicitado_em_brt = excluded.solicitado_em_brt,
    origem = excluded.origem,
    tipo_acordo = excluded.tipo_acordo,
    status_financeiro = excluded.status_financeiro,
    tipo_pagamento = excluded.tipo_pagamento,
    metodo_pagamento = excluded.metodo_pagamento,
    meio_pagamento = excluded.meio_pagamento,
    valor_contratado = excluded.valor_contratado,
    valor_pago = excluded.valor_pago,
    valor_reembolso = excluded.valor_reembolso,
    valor_multa = excluded.valor_multa,
    data_reembolso_multa = excluded.data_reembolso_multa,
    data_reembolso_brt = excluded.data_reembolso_brt,
    tem_motivo = excluded.tem_motivo,
    etapa_atual = excluded.etapa_atual,
    etapa_ordem = excluded.etapa_ordem,
    etapa_desde = excluded.etapa_desde,
    etapa_desde_brt = excluded.etapa_desde_brt,
    atualizado_em = excluded.atualizado_em,
    carregado_em = excluded.carregado_em;

  get diagnostics v_n = row_count;
  insert into etl.sync_state (tabela, watermark, ultima_execucao, ultimas_linhas)
  values ('cs_cancelamento', v_ate, now(), v_n)
  on conflict (tabela) do update set watermark = excluded.watermark,
    ultima_execucao = excluded.ultima_execucao, ultimas_linhas = excluded.ultimas_linhas;
  insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, linhas, sucesso)
  values ('cs_cancelamento', v_inicio, now(), v_n, true);
  return v_n;
exception when others then
  insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, sucesso, erro)
  values ('cs_cancelamento', v_inicio, now(), false, sqlerrm);
  raise;
end; $function$;

-- =====================================================================
-- DIM DE RETENÇÃO — full refresh
-- =====================================================================
create or replace function etl.sync_cs_empresa()
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_inicio timestamptz := now(); v_n integer; v_origem integer;
begin
  -- FULL REFRESH porque não há alternativa honesta: pulse.retencao NÃO entrega
  -- created_at nem updated_at — não existe relógio de mutação para servir de
  -- watermark. solicitado_em não serve (8 nulos, e não se move quando o
  -- desfecho muda) e etapa_desde só anda em troca de etapa. São 232 linhas de
  -- estado deduplicado; reler tudo é mais barato que fingir incremento.
  select count(*) into v_origem from pulse.retencao;

  -- Mesma trava do cs_card, e pelo mesmo motivo: registrada como FALHA para a
  -- origem vazia não passar despercebida em toda tela de saúde.
  if v_origem = 0 then
    insert into etl.sync_state (tabela, watermark, ultima_execucao, ultimas_linhas, observacao)
    values ('cs_empresa', now(), now(), 0, 'origem vazia: refresh abortado, mart preservado')
    on conflict (tabela) do update set ultima_execucao = excluded.ultima_execucao,
      ultimas_linhas = excluded.ultimas_linhas, observacao = excluded.observacao;
    insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, linhas, sucesso, erro)
    values ('cs_empresa', v_inicio, now(), 0, false,
            'origem vazia em pulse.retencao: refresh abortado, mart preservado');
    return 0;
  end if;

  delete from marts.dim_cs_empresa;

  insert into marts.dim_cs_empresa
    (cliente_key, id_via, empresa_hash, organization_id, atribuicao_org,
     plano, base_ativa, desfecho, etapa_atual, etapa_ordem, etapa_desde, etapa_desde_brt,
     tipo_acordo, status_financeiro, solicitado_em, solicitado_em_brt, carregado_em)
  with org_por_hash as (
    -- Lida direto de pulse.cancelamentos (271 linhas, leitura barata) e não do
    -- mart local, para a dim não depender de o backfill em fatias de 45 dias
    -- de cs_cancelamento já ter terminado.
    -- empresa_hash NÃO é único lá (8 hashes repetem), por isso a agregação
    -- conta orgs DISTINTAS: hash que resolve mais de uma org é ambíguo e fica
    -- sem organization_id, em vez de escolher uma em silêncio.
    -- array_agg e não min(): não existe min(uuid) no Postgres. Como o valor só
    -- é usado quando orgs = 1, o primeiro elemento É a org única.
    select c.empresa_hash,
           count(distinct c.organization_id) as orgs,
           (array_agg(distinct c.organization_id))[1] as organization_id
    from pulse.cancelamentos c
    where c.empresa_hash is not null and c.organization_id is not null
    group by c.empresa_hash
  )
  select r.cliente_key,
         r.id_via::uuid,
         r.empresa_hash,
         case when o.orgs = 1 then o.organization_id end,
         case when o.orgs = 1 then 'unica' when o.orgs > 1 then 'ambigua' else 'sem_org' end,
         r.plano, r.base_ativa, r.desfecho,
         r.etapa_atual, r.etapa_ordem,
         r.etapa_desde, (r.etapa_desde at time zone 'America/Sao_Paulo')::date,
         r.tipo_acordo, r.status_financeiro,
         r.solicitado_em, (r.solicitado_em at time zone 'America/Sao_Paulo')::date,
         now()
  from pulse.retencao r
  left join org_por_hash o on o.empresa_hash = r.empresa_hash;

  get diagnostics v_n = row_count;
  insert into etl.sync_state (tabela, watermark, ultima_execucao, ultimas_linhas, observacao)
  values ('cs_empresa', now(), now(), v_n, null)
  on conflict (tabela) do update set watermark = excluded.watermark,
    ultima_execucao = excluded.ultima_execucao, ultimas_linhas = excluded.ultimas_linhas,
    observacao = excluded.observacao;
  insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, linhas, sucesso)
  values ('cs_empresa', v_inicio, now(), v_n, true);
  return v_n;
exception when others then
  insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, sucesso, erro)
  values ('cs_empresa', v_inicio, now(), false, sqlerrm);
  raise;
end; $function$;
