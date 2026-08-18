-- Duas regras voltam a publicar o que a tela mostra
--
-- Achado da auditoria de 18/08, pedida pelo Mateus ("garanta que todos os dados
-- estão corretos"). Das 35 regras do catálogo, 33 publicam número que o card
-- apontado desenha. Estas duas, não — e as duas violam a régua central do
-- motor, que o CLAUDE.md enuncia assim: **o número da frase existe num card da
-- tela, sempre**.
--
-- Foi por violar isso que `org_time_morto`, `sol_aba_pulada` e
-- `sol_catalogo_sem_morto` foram RECUSADAS em 12/08. Estas duas passaram porque
-- nasceram corretas e a tela mudou embaixo delas.
--
-- ============================================================================
-- 1. vg_concentracao — APOSENTADA
-- ============================================================================
--
-- O DEFEITO, MEDIDO
--
-- A frase publicava "de todas as ações do período — {total} ações no total"
-- somando `bi_eventos_por_tipo` (59.138 ações) e ancorava em `card-eventos`,
-- que desenha `bi_acoes_por_modulo` (70.949). Onze mil e oitocentas ações de
-- diferença — vinte por cento — para a mesma expressão, na mesma tela.
--
-- A CAUSA NÃO É A ÂNCORA, É A BASE
--
-- Rastreado até o commit c0b7c71: quando a Visão Geral subiu a escada, o card
-- que desenhava `bi_eventos_por_tipo` saiu, o `id` foi reaproveitado por outro
-- gráfico e a regra ficou apontando para ele. O hook `useEventosPorTipo` está
-- órfão desde então — é a impressão digital do card removido.
--
-- Mas re-ancorar não resolveria. Desde 20260818030000 (passo 4 da Fase 2), a
-- definição de "ação de produto" da casa é `bi_acoes_por_modulo`: eventos menos
-- os aposentados, mais os inícios de solução reconstruídos do mart. A diferença
-- de 11.811 É exatamente esse braço reconstruído. `bi_eventos_por_tipo` conta o
-- que a plataforma emite; o produto conta outra coisa. A regra media sobre uma
-- base que o produto abandonou.
--
-- POR QUE APOSENTAR EM VEZ DE REESCREVER
--
-- Reescrita sobre a base atual, a regra vira redundante: `solution_viewed` é
-- hoje o ÚNICO tipo classificado como `consumo` por `marts.tipo_de_acao`, então
-- "a fatia do comportamento líder" e "a fatia de consumo" são o mesmo número —
-- 25.658 de 70.949, ou 36,2%. E esse número já está publicado no headline do
-- card "O uso é raso ou profundo?", como complemento dos 63,5% de compromisso.
-- A própria leitura da regra ("o indicador de uso da casa é o indicador desse
-- comportamento") é a leitura daquele card.
--
-- É o caso de `cli_gap_papel`, aposentada em 12/08 pelo mesmo motivo: media
-- pela régua errada o que outra peça mede pela certa, e ocupava a mesma
-- família. Com o motor saturado (34 de 35 regras disparando), tirar regra
-- redundante é ganho de sinal, não perda de cobertura.
--
-- Efeito colateral desejado: sem esta regra, `calcular_achados_visao_geral`
-- deixa de ler `bi_eventos_por_tipo`, e o calculador passa a ler só a RPC que a
-- tela desenha.
--
-- ============================================================================
-- 2. ent_sem_primeira_acao — REESCRITA SOBRE O CARD QUE EXISTE
-- ============================================================================
--
-- O DEFEITO, MEDIDO
--
-- A regra lia `bi_tempo_primeiro_valor` — que NENHUM card da Entrada desenha.
-- Ele foi substituído de propósito por `bi_entrada_primeira_acao_por_origem`, e
-- o motivo está escrito em `features/entrada/queries.ts`: "a distribuição
-- sozinha contava quanto e escondia o corte que importa".
--
-- O número central sobrevive à troca: os 2.880 que nunca agiram aparecem no
-- card como 113 compradores mais 2.766 convidados. O que não sobrevive é a
-- frase. Ela publicava 31,57% — percentual sobre a coorte somada, que o card
-- nunca mostra — e terminava afirmando "a maior barra do gráfico é a de quem
-- não agiu", que no card em tela é verdade para convidados (34,5%) e FALSA para
-- compradores, cuja maior barra é "No mesmo dia" (42,7%).
--
-- Uma frase que afirma algo SOBRE O GRÁFICO é o pior caso desta classe: quem
-- clica para conferir encontra o contrário do que leu.
--
-- POR QUE REESCREVER EM VEZ DE VOLTAR O CARD ANTIGO
--
-- Voltar a distribuição de sete faixas desfaria uma decisão deliberada e
-- registrada. E não é preciso: o corte por origem responde a mesma pergunta com
-- mais informação. A regra passa a publicar a fratura que o roadmap já celebra
-- como achado da leva de 12/08 — "quem comprou age; quem foi convidado, não" —
-- e que o motor nunca teve.
--
-- MEDIDO HOJE
--
--   nunca agiu, comprador   113 de 1.095   10,3%
--   nunca agiu, convidado 2.766 de 8.027   34,5%
--   razão                                   3,34x
--
-- O limiar é o dobro, então o score é 1,67 — múltiplo do próprio limiar, como
-- manda a régua de score da casa.
--
-- A janela NÃO viaja como parâmetro, ao contrário da versão antiga. Lá,
-- `janela_min` e `janela_max` eram 30 e 180 chumbados no calculador, espelhando
-- o SQL da RPC — uma segunda cópia que apodrece em silêncio se a RPC mudar. A
-- frase nova afirma só o que é verdade por construção: os dois grupos saem da
-- MESMA chamada, logo da mesma safra e da mesma janela.
--
-- PURGA DE CACHE OBRIGATÓRIA nas duas telas: `insights.achado_cache` guarda o
-- achado serializado, gabarito e parâmetros inclusos.

-- ---------------------------------------------------------------------------
-- vg_concentracao sai do catálogo e do calculador
-- ---------------------------------------------------------------------------

delete from insights.regra where id = 'vg_concentracao';

create or replace function insights.calcular_achados_visao_geral(
  p_dias integer default 30,
  p_papel text default null,
  p_plano text default null)
returns table(regra text, familia text, severidade text, titulo text, gabarito text,
              gabarito_leitura text, gabarito_acao text, parametros jsonb, score numeric,
              suprimida boolean, motivo text, ancora_aba text, ancora_id text)
language sql stable set search_path to ''
as $function$
  with
  kpi as materialized (select * from public.bi_visao_geral_kpis(p_dias, p_papel, p_plano)),
  r_penetracao as (
    select 'vg_penetracao'::text as regra,
      case when k.base is null or k.base = 0 then 'base do recorte indisponível'
           when k.ativos::numeric / k.base >= 0.5 then 'penetração acima de metade da base'
      end as motivo,
      jsonb_build_object('ativos', k.ativos, 'base', k.base,
        'penetracao', round(k.ativos::numeric / nullif(k.base, 0), 4)) as parametros,
      round(0.5 / nullif(k.ativos::numeric / nullif(k.base, 0), 0), 2) as score
    from kpi k
  ),
  r_tendencia as (
    select 'vg_tendencia'::text as regra,
      case when k.ativos_ant is null then 'período anterior sem comparação sustentada pela régua de amostra'
           when abs(k.ativos::numeric / k.ativos_ant - 1) < 0.05 then 'variação abaixo do limiar de cinco por cento'
      end as motivo,
      jsonb_build_object('ativos', k.ativos, 'ativos_ant', k.ativos_ant,
        'delta', round(k.ativos::numeric / nullif(k.ativos_ant, 0) - 1, 4)) as parametros,
      round(abs(k.ativos::numeric / nullif(k.ativos_ant, 0) - 1) / 0.05, 2) as score
    from kpi k
  ),
  todas as (
    select * from r_penetracao
    union all select * from r_tendencia
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

-- ---------------------------------------------------------------------------
-- ent_sem_primeira_acao passa a ler a RPC que o card desenha
-- ---------------------------------------------------------------------------

update insights.regra set
  pergunta = 'Quem nunca faz a primeira ação — e isso depende de ter comprado ou de ter sido convidado?',
  titulo = 'A porta separa quem comprou de quem foi convidado',
  gabarito = '{pct_convidado:pct} de quem foi convidado nunca fez nenhuma ação no produto, contra {pct_comprador:pct} de quem comprou — {convidados:int} pessoas de um lado, {compradores:int} do outro, na mesma safra e com a mesma janela para agir.',
  gabarito_leitura = 'A diferença não é de tempo de casa: os dois grupos saem da mesma medição, logo da mesma safra e da mesma janela. O que ela não separa é intenção de acesso — quem compra escolheu o produto, quem foi convidado foi inscrito por outra pessoa, e este dado não diz se o convidado chegou a saber que a conta existia. E {razao:mult} é a distância entre as duas parcelas, não prova de que o convite cause a inação.',
  gabarito_acao = 'O convite entrega acesso, não ativação. A alavanca fica entre o aceite e a primeira ação de quem não escolheu entrar — e ela é do comprador que convidou, não do convidado. Quem mais convida está no card de masters, nesta mesma tela.',
  limiar_descricao = 'A parcela de convidados sem nenhuma ação ser pelo menos o dobro da de compradores, com os dois grupos acima do piso de trinta clientes.'
where id = 'ent_sem_primeira_acao';

create or replace function insights.calcular_achados_entrada(
  p_dias integer default 30,
  p_papel text default null,
  p_plano text default null)
returns table(regra text, familia text, severidade text, titulo text, gabarito text,
              gabarito_leitura text, gabarito_acao text, parametros jsonb, score numeric,
              suprimida boolean, motivo text, ancora_aba text, ancora_id text)
language sql stable set search_path to ''
as $function$
  with
  funil as materialized (select * from public.bi_funil_entrada(p_dias)),
  erros as materialized (select * from public.bi_erros_login(p_dias)),
  -- As três RPCs abaixo não recebem janela: as regras que dependem delas devolvem o mesmo
  -- achado em qualquer período. Os cards de origem se comportam igual, então o motor não
  -- mente mais que a tela — mas o bloco vai parecer surdo ao filtro de período.
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
    -- O funil é por safra e tem censura à direita: abaixo de trinta dias a perda medida é
    -- em boa parte prazo que ainda não venceu, não perda de verdade. Por isso a janela curta
    -- suprime antes de qualquer conta.
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
      -- As etapas de convite contam convites e a etapa final conta pessoas. A diferença é de
      -- uma unidade hoje, e o gabarito usa "perda" como substantivo neutro justamente para
      -- não afirmar unidade que o funil não garante.
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

  erros_n as (
    -- 'FALLBACK' é o rótulo que o card exibe e que a telemetria grava. Se a categoria de sobra
    -- for renomeada na origem, esta regra passa a medir zero e some sem erro nenhum.
    select
      coalesce(sum(e.ocorrencias) filter (where e.categoria = 'FALLBACK'), 0) as sem_categoria,
      sum(e.ocorrencias) as total
    from erros e
  ),
  r_erro_sem_categoria as (
    select 'ent_erro_sem_categoria'::text as regra,
      case when n.total is null or n.total = 0
             then 'nenhum erro de login registrado no período'
           when n.total < 30
             then 'menos de trinta ocorrências no período: amostra pequena demais para falar de distribuição'
           when n.sem_categoria = 0
             then 'toda ocorrência do período tem causa classificada'
           when n.sem_categoria::numeric / nullif(n.total, 0) < 0.20
             then 'menos de um quinto das ocorrências ficou sem causa'
      end as motivo,
      jsonb_build_object(
        'sem_categoria', n.sem_categoria,
        'total', n.total,
        'parte', round(n.sem_categoria::numeric / nullif(n.total, 0), 4)) as parametros,
      round(n.sem_categoria::numeric / nullif(n.total, 0) / 0.20, 2) as score
    from erros_n n
  ),

  onb_n as (
    -- A primeira etapa vem de min(step_atual), e não de zero chumbado: se o fluxo passar a
    -- numerar a partir de outro ponto, a regra continua falando da etapa de entrada.
    select
      sum(o.clientes) as incompletos,
      sum(o.clientes) filter (
        where o.step_atual = (select min(o2.step_atual) from onb o2)) as na_primeira
    from onb o
  ),
  r_onboarding_nao_comeca as (
    -- bi_onboarding_abandono não aplica a régua e_cliente, ao contrário do resto da tela.
    -- Numerador e denominador carregam a mesma contaminação, então a fatia se sustenta;
    -- o número absoluto de incompletos é maior que o da base de clientes.
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
    -- Agregado sobre o conjunto INTEIRO, e não `where faixa = ...`, de propósito: um filtro
    -- de linha devolveria zero linha se o rótulo mudasse na RPC, e a regra sumiria do bloco
    -- sem erro nenhum. Agregando, a linha existe sempre e os nulos caem no motivo abaixo.
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
    -- Lê a MESMA RPC que o card `card-tempo-primeira-acao` desenha. A versão anterior lia
    -- bi_tempo_primeiro_valor, que nenhum card da tela desenha desde que a distribuição de
    -- sete faixas foi substituída pelo corte por origem — e publicava um percentual sobre a
    -- coorte somada que o card nunca mostrou.
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
    union all select * from r_erro_sem_categoria
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

-- ---------------------------------------------------------------------------
-- As duas RPCs que ficaram órfãs, com o aviso no próprio banco
-- ---------------------------------------------------------------------------

comment on function public.bi_eventos_por_tipo(integer, text, text) is
  'Eventos crus por tipo, direto de marts.fact_evento. ⚠️ NÃO é a base de "ação de produto" da casa desde 20260818030000: public.bi_acoes_por_modulo exclui os eventos aposentados e soma os inícios de solução reconstruídos do mart, e as duas somas diferem em cerca de vinte por cento. Nenhum card consome esta função hoje, e a regra vg_concentracao foi aposentada por medir sobre esta base enquanto a tela mostrava a outra. Serve para investigação de instrumentação; não usar como denominador de "todas as ações".';

comment on function public.bi_tempo_primeiro_valor() is
  'Distribuição do tempo até a primeira ação, em sete faixas. ⚠️ ÓRFÃ: nenhum card da Entrada a desenha desde que o corte por origem (public.bi_entrada_primeira_acao_por_origem) a substituiu — a distribuição sozinha contava quanto e escondia o corte comprador x convidado, que é o que explica a inação. A regra ent_sem_primeira_acao lia esta função e passou a ler a do card em 20260818110000. Não repor em regra sem repor o card antes.';

-- As duas telas tiveram regra alterada; o cache guarda o achado serializado.
delete from insights.achado_cache where chave like 'visao-geral|%' or chave like 'entrada|%';
