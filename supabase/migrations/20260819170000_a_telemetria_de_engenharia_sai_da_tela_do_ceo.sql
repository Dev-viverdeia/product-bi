-- A telemetria de engenharia sai da tela, e o KPI vira o desfecho do funil
--
-- Decisão do Mateus em 19/ago/2026: "dados como erros de javascript e dados não
-- úteis agora para o CEO analisar não devem ser mostrados".
--
-- O QUE SAIU DA TELA DE ENTRADA
--
-- 1. Card "Erros de JavaScript por tela" (`bi_erros_por_tela`) — tabela de rotas
--    em fonte monoespaçada com contagem de exceção: /solucoes 727,
--    /consultor-ia 626. É backlog de engenharia, e a descrição do card dizia
--    literalmente `client_error_logs`.
-- 2. Card "Erros de login por categoria" (`bi_erros_login`) — as categorias são
--    enum cru da origem, sem tradução: invalid_credentials, FALLBACK,
--    captcha_failed, server_5xx. Num produto cuja regra é "texto de UI sempre em
--    pt-BR", e com a descrição instruindo "investigar FALLBACK" — um chamado
--    para o time de engenharia, não uma análise.
-- 3. KPI "Erros de login" — contagem de ocorrência, no topo da tela.
-- 4. Regra `ent_erro_sem_categoria` ("Erro de login sem causa conhecida"), que
--    levava o mesmo assunto para as abas Análise e Plano.
--
-- ⚠️ O DADO NÃO FOI APAGADO. `marts.fact_erro_login`, `bi_erros_login` e
-- `bi_erros_por_tela` continuam de pé, com grant e tudo. A decisão foi sobre o
-- que a tela MOSTRA — "não úteis AGORA" —, e apagar o mart tornaria a volta
-- cara sem ganhar nada hoje.
--
-- O QUE ENTROU NO LUGAR
--
-- O KPI de erro dá lugar ao DESFECHO do funil desta tela: de todo convite
-- criado no período, quantas pessoas chegaram a fazer alguma coisa dentro do
-- produto. A fileira do topo passa a ser o funil inteiro em quatro números —
-- convites criados → conversão → onboarding → 1ª ação.
--
-- `primeira_acao` repete a expressão EXATA da quarta etapa de
-- `bi_funil_entrada`, e isso é o ponto: o KPI do topo e a última barra do funil
-- logo abaixo são o mesmo número, não duas contas que podem divergir. Conferido
-- depois de aplicar: 1.000 nos dois.
--
-- CONSEQUÊNCIA QUE VALE REGISTRAR
--
-- O único card `prescritivo` da Entrada era a lista de erros de JavaScript.
-- Tirando ela, a tela ficou com ZERO cards que dizem o que fazer, e saiu da
-- régua da escada (`TELAS_NA_REGUA`, com o motivo escrito no teste).
--
-- Isso não é efeito colateral do corte — é o corte revelando o que já era
-- verdade: a única "ação" da tela de entrada era um backlog de bug com roupa de
-- análise. O achado `ent_master_nao_convida` (compradores que nunca convidaram
-- ninguém) existe no motor e aparece nas abas Análise e Plano; falta o CARD que
-- o sustente na aba Gráficos.
--
-- `drop` e não `create or replace`: o tipo de retorno muda.

drop function if exists public.bi_entrada_kpis(integer);

create function public.bi_entrada_kpis(p_dias integer default 30)
returns table(convites bigint, conversao numeric, onboarding_pct numeric, primeira_acao bigint)
language sql
stable
set search_path to ''
as $function$
  with hoje as (select marts.data_referencia() d),
  janela as (
    select c.* from marts.fact_convite c, hoje h
    where c.deletado_em is null
      and (c.criado_em at time zone 'America/Sao_Paulo')::date > h.d - p_dias
      -- Cláusula IDÊNTICA à de bi_funil_entrada. A régua sai do NUMERADOR E DO
      -- DENOMINADOR; convite ainda não usado fica, porque não há como saber
      -- quem vai usá-lo.
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
    -- Expressão IDÊNTICA à da 4ª etapa de bi_funil_entrada, de propósito: o KPI
    -- do topo e a última barra do funil são o MESMO número, não duas contas.
    (select count(distinct j.usado_por) from janela j
      where j.usado_por is not null
        and exists (select 1 from marts.fact_evento f where f.user_id = j.usado_por));
$function$;

grant execute on function public.bi_entrada_kpis(integer) to authenticated, service_role;

comment on function public.bi_entrada_kpis(integer) is
  'KPIs da Entrada. A janela de convite usa a MESMA clausula e_cliente de bi_funil_entrada - sem ela o KPI publicava 4.523 convites e o funil da mesma tela publicava 4.504. `primeira_acao` repete a expressao da 4a etapa do funil, entao o KPI do topo e a ultima barra do funil sao o mesmo numero. Substituiu `erros_login`, telemetria de engenharia que saiu da tela por decisao do Mateus em 19/08/2026: ocorrencia de falha de login por enum tecnico nao e analise que o CEO faca, e o dado segue no mart para quem precisar.';

-- O motor perde a regra de erro de login junto com o card que a ancorava.
-- Deixá-la publicaria, nas abas Análise e Plano, um achado cujo card não existe
-- mais — que é a mesma família de defeito que o contrato de CI impede do outro
-- lado (número que não existe em lugar nenhum da tela).
create or replace function insights.calcular_achados_entrada(
  p_dias integer default 30, p_papel text default null, p_plano text default null
)
returns table(
  regra text, familia text, severidade text, titulo text, gabarito text,
  gabarito_leitura text, gabarito_acao text, parametros jsonb, score numeric,
  suprimida boolean, motivo text, ancora_aba text, ancora_id text
)
language sql
stable
set search_path to ''
as $function$
  with
  funil as materialized (select * from public.bi_funil_entrada(p_dias)),
  onb as materialized (select * from public.bi_onboarding_abandono()),
  mst as materialized (select * from public.bi_masters_convites_resumo()),
  origem as materialized (select * from public.bi_entrada_primeira_acao_por_origem()),

  funil_n as (
    select
      max(f.quantidade) filter (where f.ordem = 1) as criados,
      max(f.quantidade) filter (where f.ordem = 2) as cadastros,
      max(f.quantidade) filter (where f.ordem = 4) as primeira_acao
    from funil f
  ),
  r_perda_antes_da_conta as (
    select 'ent_perda_antes_da_conta'::text as regra,
      case when p_dias < 30
             then 'janela curta demais: convite recente ainda tem prazo para virar cadastro'
           when n.criados is null or n.criados = 0
             then 'nenhum convite criado no período'
           when n.criados - n.primeira_acao <= 0
             then 'o funil não perdeu ninguém no período'
           when (n.criados - n.cadastros)::numeric / nullif(n.criados - n.primeira_acao, 0) < 0.50
             then 'a maior parte da perda acontece dentro do produto, e não antes do cadastro'
      end as motivo,
      jsonb_build_object(
        'criados', n.criados,
        'perdidos_antes', n.criados - n.cadastros,
        'perdidos_total', n.criados - n.primeira_acao,
        'parte', round((n.criados - n.cadastros)::numeric
                       / nullif(n.criados - n.primeira_acao, 0), 4)) as parametros,
      round((n.criados - n.cadastros)::numeric
            / nullif(n.criados - n.primeira_acao, 0) / 0.50, 2) as score
    from funil_n n
  ),

  onb_n as (
    select
      sum(o.clientes) as incompletos,
      sum(o.clientes) filter (
        where o.step_atual = (select min(o2.step_atual) from onb o2)) as na_primeira
    from onb o
  ),
  r_onboarding_nao_comeca as (
    select 'ent_onboarding_nao_comeca'::text as regra,
      case when n.incompletos is null or n.incompletos = 0
             then 'nenhum onboarding em aberto'
           when n.incompletos < 30
             then 'menos de trinta onboardings em aberto: abaixo do piso de amostra da casa'
           when n.na_primeira is null or n.na_primeira = 0
             then 'ninguém parado na primeira etapa'
           when n.na_primeira::numeric / nullif(n.incompletos, 0) < 0.50
             then 'o abandono está distribuído pelo fluxo, e não concentrado na entrada'
      end as motivo,
      jsonb_build_object(
        'incompletos', n.incompletos,
        'na_primeira', n.na_primeira,
        'resto', n.incompletos - n.na_primeira,
        'parte', round(n.na_primeira::numeric / nullif(n.incompletos, 0), 4)) as parametros,
      round(n.na_primeira::numeric / nullif(n.incompletos, 0) / 0.50, 2) as score
    from onb_n n
  ),

  r_master_nao_convida as (
    select 'ent_master_nao_convida'::text as regra,
      case when m.masters_total is null or m.masters_total = 0
             then 'nenhum comprador na base'
           when m.masters_total < 30
             then 'menos de trinta compradores: abaixo do piso de amostra da casa'
           when m.pct_convidam is null
             then 'a régua não devolveu a fatia de compradores que convidam'
           when 1 - m.pct_convidam < 1.0 / 3.0
             then 'menos de um terço dos compradores está sem convite criado'
      end as motivo,
      jsonb_build_object(
        'masters', m.masters_total,
        'sem_convite', m.masters_total - m.masters_convidaram,
        'parte', round(1 - m.pct_convidam, 4),
        'conversao', m.conversao_convites) as parametros,
      round((1 - m.pct_convidam) / (1.0 / 3.0), 2) as score
    from mst m
  ),

  origem_n as (
    select
      max(o.base_comprador) filter (where o.faixa = 'Nunca agiu') as base_comprador,
      max(o.base_convidado) filter (where o.faixa = 'Nunca agiu') as base_convidado,
      max(o.compradores)    filter (where o.faixa = 'Nunca agiu') as compradores,
      max(o.convidados)     filter (where o.faixa = 'Nunca agiu') as convidados,
      max(o.pct_comprador)  filter (where o.faixa = 'Nunca agiu') as pct_comprador,
      max(o.pct_convidado)  filter (where o.faixa = 'Nunca agiu') as pct_convidado
    from origem o
  ),
  r_sem_primeira_acao as (
    select 'ent_sem_primeira_acao'::text as regra,
      case when n.base_comprador is null or n.base_convidado is null
             then 'a faixa sem nenhuma ação não veio na régua de origem'
           when n.base_comprador < 30 or n.base_convidado < 30
             then 'um dos dois grupos está abaixo do piso de trinta clientes'
           when n.pct_comprador is null or n.pct_comprador = 0
             then 'nenhum comprador na faixa sem ação: não há razão a comparar'
           when n.pct_convidado / n.pct_comprador < 2.0
             then 'a parcela de convidados sem ação não chega ao dobro da de compradores'
      end as motivo,
      jsonb_build_object(
        'compradores', n.compradores,
        'convidados', n.convidados,
        'base_comprador', n.base_comprador,
        'base_convidado', n.base_convidado,
        'pct_comprador', n.pct_comprador,
        'pct_convidado', n.pct_convidado,
        'razao', round(n.pct_convidado / nullif(n.pct_comprador, 0), 2)) as parametros,
      round((n.pct_convidado / nullif(n.pct_comprador, 0)) / 2.0, 2) as score
    from origem_n n
  ),

  todas as (
    select * from r_perda_antes_da_conta
    union all select * from r_onboarding_nao_comeca
    union all select * from r_master_nao_convida
    union all select * from r_sem_primeira_acao
  )
  select t.regra, g.familia,
    case when t.motivo is not null then 'neutro'
         when t.score >= 2.0 then 'critico'
         when t.score >= 1.5 then 'atencao'
         else 'neutro' end,
    g.titulo, g.gabarito, g.gabarito_leitura, g.gabarito_acao, t.parametros,
    t.score, (t.motivo is not null), t.motivo, g.ancora_aba, g.ancora_id
  from todas t
  join insights.regra g on g.id = t.regra
  order by (t.motivo is not null), t.score desc;
$function$;

delete from insights.regra where id = 'ent_erro_sem_categoria';

delete from insights.achado_cache where chave like 'entrada|%';
