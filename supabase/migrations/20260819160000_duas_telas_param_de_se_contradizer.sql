-- Duas telas param de se contradizer: aulas concluídas e convites
--
-- Os dois defeitos têm a mesma forma — a fileira de KPI é uma SEGUNDA CONSULTA
-- sobre o mesmo fato, com régua própria. O motor de achados tem contrato de CI
-- exatamente contra isto ("o calculador só lê public.bi_*, é o que garante que
-- o número da frase é O MESMO do card"). A fileira de KPI é o único lugar do
-- produto onde essa regra nunca foi aplicada.
--
-- 1. "AULAS CONCLUÍDAS" TINHA DOIS VALORES, EM DUAS TELAS
--
-- Mesma janela de 30 dias, mesmo rótulo: 22.702 na Visão Geral, 22.795 em
-- Formações. As duas aplicam `e_cliente`; a divergência é de FONTE.
-- `bi_visao_geral_kpis` contava `fact_evento` com `tipo = 'lesson_completed'`;
-- `bi_formacoes_kpis` conta `fact_progresso_aula`.
--
-- O valor de Formações é o de referência, e não por gosto: `fact_evento`
-- depende de instrumentação, e o BI já registra rastreio quebrado nela —
-- `marts.rastreio_corroboracao` tem tipos de evento parados com a fonte
-- independente ainda registrando. Progresso é o fato; evento é o aviso de que
-- o fato aconteceu, e o aviso se perde.
--
-- Muda `aulas` E `aulas_ant`: um delta que compara fontes diferentes entre as
-- duas janelas mediria a troca, não o cliente.
--
-- 2. ENTRADA SE CONTRADIZIA DENTRO DA PRÓPRIA TELA
--
-- 4.523 convites no KPI contra 4.504 no funil logo abaixo; conversão de 39,58%
-- contra 39,32%. Um número ao lado do outro, na mesma dobra.
--
-- A causa é que `bi_funil_entrada` aplica a régua `e_cliente` no convite (e
-- documenta por quê: "A régua sai do NUMERADOR E DO DENOMINADOR") e
-- `bi_entrada_kpis` não aplicava. A janela do KPI passa a ser a MESMA cláusula,
-- literalmente — inclusive o "convite ainda não usado fica, porque não há como
-- saber quem vai usá-lo".
--
-- `erros_login` fica de fora da régua de propósito: mede instrumentação de
-- login, e filtrar por cliente esconderia justamente a falha que atinge quem
-- ainda não conseguiu entrar.

create or replace function public.bi_visao_geral_kpis(
  p_dias integer default 30, p_papel text default null, p_plano text default null
)
returns table(
  ativos bigint, ativos_ant bigint, novos bigint, novos_ant bigint,
  aulas bigint, aulas_ant bigint, pageviews bigint, pageviews_ant bigint, base bigint
)
language sql
stable
set search_path to ''
as $function$
  with hoje as materialized (select marts.data_referencia() d),
  clientes as (
    select u.user_id, u.criado_em from marts.dim_usuario u
    where u.e_cliente
      and (p_papel is null or u.papel = p_papel)
      and (p_plano is null or coalesce(u.plano, 'sem_plano') = p_plano)
  ),
  rastreio as (select min(data_brt) as inicio from marts.fact_pageview),
  comparavel as (
    select (h.d - 2 * p_dias) >= r.inicio as ok from hoje h, rastreio r
  ),
  n as (
    select
      (select count(distinct f.user_id) from marts.fact_evento f
         join clientes c on c.user_id = f.user_id, hoje
        where f.data_brt > hoje.d - p_dias) as ativos,
      (select count(distinct f.user_id) from marts.fact_evento f
         join clientes c on c.user_id = f.user_id, hoje
        where f.data_brt > hoje.d - 2*p_dias and f.data_brt <= hoje.d - p_dias) as ativos_ant,
      -- `criado_em` é a data de CADASTRO, e o card "De onde veio o número de
      -- ativos" chama de "novo" quem teve a PRIMEIRA AÇÃO no período. São duas
      -- coisas diferentes e as duas são úteis; quem separa é o rótulo, na tela.
      (select count(*) from clientes c, hoje
        where (c.criado_em at time zone 'America/Sao_Paulo')::date > hoje.d - p_dias) as novos,
      (select count(*) from clientes c, hoje
        where (c.criado_em at time zone 'America/Sao_Paulo')::date > hoje.d - 2*p_dias
          and (c.criado_em at time zone 'America/Sao_Paulo')::date <= hoje.d - p_dias) as novos_ant,
      -- fact_progresso_aula, a MESMA fonte de bi_formacoes_kpis. Contar
      -- fact_evento aqui dava 22.702 contra 22.795 lá, com o mesmo rótulo em
      -- duas telas.
      (select count(*) from marts.fact_progresso_aula f
         join clientes c on c.user_id = f.user_id, hoje
        where f.concluido_em is not null
          and (f.concluido_em at time zone 'America/Sao_Paulo')::date > hoje.d - p_dias) as aulas,
      (select count(*) from marts.fact_progresso_aula f
         join clientes c on c.user_id = f.user_id, hoje
        where f.concluido_em is not null
          and (f.concluido_em at time zone 'America/Sao_Paulo')::date > hoje.d - 2*p_dias
          and (f.concluido_em at time zone 'America/Sao_Paulo')::date <= hoje.d - p_dias) as aulas_ant,
      (select count(*) from marts.fact_pageview p join clientes c on c.user_id = p.user_id, hoje
        where p.data_brt > hoje.d - p_dias) as pageviews,
      (select case when (select ok from comparavel) then
         (select count(*) from marts.fact_pageview p join clientes c on c.user_id = p.user_id, hoje
           where p.data_brt > hoje.d - 2*p_dias and p.data_brt <= hoje.d - p_dias)
       end) as pageviews_ant,
      (select count(*) from clientes) as base
  )
  select
    n.ativos,    case when n.ativos    >= 30 and n.ativos_ant    >= 30 then n.ativos_ant    end,
    n.novos,     case when n.novos     >= 30 and n.novos_ant     >= 30 then n.novos_ant     end,
    n.aulas,     case when n.aulas     >= 30 and n.aulas_ant     >= 30 then n.aulas_ant     end,
    n.pageviews, case when n.pageviews >= 30 and n.pageviews_ant >= 30 then n.pageviews_ant end,
    n.base
  from n;
$function$;

comment on function public.bi_visao_geral_kpis(integer, text, text) is
  'KPIs da Visao Geral. `aulas` conta marts.fact_progresso_aula, a MESMA fonte de bi_formacoes_kpis - contar fact_evento com tipo lesson_completed dava 22.702 aqui contra 22.795 la, com o mesmo rotulo em duas telas, e fact_evento depende de instrumentacao que o BI ja registra como quebrada em alguns tipos. `novos` conta data de CADASTRO; o card De onde veio o numero de ativos chama de novo quem teve a primeira acao no periodo - sao medidas diferentes e o rotulo da tela separa as duas.';

create or replace function public.bi_entrada_kpis(p_dias integer default 30)
returns table(convites bigint, conversao numeric, onboarding_pct numeric, erros_login bigint)
language sql
stable
set search_path to ''
as $function$
  with hoje as (select marts.data_referencia() d),
  janela as (
    select c.* from marts.fact_convite c, hoje h
    where c.deletado_em is null
      and (c.criado_em at time zone 'America/Sao_Paulo')::date > h.d - p_dias
      -- Cláusula IDÊNTICA à de bi_funil_entrada, e é o conserto: sem ela o KPI
      -- dizia 4.523 convites e o funil logo abaixo dizia 4.504, na mesma dobra.
      -- A régua sai do NUMERADOR E DO DENOMINADOR; convite ainda não usado fica,
      -- porque não há como saber quem vai usá-lo.
      and (c.usado_por is null
           or exists (select 1 from marts.dim_usuario d
                       where d.user_id = c.usado_por and d.e_cliente))
  )
  select
    (select count(*) from janela),
    round((select count(usado_em) from janela)::numeric
      / nullif((select count(*) from janela), 0), 4),
    (select round(count(*) filter (where o.concluido)::numeric / nullif(count(*), 0), 4)
     from janela j join marts.fact_onboarding o on o.user_id = j.usado_por),
    -- Sem a régua de propósito: mede instrumentação de login, e filtrar por
    -- cliente esconderia justamente a falha de quem ainda não conseguiu entrar.
    (select count(*) from marts.fact_erro_login e, hoje h
     where (e.criado_em at time zone 'America/Sao_Paulo')::date > h.d - p_dias);
$function$;

comment on function public.bi_entrada_kpis(integer) is
  'KPIs da Entrada. A janela de convite usa a MESMA clausula e_cliente de bi_funil_entrada - sem ela o KPI publicava 4.523 convites e o funil da mesma tela publicava 4.504, com conversao de 39,58% contra 39,32%. erros_login fica fora da regua de proposito: mede instrumentacao de login, e filtrar por cliente esconderia a falha de quem ainda nao conseguiu entrar.';

-- O valor de `aulas` muda, e o achado de Visão Geral o carrega. O cache guarda
-- o achado serializado e serviria o número velho sem erro nenhum.
delete from insights.achado_cache where chave like 'visao-geral|%' or chave like 'entrada|%';
