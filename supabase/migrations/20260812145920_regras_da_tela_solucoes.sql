-- Motor de achados: /solucoes
--
-- Duas regras. As outras duas propostas ficaram de fora: `sol_aba_pulada` depende
-- de uma coluna de frescor que `bi_solucoes_conclusao_por_aba` ainda não devolve, e
-- `sol_catalogo_sem_morto` tem score que cresce quando o catálogo melhora — sairia
-- como "atenção" dizendo que está tudo bem. Nenhuma das duas entra remendada.

insert into insights.regra
  (id, tela, familia, titulo, pergunta, gabarito, gabarito_leitura, gabarito_acao,
   limiar_descricao, ancora_aba, ancora_id, ordem)
values
  ('sol_conclusao_apos_inicio', 'solucoes', 'conversao',
   'A perda acontece depois do início, não na descoberta',
   'Onde o funil da tela de Soluções perde gente: na descoberta ou depois de começar?',
   'De quem abre o catálogo, {pct_inicia:pct} iniciam alguma solução e {pct_conclui:pct} chegam a concluir alguma. Concluíram {concluiu:int} clientes contra {iniciou:int} que começaram — {taxa_fim:pct}.',
   'O funil conta gente distinta em cada degrau da mesma janela, não a mesma pessoa descendo os quatro. Quem concluiu pode ter começado antes da janela, então este número é generoso: seguindo a mesma safra, seria pior. O degrau da descoberta se sustenta; o do fim, não. E o que existe entre os dois é invisível aqui — início e conclusão vêm do registro de progresso, o caminho entre eles não é medido em lugar nenhum desta tela.',
   'Curadoria e descoberta mexem no degrau que já funciona: o trabalho está depois do início. E antes de levantar hipótese sobre a queda, conferir se ainda dá para enxergar o meio do caminho — Conclusão por aba da implementação é a única medida do que acontece dentro de uma solução.',
   'Conclusões equivalentes a menos de um quinto dos inícios, com pelo menos trinta clientes tendo iniciado na janela, janela de pelo menos um mês, e mais de um terço de quem abre o catálogo chegando a iniciar.',
   'implementacao', 'card-funil-tela', 1),

  ('sol_atencao_por_categoria', 'solucoes', 'catalogo',
   'A atenção não segue o tamanho do catálogo',
   'Onde a próxima solução publicada renderia mais atenção?',
   '{cat_topo} tem {solucoes_topo:int} soluções publicadas, {parte_catalogo:pct} do catálogo, e leva {parte_pageviews:pct} dos pageviews de página de solução — {indice:mult} a atenção que o tamanho dela faria esperar.',
   'A comparação é justa: a janela de pageview é a mesma para todas as categorias e nenhuma solução é mais nova que ela, então ninguém está na frente por ter chegado antes. O que ela não diz é por quê. Uma categoria pode atrair porque resolve dor cara, porque o título é claro ou porque aparece mais acima na lista — demanda e posição não se separam aqui. Sobra o fato estreito: a fatia do catálogo e a fatia da atenção não batem.',
   'É argumento de pauta, não de corte: a próxima solução rende mais nessa categoria do que na maior do catálogo. Antes de decidir, buscar a categoria em Ranking de soluções — é o que separa categoria forte inteira de categoria puxada por um acerto isolado.',
   'Uma categoria recebendo pelo menos uma vez e meia a atenção que a fatia dela do catálogo faria esperar, com pelo menos cinco soluções publicadas e pelo menos trinta pageviews, e com o ranking devolvido inteiro.',
   'catalogo', 'card-ranking-solucoes', 2);

create or replace function insights.calcular_achados_solucoes(
  p_dias integer default 30,
  p_papel text default null,
  p_plano text default null
)
returns table (
  regra text, familia text, severidade text, titulo text,
  gabarito text, gabarito_leitura text, gabarito_acao text,
  parametros jsonb, score numeric, suprimida boolean, motivo text,
  ancora_aba text, ancora_id text
)
language sql
stable
set search_path to ''
as $$
  -- p_papel e p_plano chegam por contrato do motor e são ignorados de propósito:
  -- /solucoes não tem filtro de segmento e nenhuma RPC desta tela aceita recorte.
  -- Fossem aceitos aqui, a frase responderia a um filtro que o card não aplica.
  with
  cv as materialized (select * from public.bi_solucoes_conversao_tela(p_dias)),
  -- O limite tem que ser o MESMO que a página passa (src/features/solucoes/queries.ts).
  -- Se divergirem, o motor calcula a fatia sobre uma lista diferente da que o card
  -- desenha — e a frase deixa de ser conferível no gráfico ao lado, em silêncio.
  rk as materialized (select * from public.bi_solucoes_ranking(200)),

  -- As etapas são identificadas pela posição no funil, não pelo rótulo de exibição:
  -- o rótulo é copy de UI e muda sem aviso. A troca tem preço próprio — se alguém
  -- inserir um degrau no meio do funil, ordem três e quatro passam a medir outra
  -- coisa sem quebrar nada. Vale reconferir aqui quando o funil ganhar etapa.
  fn as (
    select
      (select c.usuarios from cv c where c.ordem = 3) as iniciou,
      (select c.usuarios from cv c where c.ordem = 4) as concluiu,
      (select c.pct from cv c where c.ordem = 3) as pct_inicia,
      (select c.pct from cv c where c.ordem = 4) as pct_conclui
  ),
  r_conversao as (
    select 'sol_conclusao_apos_inicio'::text as regra,
      case when f.iniciou is null or f.concluiu is null
             then 'funil da tela sem as etapas de início e de conclusão no recorte'
           when f.iniciou < 30
             then 'menos de trinta clientes iniciaram alguma solução na janela'
           -- Concluir uma solução leva tempo: em janela curta a conta mede o
           -- calendário, não o produto.
           when p_dias < 30
             then 'janela mais curta que um mês'
           -- Se o topo do funil também perde, a leitura de que o problema está
           -- depois do início deixa de valer, mesmo com a razão do fim baixa.
           when f.pct_inicia < 0.333
             then 'menos de um terço de quem abre o catálogo chega a iniciar'
           when f.concluiu::numeric / f.iniciou >= 0.20
             then 'conclusões acima de um quinto dos inícios'
      end as motivo,
      jsonb_build_object(
        'pct_inicia', f.pct_inicia, 'pct_conclui', f.pct_conclui,
        'taxa_fim', round(f.concluiu::numeric / nullif(f.iniciou, 0), 4),
        'concluiu', f.concluiu, 'iniciou', f.iniciou) as parametros,
      -- Sem correção de continuidade no numerador: com ela o score de uma regra
      -- parada em cima do próprio limiar marcaria abaixo de um, e o catálogo
      -- inteiro combina que o limiar vale exatamente um. O caso de ninguém
      -- concluir vira teto fixo em vez de nulo — é o pior estado possível da
      -- regra, e nulo ordenaria por último.
      round(case when f.concluiu = 0 then 99
                 else 0.20 / (f.concluiu::numeric / nullif(f.iniciou, 0)) end, 2) as score
    from fn f
  ),

  -- Materializada porque o cross join abaixo a reavaliaria uma vez por categoria.
  tot as materialized (
    select count(*) as solucoes, sum(r.pageviews) as pageviews from rk r
  ),
  cat as (
    select r.categoria, count(*) as solucoes, sum(r.pageviews) as pageviews
    from rk r
    group by r.categoria
  ),
  lider as (
    select c.categoria, c.solucoes,
      round(c.solucoes::numeric / nullif(t.solucoes, 0), 4) as parte_catalogo,
      round(c.pageviews::numeric / nullif(t.pageviews, 0), 4) as parte_pageviews,
      -- Índice sobre as frações cheias, não sobre as duas fatias já arredondadas:
      -- em categoria pequena o arredondamento do denominador desloca o resultado
      -- o bastante para cruzar o limiar.
      round((c.pageviews::numeric / nullif(t.pageviews, 0))
            / nullif(c.solucoes::numeric / nullif(t.solucoes, 0), 0), 3) as indice
    from cat c cross join tot t
    -- Piso duplo: abaixo dele o índice é ruído de uma solução isolada com um mês bom.
    where c.solucoes >= 5 and c.pageviews >= 30
    order by indice desc
    limit 1
  ),
  r_atencao as (
    select 'sol_atencao_por_categoria'::text as regra,
      case when (select count(*) from rk) >= 200
             then 'ranking devolvido no limite da consulta: a lista pode estar cortada'
           when coalesce((select t.pageviews from tot t), 0) = 0
             then 'sem pageview de página de solução na base'
           when not exists (select 1 from lider)
             then 'nenhuma categoria com catálogo e visitas suficientes'
           when (select l.indice from lider l) < 1.5
             then 'a atenção acompanha a distribuição do catálogo'
      end as motivo,
      jsonb_build_object(
        'cat_topo', (select l.categoria from lider l),
        'solucoes_topo', (select l.solucoes from lider l),
        'parte_catalogo', (select l.parte_catalogo from lider l),
        'parte_pageviews', (select l.parte_pageviews from lider l),
        'indice', (select l.indice from lider l)) as parametros,
      round((select l.indice from lider l) / 1.5, 2) as score
  ),

  todas as (
    select * from r_conversao
    union all select * from r_atencao
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
$$;

grant execute on function insights.calcular_achados_solucoes(integer, text, text) to authenticated;

comment on function insights.calcular_achados_solucoes(integer, text, text) is
  'Achados de /solucoes. Lê só funções public.bi_* — os mesmos números que os cards desenham. A conversão da tela ainda ancora em now() na origem, então os absolutos subcontam enquanto o pipeline estiver atrasado; a regra é razão entre degraus que truncam juntos, e a razão sobrevive.';

delete from insights.achado_cache where chave like 'solucoes|%';
