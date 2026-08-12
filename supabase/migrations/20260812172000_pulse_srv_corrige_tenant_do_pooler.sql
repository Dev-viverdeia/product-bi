-- O servidor nasceu apontando para aws-0-us-east-2 e o projeto do Pulse esta no
-- tenant aws-1. O erro era `FATAL: (ENOTFOUND) tenant/user ... not found`, que
-- e indistinguivel de credencial errada ou de IP bloqueado -- por isso fica
-- registrado aqui: se alguem reprovisionar o servidor, o host correto e este.
alter server pulse_srv options (set host 'aws-1-us-east-2.pooler.supabase.com');

-- Somente leitura declarado no proprio servidor: qualquer escrita contra uma
-- foreign table falha na hora, em vez de tentar alterar o banco de outro time.
alter server pulse_srv options (add updatable 'false', add truncatable 'false');

-- Conexao validada em 12/08 lendo bi_pulse.disparos_campanhas (1.780 linhas,
-- frescas do dia). O import das outras 7 views espera dois grants do lado do
-- Pulse -- ver comentario do schema.
comment on schema pulse is
  'Espelho somente-leitura do contrato bi_pulse (projeto cs_pulse_platform). Landing zone: a aplicacao nunca le daqui -- le marts.*, materializado por etl.sync_cs_*. Import bloqueado em 12/08 para 7 das 8 views: o role bi_pulse_readonly nao tem execute em bi_pulse.hash_pii (usada por 7 views) nem em public.wa_phone_key (usada por retencao). Pedido aberto com o time do Pulse.';
