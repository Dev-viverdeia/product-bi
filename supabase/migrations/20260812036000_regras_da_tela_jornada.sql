-- Motor de achados — /jornada.
-- As seis RPCs desta tela ancoram a janela em now(), não em public.bi_data_referencia():
-- é dívida declarada no CLAUDE.md. Nenhuma das quatro regras compara períodos, então
-- pipeline atrasado encurta a janela sem inverter o sinal de nenhuma delas — por isso
-- o calculador não precisa da data de referência e não a lê.
--
-- ATENÇÃO ao aplicar: nenhum card de /jornada tem id no front hoje. Enquanto card-raio-x,
-- card-portas-entrada e card-pontos-saida não existirem no JSX, o link "Ver o gráfico que
-- sustenta" troca de aba e não rola para lugar nenhum — falha silenciosa, sem erro.
-- E o card de pontos de saída desenha só a contagem absoluta: a taxa que
-- jor_saida_sem_proximo_passo publica vem da mesma RPC mas não está no gráfico.

insert into insights.regra
  (id, tela, familia, titulo, pergunta, gabarito, gabarito_leitura, gabarito_acao,
   limiar_descricao, ancora_aba, ancora_id, ordem)
values
  (
    'jor_posicao_inflada',
    'jornada',
    'medicao',
    'O ranking de pageview está inflado por sessões-monstro',
    'A tela mais vista do raio-x é vista por muita gente ou registrada muitas vezes?',
    '{tela_lider} lidera o raio-x com {pageviews:int} pageviews e aparece, em média, na posição {posicao_media:dec} da sessão — e a sessão média da plataforma inteira tem {telas_media:dec} telas.',
    'Uma tela só chega tão longe na sessão se um punhado de sessões enormes estiver carregando a conta: a posição média dela passa de {limiar_posicao:mult} o tamanho da sessão típica, e navegação humana não tem esse comprimento. Que a tela é muito vista não está em dúvida. O que está é a coluna, que soma leitura de gente com registro repetido dentro de poucas sessões. O segundo sinal aponta igual: {por_usuario:dec} pageviews por usuário aqui, contra {mediana_por_usuario:dec} na tela do meio da fila entre as que passam de {piso_usuarios:int} usuários.',
    'Ordenar o raio-x por usuários antes de decidir qualquer redesenho — é a coluna que não infla com repetição. E levar a posição média para quem cuida da instrumentação: sessão de centenas de telas é aba esquecida aberta ou robô, não hábito de uso, e ela contamina de uma vez o ranking, as telas por sessão e a duração mediana.',
    'Posição média da tela líder de pageview em pelo menos o triplo do número médio de telas por sessão, com a mediana de comparação apurada só entre telas que passam de cem usuários.',
    'telas',
    'card-raio-x',
    1
  ),
  (
    'jor_espelho_sessao',
    'jornada',
    'sessao',
    'A mesma tela abre e encerra a sessão',
    'A tela que mais abre sessão é mesmo uma porta de entrada?',
    '{tela} é a tela mais vista do produto, a que mais abre sessão e a que mais encerra sessão. Ela abre {sessoes_abertas:int} sessões, {pct_entrada:pct} do total, e encerra outras {saidas:int}.',
    'Duas explicações cabem no mesmo número e pedem ações opostas. Uma é intenção: as pessoas chegam de fora direto no conteúdo e desistem nele. A outra é a régua: sessão aqui é navegação com intervalo menor que {intervalo_sessao:int} minutos por usuário, e conteúdo longo atravessa esse intervalo sem clique nenhum — a sessão anterior morre na tela e a seguinte nasce na mesma tela. Porta de entrada de verdade costuma ser rasa, e esta é a tela mais funda do raio-x, o que pesa para a segunda explicação.',
    'Não tratar essa tela como porta nem como ponto de abandono antes de separar as duas leituras: comparar o fim de uma sessão com o início da seguinte, do mesmo cliente, resolve em uma consulta. Enquanto isso, ler Portas de entrada a partir da segunda linha — {porta_seguinte}, com {pct_seguinte:pct} das sessões.',
    'A mesma tela liderando pageview, abertura de sessão e encerramento de sessão ao mesmo tempo, abrindo pelo menos uma em cada dez sessões do período e com pelo menos uma vez e meia a fatia da segunda porta de entrada.',
    'fluxos',
    'card-portas-entrada',
    2
  ),
  (
    'jor_saida_sem_proximo_passo',
    'jornada',
    'saida',
    'Uma tela encerra a sessão com o dobro da frequência das vizinhas',
    'Existe uma tela onde a sessão termina fora do padrão do resto do produto?',
    '{tela} encerra {taxa:pct} das visitas que recebe, contando só sessões de duas telas ou mais — {razao_mediana:mult} a taxa da tela do meio da lista. São {saidas:int} sessões terminadas ali no período.',
    'Terminar numa tela não é falha: quem fez o que veio fazer sai, e sair depois de resolver é um bom fim. O que muda a leitura é o que existe depois. A partir dela, nenhum destino seguinte passa de {maior_destino:pct} — não existe um caminho que o produto proponha, existe um leque em que nada se destaca. Sessão de tela única fica fora desta conta, então o número descreve quem estava navegando e parou, não quem só passou.',
    'Selecionar {tela} em Para onde vão a partir de uma tela e conferir se o próximo passo existe. Quando nenhum destino se destaca, o que falta é encadeamento e não conteúdo: a correção é oferecer a próxima ação dentro da própria tela, não reescrever a tela.',
    'Taxa de encerramento em pelo menos o dobro da mediana das telas que o card mostra, e em pelo menos um quarto das visitas que a própria tela recebe.',
    'fluxos',
    'card-pontos-saida',
    3
  ),
  (
    'jor_alcance_vs_volume',
    'jornada',
    'medicao',
    'A tela mais vista não é a que alcança mais gente',
    'O topo do raio-x é onde está a maior parte dos clientes?',
    '{tela_volume} lidera o raio-x em pageviews, mas quem alcança mais gente é {tela_alcance}: {usuarios_alcance:int} clientes distintos contra {usuarios_volume:int} — {razao_alcance:mult} mais gente.',
    'Pageview conta repetição; usuário distinto conta pessoa. A tabela ordena por pageview, então o topo dela mostra onde há mais registro, não onde há mais gente. As duas perguntas são legítimas e têm donos diferentes: quem cuida de conteúdo quer consumo, quem precisa que um aviso chegue quer alcance. Hoje a tela responde só a primeira, e não avisa.',
    'Para qualquer decisão que dependa de quantas pessoas veem a tela — aviso, mudança de navegação, migração de rota — usar a coluna de usuários em Raio-x das telas. No período, {tela_alcance} é a tela que mais gente distinta abre.',
    'A tela com mais usuários distintos sendo diferente da tela com mais pageviews, e tendo pelo menos um quarto a mais de usuários que ela.',
    'telas',
    'card-raio-x',
    4
  )
on conflict (id) do update set
  tela = excluded.tela,
  familia = excluded.familia,
  titulo = excluded.titulo,
  pergunta = excluded.pergunta,
  gabarito = excluded.gabarito,
  gabarito_leitura = excluded.gabarito_leitura,
  gabarito_acao = excluded.gabarito_acao,
  limiar_descricao = excluded.limiar_descricao,
  ancora_aba = excluded.ancora_aba,
  ancora_id = excluded.ancora_id,
  ordem = excluded.ordem;

create or replace function insights.calcular_achados_jornada(
  p_dias integer default 30,
  p_papel text default null,
  p_plano text default null
)
returns table(
  regra text, familia text, severidade text, titulo text,
  gabarito text, gabarito_leitura text, gabarito_acao text,
  parametros jsonb, score numeric, suprimida boolean, motivo text,
  ancora_aba text, ancora_id text
)
language sql
stable
set search_path to ''
as $function$
  -- p_papel e p_plano não filtram nada aqui: nenhuma das RPCs de /jornada aceita esses
  -- recortes, e a tela também não os oferece. A assinatura os mantém para o invólucro
  -- público sair do mesmo template das outras telas.
  with
  -- O teto de cinco mil é o LIMITE_LISTA do front (src/lib/rpc.ts): a regra tem de ler
  -- exatamente a mesma lista que o card mostra, ou publica número que a tela não tem.
  rx as materialized (select * from public.bi_raio_x_telas(p_dias, 5000)),
  kpi as materialized (select * from public.bi_jornada_kpis(p_dias)),
  ent as materialized (select * from public.bi_portas_entrada(p_dias, 10)),
  sai as materialized (select * from public.bi_pontos_saida(p_dias, 10)),
  -- Recortes de uma linha: materializados porque cada um é lido por várias subconsultas
  -- escalares abaixo e, sem isso, o ordenamento do raio-x inteiro seria refeito a cada leitura.
  rx_volume as materialized (select x.* from rx x order by x.pageviews desc limit 1),
  rx_alcance as materialized (select x.* from rx x order by x.usuarios desc limit 1),
  -- O piso de cem usuários repete o parâmetro piso_usuarios emitido na frase: mudar um
  -- exige mudar o outro, ou a leitura passa a descrever uma mediana que não foi calculada.
  rx_mediana as materialized (
    select (percentile_cont(0.5) within group (order by x.pageviews::numeric / nullif(x.usuarios, 0)))::numeric as pv_por_usuario,
           count(*) as telas
    from rx x
    where x.usuarios >= 100
  ),
  ent_1 as materialized (select e.* from ent e order by e.sessoes desc limit 1),
  ent_2 as materialized (select e.* from ent e order by e.sessoes desc offset 1 limit 1),
  -- Duas líderes diferentes do mesmo card: sai_1 é a de encerramentos absolutos (é dela
  -- que a coincidência tripla fala), sai_topo é a de maior taxa (é dela que a regra de
  -- saída fala). Trocar uma pela outra troca a tela citada na frase.
  sai_1 as materialized (select s.* from sai s order by s.saidas desc limit 1),
  sai_topo as materialized (select s.* from sai s order by s.pct_da_tela desc limit 1),
  sai_mediana as materialized (
    select (percentile_cont(0.5) within group (order by s.pct_da_tela))::numeric as pct_mediana
    from sai s
  ),
  -- Única chamada de RPC que depende de linha calculada antes: sem materializar, o lateral
  -- seria reavaliado a cada referência, e esta é a leitura mais cara das quatro regras.
  fluxo as materialized (
    select f.* from sai_topo t cross join lateral public.bi_fluxo_da_tela(t.tela, p_dias) f
  ),
  -- ARMADILHA: '(fim da sessão)' é rótulo de exibição montado dentro de bi_fluxo_da_tela.
  -- Se alguém reescrever esse texto, o encerramento entra como se fosse destino e a frase
  -- passa a citar um "próximo passo" que não existe — sem erro nenhum.
  -- A RPC devolve só os dez destinos mais frequentes; como ela ordena por volume, o maior
  -- destino que não é o fim está sempre dentro do corte.
  fluxo_max as materialized (
    select max(f.pct) as maior_destino from fluxo f where f.destino <> '(fim da sessão)'
  ),

  r_posicao_inflada as (
    select 'jor_posicao_inflada'::text as regra,
      case
        when (select count(*) from rx) = 0
          then 'raio-x sem nenhuma tela no período'
        when (select k.telas_por_sessao from kpi k) is null or (select k.telas_por_sessao from kpi k) = 0
          then 'telas por sessão indisponível no período: sem base de comparação para a posição'
        when (select count(*) from rx) >= 5000
          then 'raio-x cortado no teto da lista: a mediana não cobre a tabela inteira'
        when (select m.telas from rx_mediana m) < 5
          then 'menos de cinco telas com cem usuários: sem mediana sustentada para comparar'
        when (select l.posicao_media from rx_volume l) < 3 * (select k.telas_por_sessao from kpi k)
          then 'a tela líder do raio-x aparece dentro do comprimento típico da sessão'
      end as motivo,
      jsonb_build_object(
        'tela_lider', (select l.tela from rx_volume l),
        'pageviews', (select l.pageviews from rx_volume l),
        'posicao_media', (select l.posicao_media from rx_volume l),
        'telas_media', (select k.telas_por_sessao from kpi k),
        'por_usuario', round((select l.pageviews from rx_volume l)::numeric / nullif((select l.usuarios from rx_volume l), 0), 1),
        'mediana_por_usuario', round((select m.pv_por_usuario from rx_mediana m), 1),
        'limiar_posicao', 3,
        'piso_usuarios', 100
      ) as parametros,
      round(((select l.posicao_media from rx_volume l) / nullif((select k.telas_por_sessao from kpi k), 0)) / 3, 2) as score
  ),

  r_espelho_sessao as (
    -- B3: o score não pode ser pct_entrada/limiar. A coincidência tripla é booleana e já
    -- vive nas supressões; o que sobra de contínuo — e o que enfraquece quando a coincidência
    -- deixa de ser achado — é a distância entre a líder e a segunda porta. Com a líder colada
    -- na segunda, os três primeiros lugares viram desempate e a frase perde o pé. Por isso o
    -- score mede essa distância, e é ela que também vira supressão.
    select 'jor_espelho_sessao'::text as regra,
      case
        when (select count(*) from ent) < 2
          then 'menos de duas portas de entrada no período: sem segunda porta para oferecer'
        when (select count(*) from sai) = 0
          then 'nenhuma tela com volume suficiente para entrar no card de saída'
        when (select e.tela from ent_1 e) is distinct from (select s.tela from sai_1 s)
          then 'a tela que mais abre sessão não é a que mais encerra'
        when (select e.tela from ent_1 e) is distinct from (select l.tela from rx_volume l)
          then 'a tela que mais abre sessão não é a mais vista do raio-x'
        when (select e.pct from ent_1 e) < 0.10
          then 'a porta líder abre menos de uma em cada dez sessões'
        when (select e.pct from ent_1 e) < 1.5 * (select e.pct from ent_2 e)
          then 'a porta líder não chega a uma vez e meia a fatia da segunda porta'
      end as motivo,
      jsonb_build_object(
        'tela', (select e.tela from ent_1 e),
        'sessoes_abertas', (select e.sessoes from ent_1 e),
        'pct_entrada', (select e.pct from ent_1 e),
        'saidas', (select s.saidas from sai_1 s),
        'porta_seguinte', (select e.tela from ent_2 e),
        'pct_seguinte', (select e.pct from ent_2 e),
        -- Trinta minutos é o interval da sessionização em etl.sync_fact_navegacao. Se aquele
        -- corte mudar, esta frase passa a explicar a leitura com a régua errada.
        'intervalo_sessao', 30
      ) as parametros,
      round(((select e.pct from ent_1 e) / nullif((select e.pct from ent_2 e), 0)) / 1.5, 2) as score
  ),

  r_saida_sem_proximo_passo as (
    select 'jor_saida_sem_proximo_passo'::text as regra,
      case
        when (select count(*) from sai) < 5
          then 'menos de cinco telas com volume para entrar no card de saída: sem mediana sustentada'
        when (select f.maior_destino from fluxo_max f) is null
          then 'sem transição registrada a partir da tela líder de encerramento'
        when (select t.pct_da_tela from sai_topo t) < 0.25
          then 'a tela líder encerra menos de um quarto das visitas que recebe'
        when (select t.pct_da_tela from sai_topo t) < 2 * (select m.pct_mediana from sai_mediana m)
          then 'a taxa da líder não chega ao dobro da mediana das telas do card'
      end as motivo,
      jsonb_build_object(
        'tela', (select t.tela from sai_topo t),
        'taxa', (select t.pct_da_tela from sai_topo t),
        'saidas', (select t.saidas from sai_topo t),
        -- B2: o parâmetro não pode se chamar "mult" — colide com o nome do formato e
        -- convida a escrever {mult:mult}, que passa no regex e some no primeiro refactor.
        'razao_mediana', round((select t.pct_da_tela from sai_topo t) / nullif((select m.pct_mediana from sai_mediana m), 0), 2),
        'maior_destino', (select f.maior_destino from fluxo_max f)
      ) as parametros,
      round(((select t.pct_da_tela from sai_topo t) / nullif((select m.pct_mediana from sai_mediana m), 0)) / 2, 2) as score
  ),

  r_alcance_vs_volume as (
    -- Reserva de r_posicao_inflada na mesma família: quando a primeira se suprime — é o que
    -- acontece no recorte curto — esta assume a crítica à ordenação do raio-x. As duas juntas
    -- na tela seriam a mesma frase duas vezes, e é a família que impede isso.
    select 'jor_alcance_vs_volume'::text as regra,
      case
        when (select count(*) from rx) = 0
          then 'raio-x sem nenhuma tela no período'
        when (select count(*) from rx) >= 5000
          then 'raio-x cortado no teto da lista: a líder de alcance pode estar fora da tabela'
        when (select v.tela from rx_volume v) = (select a.tela from rx_alcance a)
          then 'a tela mais vista é também a que alcança mais gente'
        when (select a.usuarios from rx_alcance a) < 1.25 * (select v.usuarios from rx_volume v)
          then 'a diferença de alcance entre as duas fica abaixo de um quarto'
      end as motivo,
      jsonb_build_object(
        'tela_volume', (select v.tela from rx_volume v),
        'usuarios_volume', (select v.usuarios from rx_volume v),
        'tela_alcance', (select a.tela from rx_alcance a),
        'usuarios_alcance', (select a.usuarios from rx_alcance a),
        'razao_alcance', round((select a.usuarios from rx_alcance a)::numeric / nullif((select v.usuarios from rx_volume v), 0), 2)
      ) as parametros,
      round((select a.usuarios from rx_alcance a)::numeric / nullif((select v.usuarios from rx_volume v), 0) / 1.25, 2) as score
  ),

  todas as (
    select * from r_posicao_inflada
    union all select * from r_espelho_sessao
    union all select * from r_saida_sem_proximo_passo
    union all select * from r_alcance_vs_volume
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

grant execute on function insights.calcular_achados_jornada(integer, text, text) to authenticated;
delete from insights.achado_cache where chave like 'jornada|%';
