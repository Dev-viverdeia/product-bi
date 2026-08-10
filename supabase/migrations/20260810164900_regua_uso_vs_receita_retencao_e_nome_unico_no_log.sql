-- 1. bi_uso_vs_receita passava a régua e_cliente ao largo.
--
-- dias_ativos_medio e pct_ativos_30d saíam de fact_evento sem join com a
-- dim_usuario, e a régua do roadmap vale para toda métrica de uso, sem exceção.
-- Medido antes de mudar: 79 pagantes, 78 e_cliente, 1 não. Impacto de decisão
-- ~1,3% — o ganho é consistência, como nos 7 pontos da §2.2 da auditoria.
--
-- A régua entra na POPULAÇÃO, não só nas colunas de uso: as quatro saídas
-- (clientes, receita_media, dias_ativos_medio, pct_ativos_30d) descrevem o mesmo
-- conjunto, e dois números da mesma linha contando populações diferentes é
-- exatamente o defeito que a auditoria condena. Receita total sem régua continua
-- em bi_receita_kpis/bi_receita_mensal, que são ancoradas em fatura por projeto.
create or replace function public.bi_uso_vs_receita()
returns table(faixa text, ordem integer, clientes bigint, receita_media numeric, dias_ativos_medio numeric, pct_ativos_30d numeric)
language sql
stable
set search_path to ''
as $function$
  with receita as (
    select f.user_id, sum(f.valor_brl) as total
    from marts.fact_fatura f
    join marts.dim_usuario u on u.user_id = f.user_id and u.e_cliente
    where f.tipo = 'invoice.payment_succeeded' and f.user_id is not null
    group by f.user_id
  ),
  dias as (
    select e.user_id, count(distinct e.data_brt) as dias_ativos,
           max(e.data_brt) as ultima
    from marts.fact_evento e
    join marts.dim_usuario u on u.user_id = e.user_id and u.e_cliente
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
$function$;

-- 2. etl.sync_runs crescia sem retenção.
--
-- 2.843 linhas / 728 KB em 4 dias; durante parada de FDW são ~912 falhas por dia,
-- todas com a mesma mensagem. Log de sync tem valor diagnóstico curto — 14 dias
-- cobrem qualquer investigação real e mantêm a tabela pequena, que é o que faz
-- bi_saude_pipeline.falhas_recentes continuar barato sem precisar de índice novo.
create or replace function etl.limpar_historico_sync(p_dias integer default 14)
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_n integer;
begin
  delete from etl.sync_runs
   where iniciado_em < now() - make_interval(days => p_dias);
  get diagnostics v_n = row_count;
  return v_n;
end;
$function$;

comment on function etl.limpar_historico_sync(integer) is
  'Descarta histórico de sync mais velho que p_dias (padrão 14). Chamada no fim de etl.executar_sync().';

-- 3. sync_runs.tabela tinha duas convenções na mesma coluna.
--
-- Sucesso gravava o nome do mart (fact_evento); falha gravava a assinatura da
-- função (etl.sync_fact_evento()). Resultado: 19 nomes de um jeito e 20 do outro
-- para 20 passos, e "histórico do passo X" só respondia se quem consultasse
-- adivinhasse a convenção certa. Agora a coluna guarda sempre o mart.
--
-- A normalização é por regexp e degrada graciosamente: nome fora do padrão
-- etl.sync_<tabela>() volta inalterado em vez de virar lixo. Conferido nos 20
-- passos antes de aplicar — todos casam com uma linha de etl.sync_state.
create or replace function etl.executar_passo(p_funcao text)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_inicio timestamptz := now();
begin
  execute format('select %s', p_funcao);
exception when others then
  -- roda na transação externa (válida) → o registro sobrevive
  insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, sucesso, erro)
  values (regexp_replace(p_funcao, '^etl\.sync_(.+)\(\)$', '\1'), v_inicio, now(), false, sqlerrm);
end;
$function$;

-- Histórico existente passa para a convenção nova, senão a coluna continua
-- inconsultável para trás.
update etl.sync_runs
   set tabela = regexp_replace(tabela, '^etl\.sync_(.+)\(\)$', '\1')
 where tabela like 'etl.sync_%()';

-- A limpeza entra no ciclo isolada por executar_passo: se falhar, registra e não
-- derruba o sync. Vai por último, depois de todo trabalho do ciclo.
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
