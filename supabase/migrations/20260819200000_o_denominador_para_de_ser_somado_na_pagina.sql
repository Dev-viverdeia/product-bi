-- O denominador para de ser somado na página
--
-- Item (3) da auditoria, e o mais sistêmico: cinco telas montavam o
-- denominador de um percentual com `reduce((soma, x) => soma + x.campo, 0)` na
-- página.
--
-- ⚠️ A SOMA ESTAVA CERTA — E ESSE É O PONTO
--
-- Conferi: NENHUMA das RPCs envolvidas tem `LIMIT` ou `HAVING`, então cada
-- soma cobria a lista inteira e nenhum número publicado estava errado hoje. O
-- comentário de Formações até declarava isso ("nenhuma destas RPCs corta a
-- lista, então somar e comparar aqui é honesto"). O que estava errado era
-- outra coisa, em três camadas:
--
-- 1. **Escapa da supressão por amostra.** Contagem nunca é suprimida, então
--    um recorte estreito imprimiria fatia sobre denominador abaixo do mínimo
--    de 30. É a régua que o banco aplica e a página não tem como aplicar.
-- 2. **O denominador não está desenhado.** Soluções publicava "37,7% em
--    Vendas" sobre 49.777 inícios que nenhuma barra mostra, no único bloco de
--    destaque da tela.
-- 3. **É frágil a um LIMIT futuro.** No dia em que alguém cortar a RPC, a
--    conta continua rodando e passa a mentir sem erro nenhum.
--
-- ⚠️ E ACHEI UM DEFEITO PIOR NO CAMINHO: CORTE POR PREFIXO DE RÓTULO
--
-- Duas telas achavam a primeira faixa por texto. IA: `faixa.startsWith('1')`
-- para pegar "1 dia". Jornada: o mesmo para "1 tela" — e **"16+ telas" também
-- começa com 1**. Só acertava porque o `.find` devolve a primeira ocorrência e
-- a RPC ordena por `ordem`; duas coisas que ninguém prometeu manter, e
-- nenhuma delas dispara erro quando muda.
--
-- `pct_mais_de_um_dia` e `pct_mais_de_uma_tela` passam a sair do NÚMERO da
-- ordem, dentro da função.
--
-- ⚠️ E CS CONTAVA CARD E CHAMAVA DE CLIENTE
--
-- `bi_cs_funil` conta cards; o headline somava e dizia "clientes no quadro".
-- Kickoff tem 353 cards para 347 empresas distintas — há empresa com mais de
-- um card —, e isso na mesma tela em que o card de retenção declara grão de
-- cliente deduplicado. Agora a função devolve `cards_total` e `empresas_total`
-- separados, porque eles NÃO são a mesma coisa, e o headline usa o segundo.
--
-- Todas mudam o tipo de retorno, então `drop` e `create`.

drop function if exists public.bi_assuntos(integer);

create function public.bi_assuntos(p_dias integer default 30)
returns table(
  categoria text, aulas_concluidas bigint, alunos bigint,
  pct_das_aulas numeric, aulas_total bigint
)
language sql
stable
set search_path to ''
as $function$
  with base as (
    select coalesce(c.categoria, '(sem categoria)') as categoria,
           count(*) as aulas_concluidas,
           count(distinct f.user_id) as alunos
    from marts.fact_progresso_aula f
    join marts.dim_aula a on a.id = f.lesson_id
    join marts.dim_curso c on c.id = a.curso_id
    join marts.dim_usuario u on u.user_id = f.user_id and u.e_cliente
    where f.concluido_em is not null
      and (f.concluido_em at time zone 'America/Sao_Paulo')::date
          > (select marts.data_referencia()) - p_dias
    group by 1
  ),
  tot as (select coalesce(sum(aulas_concluidas), 0) as n from base)
  select b.categoria, b.aulas_concluidas, b.alunos,
         case when t.n >= 30 then round(b.aulas_concluidas::numeric / nullif(t.n, 0), 4) end,
         t.n
  from base b cross join tot t
  order by b.aulas_concluidas desc;
$function$;

grant execute on function public.bi_assuntos(integer) to authenticated, service_role;

comment on function public.bi_assuntos(integer) is
  'Aulas concluidas e alunos por categoria de curso. pct_das_aulas e aulas_total entraram em 19/08/2026: a pagina somava as categorias num reduce para montar o denominador do headline. A soma estava certa (a funcao nao corta), mas percentual derivado no cliente escapa da supressao por amostra e publica fatia sobre um total que nenhuma barra desenha.';

drop function if exists public.bi_consultor_recorrencia(integer);

create function public.bi_consultor_recorrencia(p_dias integer default 30)
returns table(
  faixa text, ordem integer, usuarios bigint,
  pct_dos_usuarios numeric, usuarios_total bigint, pct_mais_de_um_dia numeric
)
language sql
stable
set search_path to ''
as $function$
  with uso as (
    select c.user_id, count(*) as dias
    from marts.fact_consultor_uso_diario c
    join marts.dim_usuario u on u.user_id = c.user_id and u.e_cliente
    where c.data_brt > (select marts.data_referencia()) - p_dias
    group by c.user_id
  ),
  faixas as (
    select case
      when dias = 1 then '1 dia'
      when dias <= 3 then '2–3 dias'
      when dias <= 7 then '4–7 dias'
      when dias <= 15 then '8–15 dias'
      else '16+ dias'
    end as faixa,
    case
      when dias = 1 then 1 when dias <= 3 then 2 when dias <= 7 then 3
      when dias <= 15 then 4 else 5
    end as ordem,
    dias
    from uso
  ),
  base as (select faixa, ordem, count(*) as usuarios from faixas group by 1, 2),
  tot as (
    select coalesce(sum(usuarios), 0) as n,
           -- `dias > 1` sai do NÚMERO, não do rótulo. A página achava a faixa
           -- de um dia com `faixa.startsWith('1')` — que casa "1 dia" e casaria
           -- "16+ dias" se a ordem mudasse, e some em silêncio se alguém
           -- reescrever a legenda.
           coalesce(sum(usuarios) filter (where ordem > 1), 0) as voltam
    from base
  )
  select b.faixa, b.ordem, b.usuarios,
         case when t.n >= 30 then round(b.usuarios::numeric / nullif(t.n, 0), 4) end,
         t.n,
         case when t.n >= 30 then round(t.voltam::numeric / nullif(t.n, 0), 4) end
  from base b cross join tot t
  order by b.ordem;
$function$;

grant execute on function public.bi_consultor_recorrencia(integer) to authenticated, service_role;

comment on function public.bi_consultor_recorrencia(integer) is
  'Dias distintos de uso do Consultor por cliente, em faixas. pct_mais_de_um_dia e a fatia que voltou em 2+ dias e vem como coluna de janela desde 19/08/2026: a pagina calculava (total - umDia) / total, achando a faixa de um dia por prefixo do ROTULO (startsWith 1), que casaria 16+ dias e sumiria em silencio se a legenda mudasse. Agora o corte sai do numero da ordem.';

drop function if exists public.bi_consultor_modos();

create function public.bi_consultor_modos()
returns table(
  modo text, threads bigint, usuarios bigint,
  pct_das_threads numeric, threads_total bigint
)
language sql
stable
set search_path to ''
as $function$
  with base as (
    select coalesce(t.modo, '(sem modo)') as modo,
           count(*) as threads,
           count(distinct t.user_id) as usuarios
    from marts.fact_consultor_thread t
    join marts.dim_usuario u on u.user_id = t.user_id and u.e_cliente
    group by 1
  ),
  tot as (select coalesce(sum(threads), 0) as n from base)
  select b.modo, b.threads, b.usuarios,
         case when t.n >= 30 then round(b.threads::numeric / nullif(t.n, 0), 4) end,
         t.n
  from base b cross join tot t
  order by b.threads desc;
$function$;

grant execute on function public.bi_consultor_modos() to authenticated, service_role;

comment on function public.bi_consultor_modos() is
  'Threads e usuarios do Consultor por modo. pct_das_threads e threads_total entraram em 19/08/2026 pelo mesmo motivo das outras: o denominador do headline era somado na pagina.';

drop function if exists public.bi_onboarding_abandono();

create function public.bi_onboarding_abandono()
returns table(step_atual integer, clientes bigint, incompletos_total bigint)
language sql
stable
set search_path to ''
as $function$
  with base as (
    select o.step_atual, count(*) as clientes
    from marts.fact_onboarding o
    -- A régua e_cliente entrou em 19/08/2026: sem ela a função devolvia 1.600
    -- linhas contra 1.055 reais, com a distorção concentrada na etapa 0.
    join marts.dim_usuario u on u.user_id = o.user_id and u.e_cliente
    where not o.concluido and o.step_atual is not null
    group by 1
  ),
  tot as (select coalesce(sum(clientes), 0) as n from base)
  select b.step_atual, b.clientes, t.n
  from base b cross join tot t
  order by b.step_atual;
$function$;

grant execute on function public.bi_onboarding_abandono() to authenticated, service_role;

comment on function public.bi_onboarding_abandono() is
  'Quem nao concluiu o onboarding, por etapa atual, so cliente. A regua e_cliente entrou em 19/08/2026: sem ela eram 1.600 linhas contra 1.055 reais (545 nao-clientes, 34,1%), com a distorcao concentrada na etapa 0 (435 de 1.184). incompletos_total entrou junto, porque a pagina somava as etapas num reduce para o headline.';

drop function if exists public.bi_cs_funil(text);

create function public.bi_cs_funil(p_quadro text)
returns table(
  etapa text, etapa_ordem integer, cards bigint,
  cards_total bigint, empresas_total bigint
)
language sql
stable
set search_path to ''
as $function$
  with base as (
    select c.etapa, c.etapa_ordem, count(*) as cards
    from marts.fact_cs_card c
    where c.quadro = p_quadro
    group by 1, 2
  ),
  tot as (
    -- Duas contagens porque elas NÃO são iguais: o quadro tem card duplicado
    -- para a mesma empresa (Kickoff: 353 cards, 347 empresas). O headline dizia
    -- "clientes" sobre a soma de cards, na mesma tela em que o card de retenção
    -- declara grão de cliente deduplicado.
    select count(*) as n_cards, count(distinct c.empresa_hash) as n_empresas
    from marts.fact_cs_card c where c.quadro = p_quadro
  )
  select b.etapa, b.etapa_ordem, b.cards, t.n_cards, t.n_empresas
  from base b cross join tot t
  order by b.etapa_ordem;
$function$;

grant execute on function public.bi_cs_funil(text) to authenticated, service_role;

comment on function public.bi_cs_funil(text) is
  'Cards por etapa de um quadro do CS. cards_total e empresas_total sao colunas de janela e NAO sao iguais - o quadro tem card duplicado para a mesma empresa (Kickoff: 353 cards, 347 empresas). O headline da tela somava cards na pagina e chamava de clientes, na mesma tela em que o card de retencao declara grao de cliente deduplicado.';

drop function if exists public.bi_profundidade_sessao(integer);

create function public.bi_profundidade_sessao(p_dias integer default 30)
returns table(
  faixa text, ordem integer, sessoes bigint,
  pct_das_sessoes numeric, sessoes_total bigint, pct_mais_de_uma_tela numeric
)
language sql
stable
set search_path to ''
as $function$
  with sess as (
    select sessao_id, max(telas_na_sessao) as telas
    from marts.fact_navegacao
    where data_brt > (select marts.data_referencia()) - p_dias
    group by sessao_id
  ),
  faixas as (
    select case
      when telas = 1 then '1 tela'
      when telas <= 3 then '2–3 telas'
      when telas <= 7 then '4–7 telas'
      when telas <= 15 then '8–15 telas'
      else '16+ telas'
    end as faixa,
    case
      when telas = 1 then 1 when telas <= 3 then 2 when telas <= 7 then 3
      when telas <= 15 then 4 else 5
    end as ordem
    from sess
  ),
  base as (select faixa, ordem, count(*) as sessoes from faixas group by 1, 2),
  tot as (
    select coalesce(sum(sessoes), 0) as n,
           -- `ordem > 1` sai do NÚMERO. A página achava a faixa de uma tela com
           -- `faixa.startsWith('1')`, que casa "1 tela" E "16+ telas" — funciona
           -- hoje só porque o `.find` pega a primeira e a RPC ordena por ordem.
           coalesce(sum(sessoes) filter (where ordem > 1), 0) as exploram
    from base
  )
  select b.faixa, b.ordem, b.sessoes,
         case when t.n >= 30 then round(b.sessoes::numeric / nullif(t.n, 0), 4) end,
         t.n,
         case when t.n >= 30 then round(t.exploram::numeric / nullif(t.n, 0), 4) end
  from base b cross join tot t
  order by b.ordem;
$function$;

grant execute on function public.bi_profundidade_sessao(integer) to authenticated, service_role;

comment on function public.bi_profundidade_sessao(integer) is
  'Sessoes por quantidade de telas, em faixas. pct_mais_de_uma_tela e a fatia que passou de uma tela so e vem como coluna de janela desde 19/08/2026: a pagina calculava (total - umaTela) / total achando a faixa por prefixo do ROTULO (startsWith 1), que casa 1 tela E 16+ telas e so acerta porque o find pega a primeira e a RPC ordena por ordem. Agora o corte sai do numero.';

delete from insights.achado_cache
where chave like 'ia|%' or chave like 'formacoes|%' or chave like 'entrada|%'
   or chave like 'jornada|%';
