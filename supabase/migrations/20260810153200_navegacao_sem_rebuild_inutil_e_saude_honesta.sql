-- Pipeline: fact_navegacao para de reconstruir sobre fonte congelada, e a saúde
-- do pipeline para de contar o passo local como se a origem tivesse sincronizado.
--
-- Contexto (parada de 08/08/2026 15:30 BRT em diante): o FDW é recusado na
-- camada de rede, os 19 passos de origem falham e só fact_navegacao "passa" —
-- ele é local, derivado de marts.fact_pageview. Dois efeitos ruins:
--
--   1. 335.440 linhas apagadas e reinseridas a cada 30 min sobre uma fonte que
--      não avança (88 reconstruções idênticas só nesta parada);
--   2. bi_saude_pipeline reportando tabelas_ok = 1, o que sugere que algo de
--      origem sincronizou quando nada sincronizou.
--
-- A régua nova: o watermark de fact_navegacao passa a guardar até onde a FONTE
-- foi consumida (o watermark de fact_pageview), não o now() da execução. Assim a
-- comparação "a fonte andou?" é o próprio watermark, sem estado paralelo.

-- Assinatura muda (ganha p_forcar): drop explícito para não criar sobrecarga.
-- etl.executar_sync() chama por texto (execute format), então não há dependência
-- estrutural para quebrar.
drop function if exists etl.sync_fact_navegacao(integer);

create or replace function etl.sync_fact_navegacao(
  p_dias integer default 45,
  -- Reconstrução manual com janela diferente da que gerou o mart precisa
  -- ignorar o atalho — sem isso, sync_fact_navegacao(90) não faria nada.
  p_forcar boolean default false
)
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_inicio timestamptz := now();
  v_n integer;
  v_corte date;
  v_fonte timestamptz;      -- até onde fact_pageview foi consumido
  v_construido timestamptz; -- até onde este mart já refletiu a fonte
begin
  select watermark into v_fonte
    from etl.sync_state where tabela = 'fact_pageview';
  select watermark into v_construido
    from etl.sync_state where tabela = 'fact_navegacao';

  if not p_forcar
     and v_fonte is not null
     and v_construido is not null
     and v_fonte <= v_construido then
    -- Nada a fazer: o mart já reflete toda a fonte disponível. Registra que a
    -- verificação aconteceu (ultima_execucao) sem gravar uma linha de trabalho
    -- em sync_runs — no-op não é sincronização.
    update etl.sync_state
       set ultima_execucao = now(),
           ultimas_linhas = 0,
           observacao = 'sem reconstrução: fact_pageview parado em '
             || to_char(v_fonte at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI')
             || ' BRT'
     where tabela = 'fact_navegacao';
    return 0;
  end if;

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

  insert into etl.sync_state (tabela, watermark, ultima_execucao, ultimas_linhas, observacao)
  values ('fact_navegacao', v_fonte, now(), v_n, null)
  on conflict (tabela) do update set watermark = excluded.watermark,
    ultima_execucao = excluded.ultima_execucao,
    ultimas_linhas = excluded.ultimas_linhas,
    observacao = excluded.observacao;

  insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, linhas, sucesso)
  values ('fact_navegacao', v_inicio, now(), v_n, true);

  return v_n;
end;
$function$;

comment on function etl.sync_fact_navegacao(integer, boolean) is
  'Reconstrói marts.fact_navegacao a partir de marts.fact_pageview (local, sem FDW). Pula quando o watermark da fonte não avançou; p_forcar ignora o atalho para backfill com janela maior.';

-- O bloco exception antigo (insert em sync_runs + raise) era código morto: o
-- raise aborta a subtransação que contém o próprio insert, e etl.executar_passo()
-- registra a falha na transação externa de qualquer forma — é a mesma armadilha
-- corrigida em etl.executar_sync() na §2.5 da auditoria. Removido: falha agora
-- propaga limpa para executar_passo, que é quem tem contexto para registrar.

-- Backfill da régua nova. Conferido no momento desta migration: as linhas
-- elegíveis em fact_pageview nos últimos 45 dias (335.440, sob a régua
-- e_cliente) são exatamente as presentes em fact_navegacao — o mart está casado
-- com a fonte, então declarar o watermark da fonte é verdade, não atalho.
update etl.sync_state
   set watermark = (select watermark from etl.sync_state where tabela = 'fact_pageview'),
       observacao = 'watermark passa a espelhar fact_pageview (ver migration 20260810153200)'
 where tabela = 'fact_navegacao';

-- tabelas_ok contava fact_navegacao, que é passo local: com a origem 100% fora,
-- a métrica reportava 1 em vez de 0. ultima_sync já excluía — agora as duas
-- medidas falam da mesma população (só os passos que dependem do FDW).
create or replace view marts.v_saude_pipeline as
  select
    (select max(ultima_execucao)
       from etl.sync_state
      where tabela <> 'fact_navegacao') as ultima_sync,
    (select count(*)::integer
       from etl.sync_state
      where tabela <> 'fact_navegacao'
        and ultima_execucao > now() - interval '90 minutes') as tabelas_ok,
    (select count(*)::integer
       from etl.sync_runs
      where not sucesso and iniciado_em > now() - interval '6 hours') as falhas_recentes,
    (select split_part(left(erro, 200), E'\n', 1)
       from etl.sync_runs
      where not sucesso and iniciado_em > now() - interval '6 hours'
      order by iniciado_em desc
      limit 1) as ultimo_erro;

comment on view marts.v_saude_pipeline is
  'Saúde do sync com a plataforma. Considera apenas os passos que leem a origem via FDW — fact_navegacao é derivado local e passaria mesmo com a origem inacessível.';
