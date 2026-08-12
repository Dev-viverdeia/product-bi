-- marts.v_saude_pipeline media os dois pipelines num numero so: max(ultima_execucao)
-- sobre TODA a etl.sync_state. Enquanto so existia a plataforma isso era inofensivo.
--
-- Com o CS entrando, deixa de ser. Os dois pipelines tem servidor, credencial e
-- cadencia independentes -- pulse_srv responde, plataforma_srv esta fora do ar ha
-- 97,8 horas com 240 falhas. Na primeira carga de CS o max() viraria "agora",
-- esta_defasado viraria false e o alerta vermelho SUMIRIA da barra do app, com a
-- plataforma ainda morta.
--
-- Um indicador sobre duas fontes independentes reporta, por construcao, a saude
-- da mais saudavel. Aqui ele passa a falar so da plataforma; o CS ganha o proprio,
-- abaixo.
create or replace view marts.v_saude_pipeline as
select
  (select max(s.ultima_execucao) from etl.sync_state s
    where s.tabela <> 'fact_navegacao' and s.tabela not like 'cs\_%') as ultima_sync,
  (select count(*)::integer from etl.sync_state s
    where s.tabela <> 'fact_navegacao' and s.tabela not like 'cs\_%'
      and s.ultima_execucao > now() - interval '90 minutes') as tabelas_ok,
  (select count(*)::integer from etl.sync_runs r
    where not r.sucesso and r.iniciado_em > now() - interval '6 hours'
      and r.tabela not like 'cs\_%') as falhas_recentes,
  (select split_part(left(r.erro, 200), E'\n', 1) from etl.sync_runs r
    where not r.sucesso and r.iniciado_em > now() - interval '6 hours'
      and r.tabela not like 'cs\_%'
    order by r.iniciado_em desc limit 1) as ultimo_erro;

comment on view marts.v_saude_pipeline is
  'Saude do pipeline da PLATAFORMA (plataforma_srv). Exclui as chaves cs_* de proposito: o CS le outro servidor, com outra credencial e outra cadencia, e somar os dois faz o indicador reportar a saude do mais saudavel.';

-- O CS ganha o proprio indicador, na mesma forma, para a tela poder declarar cada
-- fonte separadamente em vez de herdar um numero que nao e dela.
create or replace view marts.v_saude_pipeline_cs as
select
  (select max(s.ultima_execucao) from etl.sync_state s
    where s.tabela like 'cs\_%') as ultima_sync,
  (select count(*)::integer from etl.sync_state s
    where s.tabela like 'cs\_%'
      and s.ultima_execucao > now() - interval '90 minutes') as tabelas_ok,
  (select count(*)::integer from etl.sync_runs r
    where not r.sucesso and r.iniciado_em > now() - interval '6 hours'
      and r.tabela like 'cs\_%') as falhas_recentes,
  (select split_part(left(r.erro, 200), E'\n', 1) from etl.sync_runs r
    where not r.sucesso and r.iniciado_em > now() - interval '6 hours'
      and r.tabela like 'cs\_%'
    order by r.iniciado_em desc limit 1) as ultimo_erro;

comment on view marts.v_saude_pipeline_cs is
  'Saude do pipeline de CS (pulse_srv). Espelha marts.v_saude_pipeline em forma, para a tela tratar as duas fontes com o mesmo componente.';
