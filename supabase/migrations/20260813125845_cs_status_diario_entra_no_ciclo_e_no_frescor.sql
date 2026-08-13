-- O nono passo entra no fim da serie: e o unico que nao depende de nenhum outro
-- e o mais barato dos nove, entao falhar por ultimo custa menos.
--
-- Junto, corrige o clock do canario: `now()` e o inicio da TRANSACAO, entao a
-- linha de falha saia com finalizado_em ANTERIOR a iniciado_em -- justamente a
-- linha que alguem le quando o alarme dispara. clock_timestamp() le o relogio.
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
  -- postgres_fdw mantém 1 por (servidor, usuário) por sessão: os 9 passos abaixo
  -- custam 1 conexão no total. Qualquer paralelismo aqui troca isso por 9.
  --
  -- etl.executar_passo captura a exceção e registra em etl.sync_runs SEM
  -- relevantar: é por isso que uma tabela quebrada não impede as outras de
  -- carregar. O passo que falhou some do ciclo, não derruba o ciclo.
  perform etl.executar_passo('etl.sync_cs_atendimento()');
  perform etl.executar_passo('etl.sync_cs_disparo()');
  perform etl.executar_passo('etl.sync_cs_envio()');
  perform etl.executar_passo('etl.sync_cs_avulso()');
  perform etl.executar_passo('etl.sync_cs_card()');
  perform etl.executar_passo('etl.sync_cs_movimento()');
  perform etl.executar_passo('etl.sync_cs_cancelamento()');
  perform etl.executar_passo('etl.sync_cs_empresa()');
  perform etl.executar_passo('etl.sync_cs_status_diario()');

  -- ARMADILHA QUE ESTE BLOCO EVITA: pg_cron roda `select etl.executar_sync_cs()`
  -- como UMA transação. Um `raise` solto aqui no fim descartaria tudo que os
  -- passos acabaram de gravar — o alarme destruiria a carga que veio conferir.
  v_inicio_saude := clock_timestamp();
  begin
    perform etl.checar_saude_cs();
  exception when others then
    insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, sucesso, erro)
    values ('saude_cs', v_inicio_saude, clock_timestamp(), false, sqlerrm);
  end;
end;
$function$;
