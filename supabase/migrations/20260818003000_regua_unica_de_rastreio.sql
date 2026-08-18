-- Régua única de saúde de instrumentação
--
-- Passo 1 de 5 da Fase 2 (veracidade). Peça isolada de propósito: é a única do
-- lote que não depende de decisão de produto nenhuma e não muda número em card
-- algum. Separá-la evita que um ganho limpo fique refém das três decisões ainda
-- abertas na guarda de bi_acoes_por_modulo.
--
-- O QUE MUDA
--
-- A classificação ativo/atrasado/parado passa a viver numa função só,
-- marts.rastreio_por_tipo(). Hoje ela mora dentro de bi_saude_rastreio, e a
-- guarda que vem no passo 5 precisaria da MESMA régua — duas cópias que um dia
-- discordam é exatamente o defeito que este projeto passou dois meses
-- corrigindo em outras camadas.
--
-- O QUE NÃO MUDA
--
-- O conjunto de linhas de bi_saude_rastreio é idêntico, e a equivalência é
-- estrutural, não coincidência: marts.modulo_do_evento é IMMUTABLE e função
-- exclusiva de tipo, então agrupar por tipo e mapear o módulo depois dá os
-- mesmos grupos que agrupar pelos dois. Baseline conferido antes de aplicar:
-- 12 linhas, ordenadas por dias_parado desc / eventos_total desc, com os quatro
-- parados de sempre — community_comment (117d), connection_accepted (105d),
-- community_post_created (61d) e solution_started (57d).
--
-- Por isso não há purga de insights.achado_cache aqui: nenhum número muda, e
-- nenhum calculador do motor lê esta função (conferido nos nove corpos).
--
-- CUSTO
--
-- O ganho é de agrupamento: hoje a função agrupa por (tipo, módulo) chamando
-- marts.modulo_do_evento sobre cada linha do fato; agora ela agrupa por tipo e
-- chama a função doze vezes, sobre o resultado. Medido: ~3.520 ms -> ~147 ms.
--
-- A régua e_cliente está AUSENTE de propósito, e isso é exceção declarada no
-- comment das duas funções: esta mede instrumentação, não cliente. Filtrar por
-- cliente esconderia justamente o rastreio quebrado que só aparece no uso
-- interno, que é o que a função existe para encontrar.

create or replace function marts.rastreio_por_tipo()
returns table(
  tipo text, modulo text, ultimo_registro date,
  dias_parado integer, eventos_total bigint, status text)
language sql stable set search_path to ''
as $function$
  with hoje as materialized (select marts.data_referencia() d),
  -- Agrupa só por tipo. O módulo entra depois, sobre as doze linhas do
  -- resultado — é daí que vem a diferença de custo.
  por_tipo as materialized (
    select f.tipo, max(f.data_brt) as ultimo, count(*) as eventos
    from marts.fact_evento f
    group by 1
  )
  select t.tipo,
         marts.modulo_do_evento(t.tipo),
         t.ultimo,
         (h.d - t.ultimo)::integer,
         t.eventos,
         case when h.d - t.ultimo <= 7 then 'ativo'
              when h.d - t.ultimo <= 30 then 'atrasado'
              else 'parado' end
  from por_tipo t, hoje h;
$function$;

comment on function marts.rastreio_por_tipo() is
  'Régua única de saúde de instrumentação: última data com registro por tipo de evento, contada a partir de marts.data_referencia(). Lida por public.bi_saude_rastreio (que a publica) e, a partir do passo 5 da Fase 2, pela guarda de public.bi_acoes_por_modulo. NÃO aplica a régua e_cliente, de propósito — mede instrumentação, não cliente; filtrar por cliente esconderia justamente o rastreio quebrado que só aparece no uso interno. Quem a ler não deve repetir o filtro nem "corrigir" a ausência dele.';

-- Mesma assinatura e mesmo conjunto de linhas, então create or replace basta e
-- a tela não muda. Só a ordenação continua aqui, porque é apresentação.
create or replace function public.bi_saude_rastreio()
returns table(
  tipo text, modulo text, ultimo_registro date,
  dias_parado integer, eventos_total bigint, status text)
language sql stable set search_path to ''
as $function$
  select r.tipo, r.modulo, r.ultimo_registro, r.dias_parado, r.eventos_total, r.status
  from marts.rastreio_por_tipo() r
  order by r.dias_parado desc, r.eventos_total desc;
$function$;

comment on function public.bi_saude_rastreio() is
  'Mede saúde de instrumentação, não comportamento de cliente — por isso NÃO aplica a régua e_cliente, de propósito. Filtrar por cliente esconderia justamente o rastreio quebrado que só aparece no uso interno, que é o que esta função existe para encontrar. Não "corrigir". A classificação ativo/atrasado/parado vive em marts.rastreio_por_tipo(), que é a mesma régua que a guarda de bi_acoes_por_modulo consulta: as duas nunca podem discordar.';

-- A função de marts é lida por RPC SECURITY INVOKER: sem o execute o card volta
-- zero linha sem erro nenhum. marts.fact_evento já tem RLS ligada com a policy
-- de leitura para authenticated, então não falta política aqui.
revoke execute on function marts.rastreio_por_tipo() from public, anon;
grant execute on function marts.rastreio_por_tipo() to authenticated;
