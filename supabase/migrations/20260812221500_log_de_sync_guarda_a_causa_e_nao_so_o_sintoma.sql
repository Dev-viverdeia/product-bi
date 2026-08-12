-- etl.executar_passo gravava so `sqlerrm`. Para falha de FDW isso e
-- `could not connect to server "plataforma_srv"` -- o sintoma, nunca a causa.
--
-- Custou caro: o pipeline esta parado desde 08/08 com 3.964 falhas registradas,
-- e para descobrir o motivo foi preciso provocar uma conexao ao vivo. A causa
-- estava no DETAIL do erro o tempo todo:
--   FATAL: (EADDRNOTALLOWED) address not in tenant allow_list: {54,232,250,105}
--
-- As tres paradas deste pipeline tiveram o MESMO sintoma e causas diferentes
-- (allow list sem o IP; allow list so com o IP antigo; e agora o IP removido de
-- novo). Sintoma igual com causa diferente e exatamente o caso em que guardar so
-- o sintoma nao serve para nada.
--
-- PG_EXCEPTION_DETAIL e PG_EXCEPTION_HINT sao os campos que carregam o "por que".
create or replace function etl.executar_passo(p_funcao text)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_inicio timestamptz := now();
  v_detalhe text;
  v_dica text;
begin
  execute format('select %s', p_funcao);
exception when others then
  get stacked diagnostics
    v_detalhe = pg_exception_detail,
    v_dica    = pg_exception_hint;
  -- roda na transação externa (válida) → o registro sobrevive
  insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, sucesso, erro)
  values (
    regexp_replace(p_funcao, '^etl\.sync_(.+)\(\)$', '\1'),
    v_inicio, now(), false,
    -- Uma linha por campo, e nao concatenado: quem le o log no psql ou na tela
    -- ve a causa sem precisar rolar. O split_part(erro, E'\n', 1) que a
    -- v_saude_pipeline usa continua devolvendo so a primeira linha.
    sqlerrm
      || coalesce(E'\nDETALHE: ' || v_detalhe, '')
      || coalesce(E'\nDICA: '    || v_dica, '')
  );
end;
$function$;

comment on function etl.executar_passo(text) is
  'Executa um passo do sync e registra falha em etl.sync_runs sem abortar os passos seguintes. Guarda sqlerrm MAIS o DETAIL e o HINT: para falha de FDW o sqlerrm sozinho e sempre "could not connect", que nao distingue IP bloqueado de credencial vencida nem de tenant errado do pooler.';
