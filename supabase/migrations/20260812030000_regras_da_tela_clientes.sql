-- Migration: /clientes — aposenta cli_gap_papel, entra cli_comprador e cli_mortalidade
-- e substitui insights.calcular_achados_clientes por inteiro.

-- cli_gap_papel sai do catálogo: media o mesmo fenômeno de cli_comprador pelo tipo de
-- contrato (proxy), ocupa a mesma família 'retencao' e, com limiar mais frouxo, impediria
-- a régua certa de aparecer. Decisão do Mateus.
delete from insights.regra where id = 'cli_gap_papel';

insert into insights.regra
  (id, tela, familia, titulo, pergunta, gabarito, gabarito_leitura, gabarito_acao,
   limiar_descricao, ancora_aba, ancora_id, ordem)
values
  ('cli_comprador', 'clientes', 'retencao',
   'O produto retém quem comprou, não quem ele trouxe',
   'Quem comprou e quem foi convidado por ele retêm igual?',
   'Quem comprou retém {taxa_comprador:pct}. Quem entrou pelo convite dele retém {taxa_convidado:pct} — {gap:pp} de diferença, medidos sobre clientes com {janela_elegibilidade:int}+ dias de casa que voltaram a agir nos últimos {janela_atividade:int} dias.',
   'O convidado é {fatia_convidado:pct} da base elegível e é quem menos volta. Ele não escolheu o produto: recebeu um acesso. Isto não é o papel do contrato — parte de quem foi convidado tem contrato de comprador, e parte de quem comprou tem contrato de membro. Também não é prova de que convidar piore a retenção: o convite passa o acesso adiante e não passa a intenção de quem decidiu comprar, e nada no produto repõe essa intenção depois.',
   'São {convidados_inativos:int} convidados elegíveis sem nenhuma ação recente — o maior bloco de perda que esta tela consegue nomear. A ativação de hoje é desenhada para quem comprou; o convidado precisa de um primeiro passo próprio. Os nomes estão em Clientes em risco — lista para ação, na aba Risco & churn.',
   'Vantagem do comprador de pelo menos dez pontos percentuais sobre o convidado, e maior que dois erros padrão da estimativa combinada.',
   'retencao', 'card-comprador', 1),
  ('cli_mortalidade', 'clientes', 'jornada',
   'O módulo de maior alcance é onde a jornada acaba',
   'De quem passou por cada módulo, que fatia teve ali a última ação?',
   'De quem passou por {modulo_topo}, {taxa_topo:pct} fizeram ali a última ação antes de sumir — {pararam_topo:int} de {usaram_topo:int}. Em {modulo_par}, que alcança um público de tamanho parecido, a mesma conta dá {taxa_par:pct}.',
   'Módulo de muito alcance sobe nessa conta sem ter culpa: quem para em qualquer lugar passou por ele antes. É para isso que serve o comparador — {modulo_par} tem público de tamanho parecido e, se fosse só alcance, teria taxa parecida. Não é que {modulo_topo} afaste alguém. É que quem termina a trilha de lá não encontra o passo seguinte.',
   'A alavanca não é tirar gente de {modulo_topo}: é dar destino a quem termina ali. {modulo_par} segura melhor quem chega, então é o passo seguinte mais barato de testar. As taxas dos demais módulos estão em Onde a jornada termina.',
   'Taxa de saída do módulo de maior alcance pelo menos uma vez e meia a do segundo maior, com o segundo tendo ao menos metade do alcance do primeiro, e os dois com seis meses ou mais de rastreamento.',
   'retencao', 'card-mortalidade', 6);

create or replace function insights.calcular_achados_clientes(
  p_dias integer default 30, p_papel text default null, p_plano text default null)
returns table(regra text, familia text, severidade text, titulo text, gabarito text,
  gabarito_leitura text, gabarito_acao text, parametros jsonb, score numeric,
  suprimida boolean, motivo text, ancora_aba text, ancora_id text)
language sql
stable
set search_path to ''
as $function$
  with
  -- Uma leitura por RPC: sem "as materialized" cada CTE citada uma vez seria inline e
  -- reavaliada dentro do cross join que monta as regras.
  eng as materialized (select * from public.bi_engajamento_clientes(p_dias, p_papel, p_plano)),
  amp as materialized (select * from public.bi_retencao_por_amplitude(p_papel, p_plano)),
  chu as materialized (select * from public.bi_churn_resumo(p_papel, p_plano)),
  aha as materialized (select * from public.bi_aha_moment(p_papel, p_plano)),
  cmp as materialized (select * from public.bi_retencao_comprador(p_papel, p_plano)),
  mor as materialized (select * from public.bi_mortalidade_modulo(p_papel, p_plano)),
  chm as materialized (select * from public.bi_churn_modulos(p_papel, p_plano)),
  -- ARMADILHA: 'Comprador' e 'Convidado' são os rótulos de exibição do card, devolvidos
  -- pela RPC. Se o rótulo mudar, os dois grupos viram null e a regra se suprime em
  -- silêncio pelo motivo errado ("sem os dois grupos acima do piso").
  cmp_par as (
    select
      (select c.pct_retidos from cmp c where c.grupo = 'Comprador') as taxa_comprador,
      (select c.clientes    from cmp c where c.grupo = 'Comprador') as n_comprador,
      (select c.pct_retidos from cmp c where c.grupo = 'Convidado') as taxa_convidado,
      (select c.clientes    from cmp c where c.grupo = 'Convidado') as n_convidado,
      (select count(*) from cmp c where c.pct_retidos is not null)  as grupos
  ),
  r_comprador as (
    select 'cli_comprador'::text as regra,
      case when c.grupos < 2 or c.taxa_comprador is null or c.taxa_convidado is null
             then 'sem os dois grupos acima do piso de amostra no recorte'
           when c.taxa_comprador - c.taxa_convidado < 0.10
             then 'vantagem do comprador abaixo do limiar de dez pontos'
           when c.taxa_comprador - c.taxa_convidado
                < 2 * sqrt(c.taxa_comprador * (1 - c.taxa_comprador) / nullif(c.n_comprador, 0)
                         + c.taxa_convidado * (1 - c.taxa_convidado) / nullif(c.n_convidado, 0))
             then 'diferença dentro da margem de erro da própria estimativa'
      end as motivo,
      jsonb_build_object(
        'taxa_comprador', c.taxa_comprador, 'taxa_convidado', c.taxa_convidado,
        'gap', round((c.taxa_comprador - c.taxa_convidado) * 100, 1),
        'fatia_convidado', round(c.n_convidado::numeric / nullif(c.n_comprador + c.n_convidado, 0), 4),
        -- Derivado, não lido de card: a taxa vem arredondada em quatro casas, então este
        -- número é uma ordem de grandeza do bloco de convidados parados, não uma contagem.
        'convidados_inativos', round(c.n_convidado * (1 - c.taxa_convidado)),
        -- Réguas de public.bi_retencao_comprador; mudar lá sem mudar aqui faz a frase mentir.
        'janela_elegibilidade', 120, 'janela_atividade', 30) as parametros,
      round((c.taxa_comprador - c.taxa_convidado) / 0.10, 2) as score
    from cmp_par c
  ),
  -- Join INNER de propósito: o piso de rastreamento vem de uma lista VALUES chumbada
  -- dentro de public.bi_churn_modulos. Módulo ausente dessa lista cai fora do conjunto
  -- elegível em vez de ser tratado como maduro — falha conservadora, mas silenciosa:
  -- módulo novo fica invisível para esta regra até alguém atualizar a lista.
  -- As duas RPCs também discordam sobre quem "usou Soluções"; daqui só sai medido_desde.
  mor_elegiveis as (
    select m.modulo, m.usaram, m.pararam_ali, m.taxa
    from mor m
    join chm c on c.modulo = m.modulo
    where m.taxa is not null
      and c.medido_desde <= public.bi_data_referencia() - 180
  ),
  mor_par as (
    select
      (select e.modulo      from mor_elegiveis e order by e.usaram desc, e.modulo limit 1) as modulo_topo,
      (select e.taxa        from mor_elegiveis e order by e.usaram desc, e.modulo limit 1) as taxa_topo,
      (select e.pararam_ali from mor_elegiveis e order by e.usaram desc, e.modulo limit 1) as pararam_topo,
      (select e.usaram      from mor_elegiveis e order by e.usaram desc, e.modulo limit 1) as usaram_topo,
      (select e.modulo      from mor_elegiveis e order by e.usaram desc, e.modulo offset 1 limit 1) as modulo_par,
      (select e.taxa        from mor_elegiveis e order by e.usaram desc, e.modulo offset 1 limit 1) as taxa_par,
      (select e.usaram      from mor_elegiveis e order by e.usaram desc, e.modulo offset 1 limit 1) as usaram_par,
      (select count(*) from mor_elegiveis) as modulos
  ),
  r_mortalidade as (
    select 'cli_mortalidade'::text as regra,
      case when m.modulos < 2
             then 'menos de dois módulos com amostra e rastreamento maduro no recorte'
           -- Comparar taxas de públicos de tamanhos diferentes é comparar alcance, que é
           -- justamente o que a regra precisa neutralizar.
           when m.usaram_par < 0.5 * m.usaram_topo
             then 'o segundo módulo alcança menos da metade do público do primeiro'
           when m.taxa_par = 0
             then 'o módulo de comparação não registrou nenhuma saída'
           when m.taxa_topo / nullif(m.taxa_par, 0) < 1.5
             then 'saída distribuída de forma parecida entre os dois módulos de maior alcance'
      end as motivo,
      jsonb_build_object(
        'modulo_topo', m.modulo_topo, 'taxa_topo', m.taxa_topo,
        'pararam_topo', m.pararam_topo, 'usaram_topo', m.usaram_topo,
        'modulo_par', m.modulo_par, 'taxa_par', m.taxa_par) as parametros,
      -- coalesce em vez de score nulo: sem par a regra já está suprimida, e score nulo
      -- flutuaria para o topo da ordenação decrescente.
      round(coalesce(m.taxa_topo / nullif(m.taxa_par, 0), 0) / 1.5, 2) as score
    from mor_par m
  ),
  amp_ok as (select * from amp where pct_retidos is not null),
  amp_par as (
    select
      (select a.modulos from amp_ok a order by a.pct_retidos desc limit 1) as modulos_maior,
      (select a.pct_retidos from amp_ok a order by a.pct_retidos desc limit 1) as taxa_maior,
      (select a.clientes from amp_ok a order by a.pct_retidos desc limit 1) as n_maior,
      (select a.modulos from amp_ok a order by a.pct_retidos asc limit 1) as modulos_menor,
      (select a.pct_retidos from amp_ok a order by a.pct_retidos asc limit 1) as taxa_menor,
      (select a.clientes from amp_ok a order by a.pct_retidos asc limit 1) as n_menor,
      (select count(*) from amp_ok) as faixas
  ),
  r_amplitude as (
    select 'cli_amplitude'::text as regra,
      case when a.faixas < 2 then 'sem duas faixas de amplitude com amostra suficiente'
           when a.taxa_maior - a.taxa_menor < 0.10 then 'gradiente abaixo do limiar de dez pontos'
           when a.taxa_maior - a.taxa_menor
                < 2 * sqrt(a.taxa_maior * (1 - a.taxa_maior) / nullif(a.n_maior, 0)
                         + a.taxa_menor * (1 - a.taxa_menor) / nullif(a.n_menor, 0))
             then 'gradiente dentro da margem de erro'
      end as motivo,
      jsonb_build_object(
        'modulos_maior', a.modulos_maior, 'modulos_menor', a.modulos_menor,
        'taxa_maior', a.taxa_maior, 'taxa_menor', a.taxa_menor,
        'gap', round((a.taxa_maior - a.taxa_menor) * 100, 1),
        'janela_amplitude', 30) as parametros,
      round((a.taxa_maior - a.taxa_menor) / 0.10, 2) as score
    from amp_par a
  ),
  r_churn as (
    select 'cli_churn_precoce'::text as regra,
      case when c.vida_media_dias is null then 'vida média suprimida: menos de trinta clientes em churn no recorte'
           when c.vida_media_dias >= 30 then 'vida média acima de um ciclo mensal'
      end as motivo,
      jsonb_build_object('churned', c.churned, 'vida', c.vida_media_dias, 'janela_churn', 60) as parametros,
      round(30 / nullif(c.vida_media_dias, 0), 2) as score
    from chu c
  ),
  r_frequencia as (
    select 'cli_frequencia'::text as regra,
      case when e.pct_mais_de_um_dia is null then 'fatia suprimida: amostra do recorte abaixo do piso'
           when 1 - e.pct_mais_de_um_dia < 0.333 then 'concentração em um dia abaixo do limiar de um terço'
      end as motivo,
      jsonb_build_object(
        'pct_um_dia', round(1 - coalesce(e.pct_mais_de_um_dia, 0), 4), 'mau', e.mau) as parametros,
      round((1 - coalesce(e.pct_mais_de_um_dia, 0)) / 0.333, 2) as score
    from eng e
  ),
  aha_top as (select * from aha where lift is not null order by lift desc limit 1),
  r_aha as (
    select 'cli_aha'::text as regra,
      case when not exists (select 1 from aha_top) then 'nenhuma ação com os dois lados da comparação acima do piso'
           when (select a.lift from aha_top a) < 1.5 then 'lift abaixo do limiar de um e meio'
      end as motivo,
      jsonb_build_object(
        'acao_nome', (select a.acao from aha_top a),
        'lift', (select a.lift from aha_top a),
        'fizeram', (select a.fizeram from aha_top a),
        'janela_aha', 7) as parametros,
      round(coalesce((select a.lift from aha_top a), 0) / 1.5, 2) as score
  ),
  todas as (
    select * from r_comprador
    union all select * from r_amplitude
    union all select * from r_churn
    union all select * from r_frequencia
    union all select * from r_aha
    union all select * from r_mortalidade
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

-- O cache guarda payload por (tela, recorte, data de referencia). Regras novas nao mudam
-- a chave, entao sem purga a tela continuaria servindo o conjunto antigo.
delete from insights.achado_cache where chave like 'clientes|%';
