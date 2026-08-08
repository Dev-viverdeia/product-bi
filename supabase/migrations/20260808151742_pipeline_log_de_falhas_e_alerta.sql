-- Pipeline: falha deixa de ser silenciosa + saúde exposta ao app.
--
-- Bug de projeto corrigido aqui: `etl.executar_sync()` capturava a exceção de
-- cada passo e tentava gravar em `etl.sync_runs` DENTRO do bloco exception. Em
-- PL/pgSQL o bloco exception roda numa subtransação que já sofreu rollback, e o
-- insert do log ia junto — o pipeline caiu por 17h sem deixar rastro nenhum.
--
-- Correção: cada passo vira uma chamada a `etl.executar_passo()`. A exceção
-- estoura lá dentro; o insert do log acontece na transação EXTERNA (válida) e
-- sobrevive.

create or replace function etl.executar_passo(p_funcao text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inicio timestamptz := now();
begin
  execute format('select %s', p_funcao);
exception when others then
  -- roda na transação externa (válida) → o registro sobrevive
  insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, sucesso, erro)
  values (p_funcao, v_inicio, now(), false, sqlerrm);
end;
$$;

comment on function etl.executar_passo(text) is
  'Executa um passo do sync isolando a falha: erro vira linha em etl.sync_runs, os passos seguintes continuam.';

create or replace function etl.executar_sync()
returns void
language plpgsql
security definer
set search_path = ''
as $$
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
  -- por último: depende de fact_pageview já atualizado (e é local, não usa FDW)
  perform etl.executar_passo('etl.sync_fact_navegacao()');
end;
$$;

-- Saúde do pipeline para o app. `fact_navegacao` fica fora do "última sync"
-- porque é derivada de dado local: ela continua atualizando mesmo com o FDW
-- fora do ar e mascararia a defasagem real.
create or replace function public.bi_saude_pipeline()
returns table (
  ultima_sync timestamptz,
  horas_desde_sync numeric,
  esta_defasado boolean,
  tabelas_ok integer,
  falhas_recentes integer,
  ultimo_erro text
)
language sql
stable
security definer
set search_path = ''
as $$
  with base as (
    select max(ultima_execucao) as ultima
    from etl.sync_state
    where tabela <> 'fact_navegacao'
  ),
  falhas as (
    select
      count(*)::integer as n,
      (array_agg(left(erro, 200) order by iniciado_em desc))[1] as msg
    from etl.sync_runs
    where not sucesso and iniciado_em > now() - interval '6 hours'
  )
  select
    b.ultima,
    round(extract(epoch from now() - b.ultima) / 3600.0, 1),
    (now() - b.ultima) > interval '90 minutes',
    (select count(*)::integer from etl.sync_state
      where ultima_execucao > now() - interval '90 minutes'),
    f.n,
    f.msg
  from base b, falhas f;
$$;

revoke execute on function public.bi_saude_pipeline() from public, anon;
grant execute on function public.bi_saude_pipeline() to authenticated;
