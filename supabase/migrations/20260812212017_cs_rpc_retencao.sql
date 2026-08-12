-- =====================================================================
-- bi_cs_retencao — de status_retencao para desfecho
-- =====================================================================
-- Ela NÃO quebra na hora da migration: o corpo é string (não é BEGIN ATOMIC),
-- então o Postgres não registra dependência e o DROP das tabelas passa limpo.
-- Quebra DEPOIS, no primeiro clique do usuário, com 42703 column does not
-- exist. É por isso que precisa ser corrigida na MESMA entrega do DDL.
--
-- Antes: (status, empresas, em_tentativa_reversao) sobre CANCELADO/REVERTIDO/
-- LEVANTOU_A_MAO, no grão empresa.
-- Agora: grão cliente deduplicado, vocabulário RETIDO/PERDIDO/EM_ABERTO, e a
-- divergência com a base da plataforma exposta em coluna própria em vez de
-- diluída na contagem.
--
-- DROP antes de CREATE porque a lista de colunas de saída muda — create or
-- replace não altera assinatura de retorno.
--
-- bi_cs_kpis NÃO está aqui de propósito: as três entregas do Pulse mexem no
-- mesmo corpo e a última venceria. A versão merged tem migration própria
-- (cs_rpc_kpis_merge) e é a única que toca a função.
drop function if exists public.bi_cs_retencao();

create function public.bi_cs_retencao()
returns table(desfecho text, clientes bigint, com_base_ativa bigint, conflita_base bigint)
language sql
stable
set search_path to ''
as $function$
  select e.desfecho,
         count(*),
         count(*) filter (where e.base_ativa),
         count(*) filter (where e.desfecho_conflita_base)
  from marts.dim_cs_empresa e
  group by 1 order by 2 desc;
$function$;

comment on function public.bi_cs_retencao() is
  'Retenção por desfecho no grão cliente deduplicado. conflita_base = PERDIDO pelo CS mas ainda ativo na plataforma (57 de 100 em 12/08/2026); a tela precisa mostrar essa coluna, não escondê-la.';

revoke execute on function public.bi_cs_retencao() from public;
revoke execute on function public.bi_cs_retencao() from anon;
grant  execute on function public.bi_cs_retencao() to authenticated;
