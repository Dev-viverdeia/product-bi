-- /jornada sobe a escada.
--
-- Tinha tres descritivos e dois diagnosticos -- nenhum comparativo, nenhum
-- prescritivo. Entram dois comparativos e a lista que a tela devia ter desde que
-- o achado das sessoes-monstro apareceu.
--
-- Nota de janela: marts.fact_navegacao cobre 03/07 a 08/08/2026 e mais nada. A
-- plataforma purga navegacao com mais de 30 dias todo domingo, entao este mart e
-- a UNICA copia da primeira semana. Nenhuma destas funcoes aceita p_dias: a
-- janela e o que existe, e cada uma devolve o intervalo para o card declarar.

-- 1) As sessoes que inflam o ranking.
--
-- Prescritivo: o alvo e a instrumentacao, e o numero justifica a acao. Sessao de
-- centenas de telas nao e habito de uso -- e aba esquecida aberta ou robo -- e
-- contamina de uma vez o ranking de pageview, as telas por sessao e a duracao
-- mediana.
create or replace function public.bi_jornada_sessoes_infladas()
returns table(
  faixa text, ordem integer, sessoes bigint, telas bigint,
  pct_sessoes numeric, pct_telas numeric,
  pessoas bigint, janela_inicio date, janela_fim date)
language sql
stable
set search_path to ''
as $function$
  with sessao as (
    select n.sessao_id,
      max(n.telas_na_sessao) as telas,
      min(n.user_id::text) as user_ref
    from marts.fact_navegacao n
    group by n.sessao_id
  ),
  faixas as (
    select
      case when s.telas <= 10 then 'Até 10 telas'
           when s.telas <= 50 then '11 a 50 telas'
           when s.telas <= 200 then '51 a 200 telas'
           else 'Mais de 200 telas' end as faixa,
      case when s.telas <= 10 then 1
           when s.telas <= 50 then 2
           when s.telas <= 200 then 3
           else 4 end as ordem,
      s.telas, s.user_ref
    from sessao s
  ),
  tot as (select count(*) as n_sessoes, sum(telas) as n_telas from faixas),
  janela as (select min(data_brt) as ini, max(data_brt) as fim from marts.fact_navegacao)
  select f.faixa, f.ordem, count(*) as sessoes, sum(f.telas) as telas,
    case when t.n_sessoes >= 30 then round(count(*)::numeric / t.n_sessoes, 4) end as pct_sessoes,
    case when t.n_telas >= 30 then round(sum(f.telas)::numeric / t.n_telas, 4) end as pct_telas,
    count(distinct f.user_ref) as pessoas,
    j.ini, j.fim
  from faixas f cross join tot t cross join janela j
  group by f.faixa, f.ordem, t.n_sessoes, t.n_telas, j.ini, j.fim
  order by f.ordem;
$function$;

comment on function public.bi_jornada_sessoes_infladas() is
  'Sessoes por numero de telas, com a fatia das sessoes e a fatia das telas vistas lado a lado. Sessao gigante e aba esquecida ou robo, nao habito -- e contamina ranking, telas por sessao e duracao mediana.';

-- 2) Por onde a sessao comeca muda o que ela vira.
create or replace function public.bi_jornada_porta_de_entrada()
returns table(
  grupo text, sessoes bigint, tela_unica bigint, pct_tela_unica numeric,
  mediana_telas numeric, margem_pp numeric, janela_inicio date, janela_fim date)
language sql
stable
set search_path to ''
as $function$
  with entrada as (
    select n.sessao_id, min(n.ordem_na_sessao) as primeira, max(n.telas_na_sessao) as telas
    from marts.fact_navegacao n
    group by n.sessao_id
  ),
  prim as (
    select e.sessao_id, e.telas,
      -- Porta da frente = a tela que o produto oferece como comeco. Todo o
      -- resto e link direto: alguem chegou apontado para um lugar especifico.
      case when n.tela in ('/', '/login', '/convite') then 'Pela porta da frente'
           else 'Por link direto' end as grupo
    from entrada e
    join marts.fact_navegacao n
      on n.sessao_id = e.sessao_id and n.ordem_na_sessao = e.primeira
  ),
  agregado as (
    select p.grupo, count(*) as sessoes,
      count(*) filter (where p.telas = 1) as tela_unica,
      case when count(*) >= 30
        then round(count(*) filter (where p.telas = 1)::numeric / count(*), 4) end as pct_tela_unica,
      round((percentile_cont(0.5) within group (order by p.telas))::numeric, 1) as mediana_telas
    from prim p group by p.grupo
  ),
  margem as (
    select round(200 * sqrt(sum(
      coalesce(a.pct_tela_unica, 0) * (1 - coalesce(a.pct_tela_unica, 0)) / nullif(a.sessoes, 0)
    ))::numeric, 1) as pp from agregado a
  ),
  janela as (select min(data_brt) as ini, max(data_brt) as fim from marts.fact_navegacao)
  select a.grupo, a.sessoes, a.tela_unica, a.pct_tela_unica, a.mediana_telas,
    m.pp, j.ini, j.fim
  from agregado a cross join margem m cross join janela j
  order by a.grupo;
$function$;

comment on function public.bi_jornada_porta_de_entrada() is
  'Sessoes que comecam pela porta da frente (/, /login, /convite) x por link direto, comparadas pela fatia que termina na primeira tela.';

-- 3) Navegar fundo prediz seguir ativo?
--
-- A navegacao e medida na PRIMEIRA semana do mart e o desfecho nos ultimos 30
-- dias -- janelas disjuntas, para o comportamento nao ser lido depois do
-- resultado. E associacao: navegar fundo tambem descreve quem ja chegou
-- engajado.
create or replace function public.bi_jornada_profundidade_e_retencao()
returns table(
  grupo text, clientes bigint, ativos bigint, pct_ativo numeric,
  margem_pp numeric, janela_inicio date, janela_fim date)
language sql
stable
set search_path to ''
as $function$
  with ref as materialized (select marts.data_referencia() as d),
  -- A semana de observacao sai do proprio mart, nao de data escrita a mao: se a
  -- carga andar, a janela anda junto em vez de apontar para o vazio.
  janela as materialized (
    select min(data_brt) as ini, min(data_brt) + 6 as fim from marts.fact_navegacao
  ),
  nav as materialized (
    select n.user_id,
      count(distinct n.sessao_id) as sessoes,
      count(*) as telas
    from marts.fact_navegacao n, janela j
    where n.data_brt between j.ini and j.fim
    group by n.user_id
  ),
  base as (
    select nv.user_id,
      nv.telas::numeric / nullif(nv.sessoes, 0) as telas_por_sessao,
      exists (
        select 1 from marts.fact_evento f, ref r
        where f.user_id = nv.user_id and f.data_brt > r.d - 30
      ) as ativo
    from nav nv
    join marts.dim_usuario u on u.user_id = nv.user_id and u.e_cliente
  ),
  agregado as (
    select
      case when b.telas_por_sessao >= 5 then 'Navega fundo (5+ telas por sessão)'
           else 'Navega raso (menos de 5)' end as grupo,
      count(*) as clientes,
      count(*) filter (where b.ativo) as ativos,
      case when count(*) >= 30
        then round(count(*) filter (where b.ativo)::numeric / count(*), 4) end as pct_ativo
    from base b group by 1
  ),
  margem as (
    select round(200 * sqrt(sum(
      coalesce(a.pct_ativo, 0) * (1 - coalesce(a.pct_ativo, 0)) / nullif(a.clientes, 0)
    ))::numeric, 1) as pp from agregado a
  )
  select a.grupo, a.clientes, a.ativos, a.pct_ativo, m.pp, j.ini, j.fim
  from agregado a cross join margem m cross join janela j
  order by a.grupo;
$function$;

comment on function public.bi_jornada_profundidade_e_retencao() is
  'Atividade recente de quem navegou fundo x raso na primeira semana registrada no mart. Janelas disjuntas de proposito: comportamento antes, desfecho depois.';

revoke execute on function public.bi_jornada_sessoes_infladas() from public, anon;
revoke execute on function public.bi_jornada_porta_de_entrada() from public, anon;
revoke execute on function public.bi_jornada_profundidade_e_retencao() from public, anon;
grant execute on function public.bi_jornada_sessoes_infladas() to authenticated;
grant execute on function public.bi_jornada_porta_de_entrada() to authenticated;
grant execute on function public.bi_jornada_profundidade_e_retencao() to authenticated;
