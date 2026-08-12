-- Motor de achados da tela /receita.
-- Enquadramento que o texto das quatro regras carrega: a fonte desta tela é um
-- meio de pagamento entre os que a empresa usa, e a apuração fechada vive fora
-- do BI. Nenhum gabarito imprime valor em reais nem trata o total como receita
-- da empresa — o renderizador não tem formato de moeda, e essa ausência é trava.

insert into insights.regra
  (id, tela, familia, titulo, pergunta, gabarito, gabarito_leitura, gabarito_acao,
   limiar_descricao, ancora_aba, ancora_id, ordem)
values
  ('rec_fonte_parada', 'receita', 'cobertura',
   'A série termina onde o rastreamento parou',
   'A receita mostrada nesta tela é a receita da empresa?',
   'O último pagamento que esta fonte registrou entrou há {dias_sem_pagamento:int} dias. Os {meses_serie:int} meses da série terminam onde o rastreamento parou, não onde a receita parou.',
   'Esta tela mede um meio de pagamento até o dia em que ele parou de mandar dado — não a receita da empresa. A cobrança passa por mais de um meio e a apuração fechada vive fora do BI, então todo total daqui é o total desta fonte, e o faturamento real é de outra ordem de grandeza. O que sobrevive à parada são as proporções de dentro da própria fonte: quanto falhou, quanto voltou, como as vendas se distribuíram enquanto houve registro.',
   'Nenhum número de faturamento sai desta tela enquanto a fonte definitiva não estiver publicável. O que ela ainda sustenta é atrito de cobrança e reembolso, em Saúde da cobrança.',
   'Mais de trinta dias entre o último pagamento registrado e o último dia com dado carregado. A fonte registrou pagamento em todos os meses em que existiu, então um ciclo mensal inteiro em silêncio já está fora do regime observado.',
   'receita', 'card-receita-mensal', 1),

  ('rec_falha_cobranca', 'receita', 'cobranca',
   'A cobrança insiste mais do que acerta',
   'Quanto atrito a máquina de cobrar está gerando, e onde ele bate?',
   'As faturas que falharam somam {pct_falha:pct} do valor que esta fonte aprovou: {faturas_falha:int} tentativas contra {faturas_pagas:int} faturas pagas. A fatura que falha custa {peso_falha:mult} a fatura aprovada média.',
   'Isto não é receita perdida. Cobrança que falha reaparece no ciclo seguinte como fatura nova, então o valor somado conta o mesmo contrato mais de uma vez — e parte dele entra depois, na tentativa seguinte. O que o número sustenta é atrito: quanto a cobrança precisa insistir, e que ela insiste mais na fatura cara que na barata. E é história: a fonte parou de registrar, então esta conta cobre o período em que houve registro, não o mês corrente.',
   'Atrito de cobrança se resolve antes do vencimento: avisar o cliente de cartão a vencer rende mais do que insistir depois. A contagem e o valor por evento estão em Saúde da cobrança.',
   'Valor das tentativas fracassadas em pelo menos um quarto do valor aprovado pela fonte. Abaixo disso a falha cabe na taxa de recusa de cartão que qualquer carteira tem.',
   'receita', 'card-saude-cobranca', 2),

  ('rec_concentracao_mes', 'receita', 'concentracao',
   'A série descreve um lançamento, não um regime',
   'Dá para tirar média mensal ou projeção desta série?',
   '{compradores_pico:int} dos {compradores_total:int} compradores desta série compraram no mesmo mês — {pct_compradores:pct} de todos eles. Esse único mês responde por {pct_receita_pico:pct} de tudo que a fonte aprovou.',
   'Série que cabe quase toda num mês descreve um lançamento, não uma assinatura em regime. Qualquer média mensal tirada daqui fica acima de qualquer mês típico, e projetar a partir dela é projetar um evento que não se repetiu. A comparação honesta são os meses depois do pico: bem menores e bem mais parecidos entre si. E a série está encerrada no dia em que a fonte parou — o pico e o que veio depois são um trecho fechado, sem nenhum mês em curso dentro da conta.',
   'Não use a média desta série como referência de mês: compare cada mês contra os meses posteriores ao pico. A distribuição por mês está em Compradores por mês.',
   'O mês de maior receita concentrando pelo menos um terço dos compradores distintos de toda a série.',
   'receita', 'card-compradores-mes', 3),

  ('rec_reembolso', 'receita', 'reembolso',
   'O dinheiro que entrou e voltou pesa mais que a média',
   'Qual é o tamanho do vazamento por desistência, e em que faixa de fatura ele acontece?',
   '{pct_reembolso:pct} do valor aprovado por esta fonte voltou como reembolso: {faturas_reembolso:int} faturas de {faturas_pagas:int} pagas. A fatura devolvida vale {peso_reembolso:mult} a fatura aprovada média.',
   'Reembolso é a única linha desta tela que mede decisão do cliente, não decisão do meio de pagamento: quem pediu de volta comprou, entrou e desistiu. Ele pesa mais que a fatura média, e isso diz onde a desistência acontece — acima do ticket típico, não abaixo. O percentual também não compara as mesmas vendas: um reembolso pode devolver uma compra de meses antes, então ele mede o tamanho do vazamento, não o arrependimento de uma safra. E a conta está fechada: com a fonte parada, ela soma o que voltou enquanto houve registro, não o que volta hoje.',
   'Desistência acima do ticket médio é a saída mais cara que o produto tem, e ela acontece antes de o cliente sumir do uso. O valor e a contagem estão em Saúde da cobrança, na linha Reembolsado.',
   'Valor reembolsado em pelo menos um décimo do valor aprovado pela fonte. Abaixo disso o retorno cabe no que uma garantia normal consome.',
   'receita', 'card-saude-cobranca', 4);

-- RPCs lidas: public.bi_data_referencia, public.bi_receita_kpis,
-- public.bi_receita_mensal, public.bi_receita_saude_cobranca.
-- As três RPCs de receita não aceitam janela nem recorte: leem o histórico
-- inteiro. Os argumentos da assinatura existem para casar com o contrato do
-- motor e com a chave de cache da tela — o achado não muda com eles, e os
-- cards da tela têm exatamente o mesmo comportamento.
create or replace function insights.calcular_achados_receita(
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
  with
  dref as materialized (select public.bi_data_referencia() as hoje),
  kpi as materialized (select * from public.bi_receita_kpis()),
  mensal as materialized (select * from public.bi_receita_mensal()),
  cobranca as materialized (select * from public.bi_receita_saude_cobranca()),
  -- ARMADILHA: 'Pagamento aprovado', 'Pagamento falhou' e 'Reembolsado' são o
  -- rótulo de exibição montado dentro da RPC, o mesmo que a tela imprime. Se o
  -- card renomear um evento, as três regras de cobrança param de casar e somem
  -- em silêncio, sem erro. O conserto definitivo é a RPC devolver a chave crua
  -- ao lado do rótulo; enquanto isso, quem mexer no texto do card mexe aqui.
  cob as materialized (
    select
      max(c.valor_brl)   filter (where c.evento = 'Pagamento aprovado') as pago_valor,
      max(c.faturas)     filter (where c.evento = 'Pagamento aprovado') as pago_faturas,
      max(c.valor_brl)   filter (where c.evento = 'Pagamento falhou')   as falha_valor,
      max(c.faturas)     filter (where c.evento = 'Pagamento falhou')   as falha_faturas,
      max(c.pct_do_pago) filter (where c.evento = 'Pagamento falhou')   as falha_pct,
      max(c.valor_brl)   filter (where c.evento = 'Reembolsado')        as reemb_valor,
      max(c.faturas)     filter (where c.evento = 'Reembolsado')        as reemb_faturas,
      max(c.pct_do_pago) filter (where c.evento = 'Reembolsado')        as reemb_pct
    from cobranca c
  ),
  -- Desempate por mês para a frase não trocar de referência entre dois meses de
  -- receita idêntica; hoje não há empate, e o mês de maior receita também é o
  -- de mais compradores.
  pico as (
    select m.mes, m.receita_brl, m.compradores
    from mensal m
    order by m.receita_brl desc, m.mes
    limit 1
  ),
  r_fonte as (
    -- A idade do último pagamento vem de public.bi_data_referencia(): a régua
    -- de frescor do BI, não a data do relógio, senão o achado envelheceria
    -- também nos dias em que o pipeline inteiro está parado.
    select 'rec_fonte_parada'::text as regra,
      case when k.dados_ate is null
             then 'a fonte não devolveu a data do último pagamento registrado'
           when (select count(*) from mensal) = 0
             then 'não há série mensal de receita carregada'
           when d.hoje - k.dados_ate <= 30
             then 'a fonte voltou a registrar pagamento dentro do último ciclo mensal'
      end as motivo,
      jsonb_build_object(
        'dias_sem_pagamento', d.hoje - k.dados_ate,
        'meses_serie', (select count(*) from mensal)) as parametros,
      round((d.hoje - k.dados_ate)::numeric / 30, 2) as score
    from kpi k cross join dref d
  ),
  r_falha as (
    select 'rec_falha_cobranca'::text as regra,
      case when coalesce(b.pago_valor, 0) = 0
             then 'sem valor aprovado não há base para a taxa de falha'
           when b.falha_faturas is null
             then 'a fonte não registrou falha de cobrança no histórico'
           when b.falha_pct < 0.25
             then 'falha abaixo de um quarto do valor aprovado, dentro da recusa de cartão que qualquer carteira tem'
      end as motivo,
      jsonb_build_object(
        'pct_falha', b.falha_pct,
        'faturas_falha', b.falha_faturas,
        'faturas_pagas', b.pago_faturas,
        'peso_falha', round((b.falha_valor / nullif(b.falha_faturas, 0))
                            / nullif(b.pago_valor / nullif(b.pago_faturas, 0), 0), 4)) as parametros,
      round(b.falha_pct / 0.25, 2) as score
    from cob b
  ),
  r_concentracao as (
    -- left join porque série vazia precisa cair na supressão de série curta, e
    -- não sumir do bloco sem motivo declarado.
    select 'rec_concentracao_mes'::text as regra,
      case when (select count(*) from mensal) < 3
             then 'série curta demais para falar em concentração de mês'
           when coalesce(k.compradores, 0) = 0
             then 'a fonte não devolveu compradores distintos para servir de base'
           when p.compradores::numeric / nullif(k.compradores, 0) < 0.3333
             then 'o mês de maior receita concentra menos de um terço dos compradores da série'
      end as motivo,
      -- A base é o distinto da KPI, não a soma dos meses: comprador que voltou
      -- é contado uma vez em cada mês em que comprou, e a soma mensal passa do
      -- total da série.
      jsonb_build_object(
        'pct_compradores', round(p.compradores::numeric / nullif(k.compradores, 0), 4),
        'compradores_pico', p.compradores,
        'compradores_total', k.compradores,
        'pct_receita_pico', round(p.receita_brl / nullif(k.receita_brl, 0), 4)) as parametros,
      round((p.compradores::numeric / nullif(k.compradores, 0)) / 0.3333, 2) as score
    from kpi k left join pico p on true
  ),
  r_reembolso as (
    select 'rec_reembolso'::text as regra,
      case when coalesce(b.pago_valor, 0) = 0
             then 'sem valor aprovado não há base para a taxa de reembolso'
           when b.reemb_faturas is null
             then 'a fonte não registrou reembolso no histórico'
           when b.reemb_pct < 0.10
             then 'reembolso abaixo de um décimo do valor aprovado, dentro do que uma garantia normal consome'
      end as motivo,
      jsonb_build_object(
        'pct_reembolso', b.reemb_pct,
        'faturas_reembolso', b.reemb_faturas,
        'faturas_pagas', b.pago_faturas,
        'peso_reembolso', round((b.reemb_valor / nullif(b.reemb_faturas, 0))
                                / nullif(b.pago_valor / nullif(b.pago_faturas, 0), 0), 4)) as parametros,
      round(b.reemb_pct / 0.10, 2) as score
    from cob b
  ),
  todas as (
    select * from r_fonte
    union all select * from r_falha
    union all select * from r_concentracao
    union all select * from r_reembolso
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

delete from insights.achado_cache where chave like 'receita|%';
