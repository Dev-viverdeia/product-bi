-- =====================================================================
-- Orquestrador próprio do CS + canário de credencial
-- =====================================================================
-- POR QUE UM ORQUESTRADOR SEPARADO DE etl.executar_sync():
-- os três grupos do Pulse entregaram, cada um, um `create or replace
-- function etl.executar_sync()` com a sua própria lista de passos. Aplicados
-- em sequência, o último a rodar apaga os passos dos outros dois — falha
-- silenciosa, porque a função continua existindo e o cron continua verde.
-- Com etl.executar_sync_cs() o ciclo da plataforma fica intocado e o CS ganha
-- um ponto único de registro. NENHUM grupo deve recriar etl.executar_sync().
--
-- SERVIDOR: o CS lê o schema `pulse`, servido pelo foreign server `pulse_srv`
-- (host aws-1-us-east-2.pooler.supabase.com). NÃO é o `plataforma_srv`, que
-- serve o schema `plataforma`. São dois servidores, duas credenciais e duas
-- cadências independentes — depurar um pelo outro confirma a hipótese errada.

create or replace function etl.checar_saude_cs()
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_ultima_leitura timestamptz;
  v_linhas         bigint;
begin
  -- CANÁRIO = cs_envio (fact_cs_envio, 49.474 linhas — a maior do contrato) e
  -- também a mais viva: na medição de 12/08/2026 o último evento tinha 1min51s.
  --
  -- O QUE É MEDIDO É A LEITURA, NÃO O EVENTO. Medido em pulse.disparos_destinatarios:
  -- a origem já ficou 6 dias e 20 horas sem produzir uma linha, e passou de 48h de
  -- silêncio 4 vezes na série. Alarme ancorado em "não chega linha nova há 48h"
  -- teria gritado 4 vezes por sazonalidade de negócio — e alarme que grita errado
  -- é alarme que o time aprende a ignorar, que é como a expiração de credencial
  -- passa despercebida.
  --
  -- etl.sync_state.ultima_execucao só é escrito no caminho de sucesso (a função
  -- levanta antes de chegar lá quando o FDW recusa). Então "ultima_execucao velha"
  -- significa exatamente: faz 48h que o BI não consegue LER o Pulse. É esse o modo
  -- de falha da credencial do role bi_pulse_readonly do Pulse (validade
  -- 11/02/2027), usada pelo user mapping do pulse_srv, e é idêntico ao de bloqueio
  -- de rede — os dois deixam de escrever sync_state, os dois são pegos aqui.
  select s.ultima_execucao into v_ultima_leitura
  from etl.sync_state s where s.tabela = 'cs_envio';

  select count(*) into v_linhas from marts.fact_cs_envio;

  if v_ultima_leitura is null then
    raise exception
      'SAUDE CS: cs_envio nunca completou uma leitura com sucesso. Rode etl.sync_cs_envio() à mão e verifique o user mapping do pulse_srv.'
      using errcode = 'data_exception';
  end if;

  if v_ultima_leitura < now() - interval '48 hours' then
    raise exception
      'SAUDE CS: o BI não lê pulse.disparos_destinatarios há % (última leitura com sucesso em %). A origem NÃO é a suspeita: o alarme mede leitura, não evento. Suspeitar da credencial do pulse_srv (role bi_pulse_readonly do Pulse, expira 11/02/2027) ou bloqueio de rede. Último erro registrado: %',
      justify_interval(now() - v_ultima_leitura),
      to_char(v_ultima_leitura at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI'),
      coalesce((select r.erro from etl.sync_runs r
                 where r.tabela = 'cs_envio' and not r.sucesso
                 order by r.iniciado_em desc limit 1), '(nenhum)')
      using errcode = 'data_exception';
  end if;

  -- Mart vazio com leitura recente é o outro jeito de a coisa quebrar em silêncio:
  -- a foreign table responde, devolve zero linha, e o sync grava sucesso.
  if v_linhas = 0 then
    raise exception
      'SAUDE CS: marts.fact_cs_envio está vazia apesar de a leitura ter completado em %. Conferir se a view do contrato bi_pulse ainda entrega linha.',
      to_char(v_ultima_leitura at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI')
      using errcode = 'data_exception';
  end if;
end;
$function$;

comment on function etl.checar_saude_cs() is
  'Canário do pipeline de CS (pulse_srv). Mede a última LEITURA bem-sucedida de cs_envio, não a chegada de evento novo — a origem tem silêncios legítimos de até 6,8 dias (4 ocorrências acima de 48h na série medida). Levanta exceção; só chamar de dentro de bloco que não escreve dado, ou de um cron próprio.';


create or replace function etl.executar_sync_cs()
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_inicio_saude timestamptz;
begin
  -- EM SÉRIE, sempre. O role remoto do Pulse tem teto de 5 conexões e o
  -- postgres_fdw mantém 1 por (servidor, usuário) por sessão: os 8 passos abaixo
  -- custam 1 conexão no total. Qualquer paralelismo aqui troca isso por 8.
  --
  -- etl.executar_passo captura a exceção e registra em etl.sync_runs SEM
  -- relevantar: é por isso que uma tabela quebrada não impede as outras 7 de
  -- carregar. O passo que falhou some do ciclo, não derruba o ciclo.
  perform etl.executar_passo('etl.sync_cs_atendimento()');
  perform etl.executar_passo('etl.sync_cs_disparo()');
  perform etl.executar_passo('etl.sync_cs_envio()');
  perform etl.executar_passo('etl.sync_cs_avulso()');
  perform etl.executar_passo('etl.sync_cs_card()');
  perform etl.executar_passo('etl.sync_cs_movimento()');
  perform etl.executar_passo('etl.sync_cs_cancelamento()');
  perform etl.executar_passo('etl.sync_cs_empresa()');

  -- ARMADILHA QUE ESTE BLOCO EVITA: pg_cron roda `select etl.executar_sync_cs()`
  -- como UMA transação. Um `raise` solto aqui no fim descartaria tudo que os 8
  -- passos acabaram de gravar — o alarme destruiria a carga que veio conferir.
  -- Por isso o veredito é PERSISTIDO como linha de falha em sync_runs (o handler
  -- roda na transação externa, que segue válida — mesmo truque de executar_passo)
  -- e a versão que FALHA DE VERDADE, com transação própria e sem nada a perder,
  -- é o cron bi_saude_cs, que chama etl.checar_saude_cs() direto.
  v_inicio_saude := clock_timestamp();
  begin
    perform etl.checar_saude_cs();
  exception when others then
    insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, sucesso, erro)
    values ('saude_cs', v_inicio_saude, now(), false, sqlerrm);
  end;
end;
$function$;

comment on function etl.executar_sync_cs() is
  'Ciclo de carga do CS (schema pulse, servidor pulse_srv). 8 passos em série, 1 conexão remota; passo que falha é registrado em etl.sync_runs e o ciclo continua. Separado de etl.executar_sync() de propósito: os grupos do Pulse não podem disputar a mesma função.';

revoke execute on function etl.checar_saude_cs() from public;
revoke execute on function etl.executar_sync_cs() from public;


-- =====================================================================
-- Agendamento
-- =====================================================================
-- bi_sync_plataforma roda em :00 e :30. bi_sync_cs entra em :15 e :45 —
-- escalonado para não concorrer por CPU local com bi_sync_plataforma. Não é
-- questão de conexão remota: plataforma_srv e pulse_srv têm pools separados e
-- nunca disputaram o mesmo teto de 5.
select cron.schedule('bi_sync_cs', '15,45 * * * *', $cron$select etl.executar_sync_cs()$cron$);

-- Canário em transação própria: aqui o raise PODE acontecer, porque a função não
-- escreve dado nenhum. A falha aparece vermelha em cron.job_run_details, que é o
-- único lugar onde silêncio de credencial vira ruído visível. 09:20 BRT (12:20 UTC)
-- é depois do ciclo das 09:15 e dentro do horário em que alguém lê o alerta.
select cron.schedule('bi_saude_cs', '20 12 * * *', $cron$select etl.checar_saude_cs()$cron$);
