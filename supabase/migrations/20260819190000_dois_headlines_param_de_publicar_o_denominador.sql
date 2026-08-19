-- Dois headlines paravam de publicar o próprio denominador
--
-- 1. RECEITA PUBLICAVA "100,0%", QUE É A DEFINIÇÃO DO DENOMINADOR
--
-- `bi_receita_saude_cobranca` compara o valor de cada desfecho com o valor
-- APROVADO. A linha "Pagamento aprovado" é esse denominador, e a função a
-- dividia por si mesma: 1,0000. O card lidera pelo MAIOR pct, então o headline
-- publicava "100,0% do valor pago em Pagamento aprovado" — uma tautologia em
-- corpo 30px, no card que existe para mostrar dinheiro que NÃO entrou.
--
-- A linha de referência passa a ter `pct_do_pago` nulo: ela não tem fatia a
-- publicar. O `filter(pct_do_pago != null)` que a página já fazia passa a ter
-- dente, a tabela já imprimia travessão para nulo, e o headline vira 79,3% em
-- "Pagamento falhou", que é a pergunta do card.
--
-- ⚠️ O motor lê `pct_do_pago` só das linhas "Pagamento falhou" e "Reembolsado"
-- (conferido em `insights.calcular_achados_receita`), então nenhuma regra muda.
-- A supressão também é melhor que excluir por NOME na página: sobrevive a
-- alguém renomear o rótulo do evento, que é a fragilidade que o próprio
-- comentário do motor já denuncia sobre estas três regras.
--
-- 2. SOLUÇÕES SOMAVA O DENOMINADOR NO FRONT
--
-- O único bloco `tone="brand"` da tela publicava "37,7% em Vendas", calculado
-- com `cats.reduce((soma, c) => soma + c.iniciadas, 0)` na página. São 49.777
-- inícios — um total que NENHUMA barra do gráfico desenha. É o mesmo defeito
-- que Organizações consertou hoje de manhã, e o mesmo que a régua "percentual
-- não é calculado no front" existe para impedir nas duas telas em que ela já
-- vale.
--
-- `pct_das_iniciadas` e `iniciadas_total` passam a vir do banco, com a
-- supressão por amostra valendo para eles como vale para o resto. A descrição
-- do card passa a dizer que o total É a soma das barras.
--
-- `create or replace` na primeira porque o tipo de retorno não muda; `drop` na
-- segunda porque muda.

create or replace function public.bi_receita_saude_cobranca()
returns table(evento text, faturas bigint, valor_brl numeric, pct_do_pago numeric)
language sql
stable
set search_path to ''
as $function$
  with pago as (
    select coalesce(sum(valor_brl), 0) v from marts.fact_fatura
    where tipo = 'invoice.payment_succeeded'
  )
  select case f.tipo
           when 'invoice.payment_succeeded' then 'Pagamento aprovado'
           when 'invoice.payment_failed' then 'Pagamento falhou'
           when 'invoice.refunded' then 'Reembolsado'
           when 'invoice.expired' then 'Fatura expirou'
           else f.tipo
         end,
         count(*), round(sum(f.valor_brl), 2),
         -- A linha de referência não tem fatia a publicar: ela É o denominador,
         -- e dividi-la por si mesma dava 1,0000. O headline do card lidera pelo
         -- maior pct, então publicava "100,0% do valor pago em Pagamento
         -- aprovado" — uma tautologia em corpo 30px. Nulo aqui é a régua se
         -- declarando, e a tabela já imprime travessão para nulo.
         case when f.tipo <> 'invoice.payment_succeeded'
              then round(sum(f.valor_brl) / nullif((select v from pago), 0), 4) end
  from marts.fact_fatura f
  where f.tipo in ('invoice.payment_succeeded','invoice.payment_failed',
                   'invoice.refunded','invoice.expired')
  group by f.tipo
  order by 3 desc;
$function$;

comment on function public.bi_receita_saude_cobranca() is
  'Faturas por desfecho de cobranca, com o valor comparado ao aprovado. pct_do_pago e NULO na linha Pagamento aprovado de proposito: ela e o denominador, e dividi-la por si mesma dava 1,0000 - o headline do card lidera pelo maior pct e publicava 100,0% do valor pago em Pagamento aprovado, tautologia em corpo 30px. O motor le pct_do_pago so das linhas Pagamento falhou e Reembolsado, entao a supressao nao muda achado nenhum.';

drop function if exists public.bi_solucoes_por_categoria();

create function public.bi_solucoes_por_categoria()
returns table(
  categoria text,
  solucoes bigint,
  iniciadas bigint,
  concluidas bigint,
  taxa_conclusao numeric,
  pct_das_iniciadas numeric,
  iniciadas_total bigint
)
language sql
stable
set search_path to ''
as $function$
  with base as (
    select coalesce(s.categoria, '(sem categoria)') as categoria,
           count(distinct s.id) as solucoes,
           count(p.id) as iniciadas,
           count(p.id) filter (where p.concluido) as concluidas
    from marts.dim_solucao s
    left join marts.fact_progresso_solucao p on p.solution_id = s.id
    left join marts.dim_usuario u on u.user_id = p.user_id and u.e_cliente
    where s.publicada and (p.id is null or u.user_id is not null)
    group by 1
  ),
  tot as (select coalesce(sum(iniciadas), 0) as n from base)
  select b.categoria, b.solucoes, b.iniciadas, b.concluidas,
         round(b.concluidas::numeric / nullif(b.iniciadas, 0), 4),
         -- A fatia sai do banco, não de um `reduce` na página. O bloco de
         -- destaque publicava 37,7% somado no front sobre 49.777 — um
         -- denominador que nenhuma barra do gráfico mostra.
         case when t.n >= 30 then round(b.iniciadas::numeric / nullif(t.n, 0), 4) end,
         t.n
  from base b cross join tot t
  order by b.iniciadas desc;
$function$;

grant execute on function public.bi_solucoes_por_categoria() to authenticated, service_role;

comment on function public.bi_solucoes_por_categoria() is
  'Solucoes iniciadas e concluidas por categoria, historico completo, so cliente. pct_das_iniciadas e iniciadas_total entraram em 19/08/2026 porque o bloco de destaque da tela somava as categorias no front para montar o denominador: percentual derivado de contagem no cliente escapa da supressao por amostra e publica uma fatia sobre um total que nenhuma barra desenha.';

delete from insights.achado_cache where chave like 'solucoes|%' or chave like 'receita|%';
