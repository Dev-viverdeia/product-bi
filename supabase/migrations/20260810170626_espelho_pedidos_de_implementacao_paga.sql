-- Pendência #3 da auditoria: "pedidos de implementação paga" (item Qualidade da
-- Entrega 5) ficou sem cobertura porque plataforma.implementation_requests
-- nunca foi espelhada. A foreign table já existe — falta o mart e o passo.
--
-- ⚠️ ESTE PASSO NÃO PÔDE SER EXECUTADO: o FDW está recusado na camada de rede
-- desde 08/08. O DDL abaixo é escrito a partir do catálogo local (que descreve
-- as colunas remotas sem precisar de conexão) e a primeira execução real
-- acontece no ciclo seguinte à liberação do allow_list. Conferir nessa hora:
--   select * from etl.sync_runs where tabela = 'fact_pedido_implementacao'
--
-- Sem RPC e sem coluna na tela de propósito: número que ainda não existe não
-- entra em BI. Contagem zero com legenda plausível é exatamente o defeito da
-- §2.1 da auditoria (solution_id 100% nulo virando "0" com cara de dado real).
create table if not exists marts.fact_pedido_implementacao (
  id uuid primary key,
  user_id uuid,
  solution_id uuid,
  status text,
  criado_em timestamptz,
  processado_em timestamptz,
  sincronizado_em timestamptz not null default now()
);

-- Minimização deliberada: a origem traz user_name, user_email e user_phone, e
-- nada disso entra. A pergunta da Entrega 5 é "quantos pedidos, de quem (por
-- user_id) e em que solução" — PII de contato não responde nada disso e só
-- amplia a superfície. pipedrive_deal_id/discord_message_id e notes ficam de
-- fora pelo mesmo motivo: são operacionais, não analíticos.
comment on table marts.fact_pedido_implementacao is
  'Pedidos de implementação paga (plataforma.implementation_requests). Sem PII de contato por decisão de minimização — só user_id.';

create index if not exists fact_pedido_implementacao_solucao_idx
  on marts.fact_pedido_implementacao (solution_id);

alter table marts.fact_pedido_implementacao enable row level security;

create policy leitura_bi on marts.fact_pedido_implementacao
  for select to authenticated using (true);

grant select on marts.fact_pedido_implementacao to authenticated;

create or replace function etl.sync_fact_pedido_implementacao(p_max_dias integer default 120)
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_inicio timestamptz := now();
  v_wm timestamptz;
  v_ate timestamptz;
  v_n integer;
begin
  select watermark into v_wm from etl.sync_state where tabela = 'fact_pedido_implementacao';
  if v_wm is null then v_wm := timestamptz '2021-01-01 00:00:00-03'; end if;
  v_ate := least(v_wm + make_interval(days => p_max_dias), now() - interval '1 minute');

  if v_ate <= v_wm then
    insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, linhas, sucesso)
    values ('fact_pedido_implementacao', v_inicio, now(), 0, true);
    return 0;
  end if;

  insert into marts.fact_pedido_implementacao
    (id, user_id, solution_id, status, criado_em, processado_em, sincronizado_em)
  select r.id, r.user_id, r.solution_id, r.status, r.created_at, r.processed_at, now()
  from plataforma.implementation_requests r
  where coalesce(r.updated_at, r.created_at) > v_wm
    and coalesce(r.updated_at, r.created_at) <= v_ate
  on conflict (id) do update set
    status = excluded.status,
    processado_em = excluded.processado_em,
    sincronizado_em = excluded.sincronizado_em;
  get diagnostics v_n = row_count;

  insert into etl.sync_state (tabela, watermark, ultima_execucao, ultimas_linhas)
  values ('fact_pedido_implementacao', v_ate, now(), v_n)
  on conflict (tabela) do update set watermark = excluded.watermark,
    ultima_execucao = excluded.ultima_execucao, ultimas_linhas = excluded.ultimas_linhas;

  insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, linhas, sucesso)
  values ('fact_pedido_implementacao', v_inicio, now(), v_n, true);

  return v_n;
end;
$function$;

-- Sem bloco exception: o insert dele seria revertido pelo raise e etl.executar_passo()
-- registra a falha na transação externa de qualquer forma (§2.5 da auditoria).
comment on function etl.sync_fact_pedido_implementacao(integer) is
  'Espelha plataforma.implementation_requests em marts.fact_pedido_implementacao, incremental por watermark.';

create or replace function etl.executar_sync()
returns void
language plpgsql
security definer
set search_path to ''
as $function$
begin
  perform etl.executar_passo('etl.sync_dim_usuario()');
  perform etl.executar_passo('etl.sync_fact_evento()');
  perform etl.executar_passo('etl.sync_fact_pageview()');
  perform etl.executar_passo('etl.sync_master_snapshot()');
  perform etl.executar_passo('etl.sync_fact_progresso_solucao()');
  perform etl.executar_passo('etl.sync_fact_convite()');
  perform etl.executar_passo('etl.sync_fact_convite_envio()');
  perform etl.executar_passo('etl.sync_fact_onboarding()');
  perform etl.executar_passo('etl.sync_fact_erros()');
  perform etl.executar_passo('etl.sync_dim_learning()');
  perform etl.executar_passo('etl.sync_fact_progresso_aula()');
  perform etl.executar_passo('etl.sync_fact_certificado()');
  perform etl.executar_passo('etl.sync_fact_nps_aula()');
  perform etl.executar_passo('etl.sync_dim_solucao()');
  perform etl.executar_passo('etl.sync_fact_solucoes_apoio()');
  perform etl.executar_passo('etl.sync_fact_pedido_implementacao()');
  perform etl.executar_passo('etl.sync_fact_consultor()');
  perform etl.executar_passo('etl.sync_fact_builder()');
  perform etl.executar_passo('etl.sync_organizacoes()');
  perform etl.executar_passo('etl.sync_fact_fatura()');
  -- por último entre os dados: depende de fact_pageview já atualizado (e é local)
  perform etl.executar_passo('etl.sync_fact_navegacao()');
  -- manutenção do próprio log, depois de todo o trabalho do ciclo
  perform etl.executar_passo('etl.limpar_historico_sync()');
end;
$function$;
