-- Fase 3 — /formacoes sobe a escada.
--
-- Quatro regras. Três delas leem RPCs sem parâmetro de período
-- (bi_duracao_ideal, bi_dropoff_posicao, bi_jornada_cursos) e a quarta compara
-- números históricos: o achado desta tela é estrutural, fala do catálogo e não
-- da janela. Trocar o filtro de 7 para 90 dias muda um único número em quatro
-- achados — alunos_lider. É o mesmo comportamento dos cards, então o motor não
-- mente mais que a tela, mas quem espera a leitura reagir ao filtro vai
-- estranhar.
--
-- Nenhuma regra lê NPS, de propósito: a última resposta em fact_nps_aula é de
-- 29/07 e o instrumento parou. Enquanto a aba não migrar para estrelas, não há
-- régua de qualidade percebida que se sustente aqui.

insert into insights.regra
  (id, tela, familia, titulo, pergunta,
   gabarito, gabarito_leitura, gabarito_acao, limiar_descricao,
   ancora_aba, ancora_id, ordem)
values
  ('for_lider_conclusao', 'formacoes', 'portfolio',
   'A formação mais procurada é a que menos termina',
   'A formação que mais atrai aluno é também a que mais entrega certificado?',
   '{curso_lider} é a formação que mais atraiu aluno no período — {alunos_lider:int} — e a que menos entrega certificado: {cert_lider:int} de {hist_lider:int} alunos que abriram ao menos uma aula, {conclusao_lider:pct}. Entre as formações de porte parecido, a do meio da fila fecha {mediana_pares:pct}, {defasagem:pp} acima.',
   'A grade dela é a maior do grupo, e grade maior tem mais lugar onde parar — parte da distância é isso. Outra parte é tempo: quem ainda está no meio do curso entra na conta como não concluído, e esta é a formação que mais recebeu aluno novo no período. Descontadas as duas, sobra o funil mais largo e mais furado do catálogo: {pares:int} formações de porte parecido entraram na comparação e nenhuma fecha menos.',
   'É onde cada ponto de conclusão rende mais, porque é onde está a maior audiência. A comparação linha a linha está em Uso por formação. Separar quem parou de quem ainda está andando exige um corte por safra que esta tela não tem — enquanto ele não existir, tratar a taxa como piso, não como abandono medido.',
   'A formação com mais alunos no período concluindo ao menos quinze pontos percentuais abaixo da mediana das demais formações com duzentos alunos ou mais na história, e pelo menos cinco formações nessa comparação.',
   'uso', 'card-uso-formacoes', 1),

  ('for_duracao', 'formacoes', 'formato',
   'Aula curta conclui mais',
   'A duração da aula muda a chance de o aluno concluí-la?',
   'Na faixa {faixa_curta}, a aula conclui {taxa_curta:pct}. Na faixa {faixa_longa}, {taxa_longa:pct} — {queda:pp} a menos. Entre uma ponta e outra a taxa só cai: nenhuma faixa mais longa conclui mais que uma mais curta.',
   'A queda é contínua: cada degrau custa alguns pontos e não existe um precipício onde cortar. O último degrau é o mais frágil, apoiado em {aulas_longa:int} aulas contra {aulas_curta:int} da faixa mais curta. Acima de {faixa_longa} o catálogo não tem aula suficiente para afirmar nada — faixa com menos de {min_aulas:int} aulas não vira média. E nada disso prova que o relógio é a causa: aula longa costuma ser aula densa, e quem para pode estar reagindo ao assunto.',
   'Para grade nova, a régua é {faixa_curta}. No catálogo que já existe, o teste barato é partir uma aula longa em duas e comparar a conclusão das metades com a da aula original. A curva por faixa está em Duração de aula que maximiza conclusão.',
   'Queda de pelo menos dez pontos percentuais entre a faixa mais curta e a faixa mais longa que tem média, sem que a taxa suba em nenhum degrau intermediário da escala.',
   'conclusao', 'card-duracao', 2),

  ('for_jornada_sessao', 'formacoes', 'percurso',
   'Formação é sessão, não percurso',
   'Quanto tempo o aluno leva da primeira aula até o certificado?',
   'Em {sob_um_dia:int} das {cursos:int} formações com {min_certificados:int} certificados ou mais, o aluno típico vai da primeira aula ao certificado em menos de {limiar_dias:int} dia — {parte:pct} do catálogo medido.',
   'Parte disso é a grade: formação de poucas aulas termina numa sessão porque não dá para terminar de outro jeito, e esta tela não separa grade curta de grade longa. O que o número muda é a expectativa: o certificado marca uma sessão, não um percurso. Programa de retenção que conta com o aluno ocupado por semanas está contando com algo que só {acima_semana:int} formações entregam — as que levam {limiar_longo:int} dias ou mais.',
   'Se o objetivo é ocupar o cliente ao longo do ciclo, a alavanca é a sequência entre formações, não a duração de cada uma — hoje o produto entrega uma sessão e não um percurso. As formações que seguram por mais tempo estão no topo de Tempo até o certificado.',
   'Ao menos dois terços das formações da lista fechando em mediana abaixo de um dia, com pelo menos dez formações medidas.',
   'qualidade', 'card-jornada', 3),

  ('for_evasao_inicio', 'formacoes', 'abandono',
   'A evasão acontece no começo da grade',
   'Em que ponto da grade o aluno desiste da formação?',
   'De quem conclui a primeira aula de uma formação, {sobrevivencia_fim:pct} chegam ao trecho final da grade. E {parte_perda:pct} de tudo que se perde pelo caminho se perde antes da metade.',
   'A curva despenca no começo e quase estabiliza depois do meio: quem passa da metade tende a terminar. É uma média entre formações com {min_aulas_grade:int} aulas ou mais e pelo menos {min_base:int} alunos na primeira aula, então não descreve nenhum curso em particular. E é uma foto de hoje: quem está no meio da grade neste momento aparece igual a quem desistiu.',
   'Lembrete e sequência rendem mais nas primeiras aulas do que perto do fim, onde quase não há mais ninguém para perder. A curva inteira está em Onde o aluno para no curso.',
   'Ao menos três quintos de toda a perda de sobrevivência concentrados na primeira metade da grade, com os dez decis medidos.',
   'conclusao', 'card-dropoff', 4);

-- p_papel e p_plano existem para a assinatura ser a mesma dos demais
-- calculadores — o invólucro de cache e o componente de resumo não precisam de
-- caso especial. NENHUMA RPC de formações aceita recorte por persona ou plano, e
-- a tela não tem SegmentoFiltro: os dois argumentos são deliberadamente
-- ignorados aqui. Quem ler daqui a seis meses não deve concluir que o recorte
-- está aplicado, porque não está.
create function insights.calcular_achados_formacoes(
  p_dias integer default 30, p_papel text default null, p_plano text default null)
returns table(
  regra text, familia text, severidade text, titulo text,
  gabarito text, gabarito_leitura text, gabarito_acao text,
  parametros jsonb, score numeric, suprimida boolean, motivo text,
  ancora_aba text, ancora_id text)
language sql stable set search_path to ''
as $$
  with
  -- Uma CTE materializada por RPC lida: cada uma custa entre 111 ms e 731 ms e
  -- é referenciada mais de uma vez abaixo. Sem o materialized, a CTE dentro de
  -- subconsulta escalar seria reavaliada a cada leitura.
  uso as materialized (select * from public.bi_formacoes_uso(p_dias)),
  dur as materialized (select * from public.bi_duracao_ideal() where taxa_media is not null),
  jor as materialized (select * from public.bi_jornada_cursos(20) where mediana_dias is not null),
  dro as materialized (select * from public.bi_dropoff_posicao() where taxa_media is not null),

  lider as (
    select u.curso, u.alunos, u.alunos_historico, u.certificados_historico, u.conclusao_historica
    from uso u order by u.alunos desc nulls last limit 1
  ),
  -- A líder sai da comparação pelo NOME EXIBIDO, única chave que a RPC devolve:
  -- se duas formações passarem a se chamar igual, as duas caem fora da mediana
  -- em silêncio. E a mediana só é honesta porque bi_formacoes_uso devolve o
  -- catálogo publicado inteiro, sem corte — se ela ganhar um p_limite um dia,
  -- esta conta passa a ser sobre a lista cortada sem erro nenhum.
  -- O piso de 200 alunos históricos é a régua de porte da regra: mexer nele
  -- muda quem entra na comparação, não o texto do gabarito.
  pares as (
    select u.conclusao_historica
    from uso u, lider l
    where u.alunos_historico >= 200
      and u.conclusao_historica is not null
      and u.curso is distinct from l.curso
  ),
  pares_agg as (
    select count(*) as n,
           (percentile_cont(0.5) within group (order by p.conclusao_historica))::numeric as mediana
    from pares p
  ),
  r_lider as (
    select 'for_lider_conclusao'::text as regra,
      case when (select l.curso from lider l) is null
             then 'nenhuma formação com aluno no período'
           when (select l.conclusao_historica from lider l) is null
             then 'a formação líder do período ainda não tem conclusão histórica apurada'
           when (select a.n from pares_agg a) < 5
             then 'menos de cinco formações de porte comparável para sustentar a mediana'
           when (select a.mediana from pares_agg a) - (select l.conclusao_historica from lider l) < 0.15
             then 'a líder conclui dentro de quinze pontos percentuais da mediana das demais'
      end as motivo,
      jsonb_build_object(
        'curso_lider', (select l.curso from lider l),
        'alunos_lider', (select l.alunos from lider l),
        'conclusao_lider', (select l.conclusao_historica from lider l),
        'cert_lider', (select l.certificados_historico from lider l),
        'hist_lider', (select l.alunos_historico from lider l),
        'pares', (select a.n from pares_agg a),
        'mediana_pares', round((select a.mediana from pares_agg a), 4),
        'defasagem', round(((select a.mediana from pares_agg a)
                            - (select l.conclusao_historica from lider l)) * 100, 1)
      ) as parametros,
      round(((select a.mediana from pares_agg a)
             - (select l.conclusao_historica from lider l)) / 0.15, 2) as score
  ),

  -- Os extremos saem por `ordem`, a chave numérica da escala, e não pelo rótulo
  -- da faixa: o rótulo viaja para o texto, mas nunca decide nada aqui.
  curta as (select d.faixa, d.aulas, d.taxa_media from dur d order by d.ordem asc limit 1),
  longa as (select d.faixa, d.aulas, d.taxa_media from dur d order by d.ordem desc limit 1),
  r_duracao as (
    select 'for_duracao'::text as regra,
      -- A monotonicidade é exigida porque o gabarito afirma que a taxa só cai;
      -- uma inversão em qualquer degrau desmente a frase e cala a regra.
      case when (select count(*) from dur) < 3
             then 'menos de três faixas de duração reuniram aula publicada suficiente para virar média'
           when exists (select 1 from dur a join dur b on b.ordem > a.ordem where b.taxa_media > a.taxa_media)
             then 'a taxa sobe em algum degrau da escala: a duração não ordena a conclusão neste catálogo'
           when (select c.taxa_media from curta c) - (select g.taxa_media from longa g) < 0.10
             then 'queda abaixo de dez pontos percentuais entre a faixa mais curta e a mais longa'
      end as motivo,
      jsonb_build_object(
        'faixa_curta', (select c.faixa from curta c),
        'taxa_curta', (select c.taxa_media from curta c),
        'aulas_curta', (select c.aulas from curta c),
        'faixa_longa', (select g.faixa from longa g),
        'taxa_longa', (select g.taxa_media from longa g),
        'aulas_longa', (select g.aulas from longa g),
        'queda', round(((select c.taxa_media from curta c) - (select g.taxa_media from longa g)) * 100, 1),
        -- Espelha o piso de amostra embutido em bi_duracao_ideal: faixa com
        -- menos aulas que isso não recebe taxa_media e some do filtro acima.
        'min_aulas', 10
      ) as parametros,
      round(((select c.taxa_media from curta c) - (select g.taxa_media from longa g)) / 0.10, 2) as score
  ),

  jor_agg as (
    select count(*) as cursos,
           count(*) filter (where j.mediana_dias < 1) as sob_um_dia,
           count(*) filter (where j.mediana_dias >= 7) as acima_semana
    from jor j
  ),
  r_jornada as (
    select 'for_jornada_sessao'::text as regra,
      case when (select a.cursos from jor_agg a) < 10
             then 'menos de dez formações com certificados suficientes para a lista'
           when (select a.sob_um_dia from jor_agg a)::numeric
                / (select a.cursos from jor_agg a) < 0.667
             then 'menos de dois terços das formações fechando abaixo de um dia'
      end as motivo,
      jsonb_build_object(
        'cursos', (select a.cursos from jor_agg a),
        'sob_um_dia', (select a.sob_um_dia from jor_agg a),
        'parte', round((select a.sob_um_dia from jor_agg a)::numeric
                       / nullif((select a.cursos from jor_agg a), 0), 4),
        'acima_semana', (select a.acima_semana from jor_agg a),
        -- 20 é o mesmo p_min_certificados que a tela passa em useJornadaCursos:
        -- a frase precisa descrever a MESMA lista que o card mostra.
        'min_certificados', 20,
        'limiar_dias', 1,
        'limiar_longo', 7
      ) as parametros,
      round(((select a.sob_um_dia from jor_agg a)::numeric
             / nullif((select a.cursos from jor_agg a), 0)) / 0.667, 2) as score
  ),

  -- O decil 5 é a metade da grade porque a escala tem dez degraus — a supressão
  -- abaixo exige os dez justamente para que essa posição continue significando
  -- "metade" se a RPC mudar de granularidade.
  dro_ext as (
    select (select count(*) from dro) as decis,
           (select d.taxa_media from dro d order by d.decil asc limit 1) as t_inicio,
           (select d.taxa_media from dro d where d.decil = 5) as t_meio,
           (select d.taxa_media from dro d order by d.decil desc limit 1) as t_fim
  ),
  r_evasao as (
    select 'for_evasao_inicio'::text as regra,
      -- Aqui NÃO se exige monotonicidade, ao contrário de for_duracao: a curva
      -- real sobe um pouco em dois degraus e o gabarito não afirma queda
      -- contínua, afirma concentração da perda na primeira metade.
      case when (select e.decis from dro_ext e) < 10 or (select e.t_meio from dro_ext e) is null
             then 'a grade não rendeu os dez decis: sem os dois extremos a perda não se reparte'
           when (select e.t_inicio - e.t_fim from dro_ext e) <= 0
             then 'não há perda de sobrevivência entre o primeiro e o último decil'
           when (select (e.t_inicio - e.t_meio) / nullif(e.t_inicio - e.t_fim, 0) from dro_ext e) < 0.60
             then 'menos de três quintos da perda na primeira metade: a evasão é distribuída'
      end as motivo,
      jsonb_build_object(
        'sobrevivencia_fim', (select e.t_fim from dro_ext e),
        'parte_perda', round((select (e.t_inicio - e.t_meio) / nullif(e.t_inicio - e.t_fim, 0) from dro_ext e), 4),
        -- Espelham os dois pisos embutidos em bi_dropoff_posicao (grade com dez
        -- aulas ou mais, cinquenta conclusões na primeira aula). Não são régua
        -- desta regra: são o recorte da população que a curva descreve.
        'min_aulas_grade', 10,
        'min_base', 50
      ) as parametros,
      -- O nulo natural desta razão é 0,5 (perda repartida por igual entre os
      -- degraus), então 0,60 é uma barra acima do acaso, não em cima dele.
      round((select (e.t_inicio - e.t_meio) / nullif(e.t_inicio - e.t_fim, 0) from dro_ext e) / 0.60, 2) as score
  ),

  todas as (
    select * from r_lider
    union all select * from r_duracao
    union all select * from r_jornada
    union all select * from r_evasao
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

comment on function insights.calcular_achados_formacoes(integer, text, text) is
  'Achados de Formações. p_papel e p_plano são ignorados: nenhuma RPC desta tela aceita recorte por persona ou plano. Três das quatro regras não dependem de p_dias — o achado é do catálogo, não da janela.';

grant execute on function insights.calcular_achados_formacoes(integer, text, text) to authenticated;

delete from insights.achado_cache where chave like 'formacoes|%';
