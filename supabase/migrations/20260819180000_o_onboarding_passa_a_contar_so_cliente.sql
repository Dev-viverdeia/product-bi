-- O card que dizia "Clientes" contava 34% de não-clientes
--
-- `bi_onboarding_abandono` era a ÚNICA função `bi_*` que lê fato de grão-pessoa
-- sem citar `e_cliente` uma vez sequer. Devolvia 1.600 linhas; 545 delas
-- (34,1%) não são cliente nenhum — e a coluna se chama `clientes`, com o eixo
-- do gráfico rotulado "Clientes".
--
-- A distorção não é uniforme: concentra-se na PRIMEIRA etapa, 435 de 1.184
-- (36,7%). É exatamente a etapa que a regra `ent_onboarding_nao_comeca` usa
-- para concluir "não é abandono no meio, é não começar" — a fatia parada ali
-- vai de 74,0% para 71,1%. A conclusão sobrevive; o número não sobrevivia.
--
-- COMO ELA ESCAPOU ATÉ AQUI
--
-- A auditoria de 13/08 varreu 59 RPCs de grão-cliente e achou 5 sem a régua.
-- Esta não estava entre elas. E a varredura heurística que fiz hoje de manhã
-- ACUSOU esta função — junto com 17 outras — e eu descartei o lote inteiro
-- depois de conferir três, porque o padrão de CTE compartilhado (`clientes`
-- filtrado uma vez, joined em várias leituras) gera falso positivo por
-- construção. Descartei o lote em vez de terminar a leitura.
--
-- As 17 foram lidas uma a uma agora, e estão corretas: todas filtram numa CTE
-- base e correlacionam depois, ou herdam a régua por cadeia de join
-- (`bi_builder_steps` chega em `dim_usuario` via `fact_builder_solucao`;
-- `bi_jornada_cursos` restringe `fact_certificado` pelo join com `inicio`).
--
-- ⚠️ A LIÇÃO É SOBRE O MÉTODO, NÃO SOBRE ESTA FUNÇÃO: contagem de `e_cliente`
-- por função é heurística com falso positivo garantido, e falso positivo em
-- lote ensina a descartar o lote. A verificação honesta é ler cada LEITURA DE
-- FATO e responder se ela está restrita a cliente — direta ou por cadeia.

create or replace function public.bi_onboarding_abandono()
returns table(step_atual integer, clientes bigint)
language sql
stable
set search_path to ''
as $function$
  select o.step_atual, count(*)
  from marts.fact_onboarding o
  -- A régua e_cliente faltava, e a coluna se chama `clientes`: eram 1.600
  -- linhas das quais 545 (34,1%) não são cliente nenhum. A distorção se
  -- concentra na primeira etapa — 435 dos 1.184 —, que é justamente a que a
  -- regra `ent_onboarding_nao_comeca` usa para concluir "não é abandono no
  -- meio, é não começar".
  join marts.dim_usuario u on u.user_id = o.user_id and u.e_cliente
  where not o.concluido and o.step_atual is not null
  group by 1 order by 1;
$function$;

comment on function public.bi_onboarding_abandono() is
  'Quem nao concluiu o onboarding, por etapa atual. A regua e_cliente entrou em 19/08/2026: sem ela a funcao devolvia 1.600 linhas contra 1.055 reais - 545 nao-clientes, 34,1% -, com a distorcao concentrada na etapa 0 (435 de 1.184). Era a unica funcao bi_* que lia fato de grao-pessoa sem citar a regua nenhuma vez; as outras 17 que uma varredura heuristica acusou foram lidas uma a uma e estao corretas, filtrando numa CTE base e correlacionando depois.';

-- A regra ent_onboarding_nao_comeca lê esta função: a fatia parada na primeira
-- etapa vai de 74,0% para 71,1%. O cache guarda o achado serializado.
delete from insights.achado_cache where chave like 'entrada|%';
