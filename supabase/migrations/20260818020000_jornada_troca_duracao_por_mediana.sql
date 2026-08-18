-- Jornada: o KPI de duração sai, a mediana de telas entra, e duas RPCs órfãs caem
--
-- Passo 3 de 5 da Fase 2.
--
-- O KPI QUE MEDIA A FÓRMULA, NÃO O CLIENTE
--
-- "Duração mediana (min)" publicava 0,5 min. A sessão é derivada por gap de 30
-- min sobre pageview, e a duração dela é max(criado_em) − min(criado_em):
-- sessão de UMA tela tem chegada e saída no mesmo registro, então vale zero por
-- construção.
--
-- Medido em 18/08, janela de 30 dias: 38.934 sessões, 12.311 com uma tela só
-- (31,62%) e 12.311 com duração exatamente zero. Não são dois conjuntos
-- parecidos — conferido, é o MESMO conjunto, linha a linha. Um terço da amostra
-- é zero por definição, e é isso que puxa a mediana para 0,5.
--
-- Aposentar em vez de declarar: um número enviesado com ressalva ao lado
-- continua disponível para decisão, e este não tem leitura honesta possível
-- enquanto a plataforma não instrumentar tempo de verdade (não existe
-- heartbeat, e learning_progress.last_position_seconds é zero nas 151.164
-- linhas — está no reporte de rastreamento).
--
-- No lugar entra a MEDIANA de telas por sessão (3,0), ao lado da média que já
-- existia (6,5). A distância entre as duas é a inflação por sessão-robô que o
-- card das sessões-monstro já denuncia por escrito — o par de tiles passa a
-- mostrar de graça o que hoje só o texto conta. Os dois rótulos são distintos
-- ("média" e "mediana") de propósito: dois tiles com o mesmo nome e números
-- diferentes leem como defeito, não como decisão.
--
-- A função ancorava em now() e passa a ancorar em marts.data_referencia(), que
-- é a régua da casa para RPC nova ou reescrita. Medido antes de adotar: Index
-- Scan em fact_nav_data_idx, 245 ms — o planner usa o índice com a função
-- imutável, então a troca sai de graça aqui. (Não vale para toda RPC de
-- Jornada: em bi_raio_x_telas a mesma troca custa 487 ms -> 682 ms com external
-- merge, e por isso ela fica para o lote próprio, medida caso a caso.)
--
-- O motor não quebra: insights.calcular_achados_jornada lê bi_jornada_kpis e
-- usa telas_por_sessao, que fica; minutos_medianos não é lido por nenhuma regra
-- (conferido no corpo da função). A purga de cache entra mesmo assim, porque a
-- regra da casa é purgar quando a migration mexe em RPC que uma regra lê —
-- seguir a regra escrita vale mais que economizar uma reconstrução de cache.
--
-- AS DUAS ÓRFÃS
--
-- bi_power_users e bi_ultima_sincronizacao não são chamadas por função, view ou
-- cron do banco (varredura em pg_proc e pg_class), nem por src/ fora de
-- database.types.ts, que é gerado. bi_ultima_sincronizacao perdeu o último
-- consumidor em 17/08, quando a Visão Geral migrou para o shell novo e o
-- FrescorDoDado passou a responder a mesma pergunta por marts.data_referencia()
-- — duas réguas de "até quando vai o dado" na mesma tela era o defeito.
--
-- bi_power_users cai com um ganho de brinde: ela devolvia NOME e E-MAIL para
-- qualquer autenticado, o que divergia do contrato de PII do CLAUDE.md (lista
-- nominal atrás de private.is_admin()). É a pendência O do roadmap, uma linha
-- menor. As outras duas listas nominais (bi_clientes_em_risco e a de IA)
-- continuam abertas e seguem pendentes de decisão do Mateus.

-- ---------------------------------------------------------------------------
-- 1) O KPI de Jornada
-- ---------------------------------------------------------------------------
-- Muda a lista de colunas, então create or replace não serve.

drop function public.bi_jornada_kpis(integer);

create function public.bi_jornada_kpis(p_dias integer default 30)
returns table(
  sessoes bigint,
  telas_por_sessao numeric,
  telas_medianas numeric,
  pct_uma_tela numeric)
language sql stable set search_path to ''
as $function$
  with sess as (
    select sessao_id, max(telas_na_sessao) as telas
    from marts.fact_navegacao
    where data_brt > marts.data_referencia() - p_dias
    group by sessao_id
  )
  select count(*),
         round(avg(telas), 1),
         round(percentile_cont(0.5) within group (order by telas)::numeric, 1),
         round(count(*) filter (where telas = 1)::numeric / nullif(count(*), 0), 4)
  from sess;
$function$;

comment on function public.bi_jornada_kpis(integer) is
  'KPIs de sessão da Jornada. A duração mediana SAIU em 18/08 e não deve voltar sem instrumentação nova: a sessão é derivada por gap de 30 min sobre pageview, e sessão de uma tela tem chegada e saída no mesmo registro — 31,62% das sessões valiam zero por construção, e eram exatamente as mesmas que tinham uma tela só. No lugar entrou a mediana de telas, que ao lado da média expõe a inflação por sessão-robô. Não aplica a régua e_cliente porque marts.fact_navegacao já nasce filtrada.';

revoke execute on function public.bi_jornada_kpis(integer) from public, anon;
grant execute on function public.bi_jornada_kpis(integer) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2) As duas órfãs
-- ---------------------------------------------------------------------------

drop function public.bi_power_users(integer, integer, text, text);
drop function public.bi_ultima_sincronizacao();

-- ---------------------------------------------------------------------------
-- 3) Purga do cache da tela
-- ---------------------------------------------------------------------------
-- A chave é format('jornada|%s|%s|%s|%s', ...), então o like casa.

delete from insights.achado_cache where chave like 'jornada|%';
