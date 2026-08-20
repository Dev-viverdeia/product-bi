-- A fonte de receita parou antes do que a tela dizia, e o score alarmava por crescer
--
-- Dois problemas da auditoria de conteúdo das abas Análise e Plano. Sem relação
-- entre si, mas os dois da mesma família: a frase afirma uma coisa e o número
-- por trás mede outra.
--
-- 1. "O ÚLTIMO PAGAMENTO" ERA O ÚLTIMO REGISTRO DE QUALQUER TIPO
--
-- `bi_receita_kpis.dados_ate` era `max(data_brt)` sobre TODOS os tipos de
-- fatura. O registro mais recente é `invoice.created` — fatura emitida, não
-- paga. Medido por tipo:
--
--   invoice.created           18/04   341 linhas
--   invoice.status_updated    18/04   353
--   invoice.payment_failed    18/04   131
--   invoice.payment_succeeded 02/04   236   ← o último pagamento de verdade
--   invoice.refunded          01/02    33
--
-- Duas afirmações saíam disso, as duas falsas:
--
-- - o aviso do topo da tela: "o último webhook de PAGAMENTO recebido é de
--   18/04" — era uma fatura apenas emitida;
-- - o achado `rec_fonte_parada`: "o último pagamento entrou há {dias} dias" com
--   124, quando são **140**. O parâmetro se chama `dias_sem_pagamento` e não
--   media pagamento nenhum.
--
-- E 02/04 é também onde a série DE FATO termina: `bi_receita_mensal` filtra
-- `payment_succeeded`. A tela mostrava a fonte dezesseis dias mais fresca do
-- que ela está.
--
-- ⚠️ A diferença entre as duas datas é informativa, e conflatá-las escondia
-- justamente isso: por dezesseis dias a fonte registrou fatura sendo CRIADA e
-- FALHANDO sem nenhuma aprovada. O que parou primeiro foi a cobrança dar certo,
-- não o webhook chegar. Por isso `fonte_ate` entra em vez de a outra data
-- simplesmente sumir.
--
-- `dados_ate` mantém o nome e ganha a semântica que os dois consumidores dela
-- sempre afirmaram — então `calcular_achados_receita`, que lê `k.dados_ate`,
-- fica correto sem ser tocado.
--
-- 2. O SCORE DE `vg_tendencia` ALARMAVA POR CRESCER
--
-- Era `abs(ativos/ativos_ant - 1) / 0.05`. O `abs()` faz +9% e −9% pontuarem
-- igual, então crescimento publicava a pílula "atenção" — ao lado de um KPI
-- que renderiza o MESMO número em verde com seta para cima, porque a página
-- não passa `upIsGood` e o padrão do `KpiCard` é "subir é bom". A fileira de
-- KPIs fica FORA das abas, então as duas leituras contraditórias aparecem
-- juntas na mesma dobra. E em `/plano` o item caía na aba "Atenção", como
-- coisa a fazer.
--
-- Medido em treze janelas de quinze em quinze dias nos últimos cento e oitenta,
-- ativos em (d−30,d] contra (d−60,d−30], só `e_cliente`:
--
--   21/fev  +73,1%  score 14,61      06/jun  +11,2%  score 2,24
--   08/mar  +45,6%        9,13       21/jun   +8,3%        1,65
--   23/mar  +66,8%       13,36       06/jul   +1,5%        0,29
--   07/abr  +71,8%       14,35       21/jul   −3,1%        0,63
--   22/abr  +64,0%       12,80       05/ago   +3,3%        0,66
--   07/mai  +46,7%        9,34       20/ago   +9,6%        1,93
--   22/mai  +21,5%        4,29
--
-- DOZE das treze são crescimento, e fevereiro pontuaria 14,61 — "risco alto"
-- por crescer 73%. Com a queda isolada, as treze dão zero: não houve queda a
-- tratar no período, que é a resposta certa.
--
-- O achado continua sendo PUBLICADO no crescimento, em severidade neutra. O
-- número é digno de leitura — e é a leitura dele que carrega o aviso do
-- denominador (a base cresceu mais que os ativos, então a fatia encolheu). O
-- que ele deixa de fazer é alarmar.

drop function if exists public.bi_receita_kpis();

create function public.bi_receita_kpis()
returns table(
  receita_brl numeric, faturas bigint, compradores bigint,
  ticket_mediano numeric, reembolsado_brl numeric,
  dados_ate date, fonte_ate date
)
language sql
stable
set search_path to ''
as $function$
  select
    round(coalesce(sum(valor_brl) filter (where tipo = 'invoice.payment_succeeded'), 0), 2),
    count(*) filter (where tipo = 'invoice.payment_succeeded'),
    count(distinct email) filter (where tipo = 'invoice.payment_succeeded'),
    round(percentile_cont(0.5) within group (
      order by valor_brl) filter (where tipo = 'invoice.payment_succeeded')::numeric, 2),
    round(coalesce(sum(valor_brl) filter (where tipo = 'invoice.refunded'), 0), 2),
    -- `dados_ate` é a data do último PAGAMENTO APROVADO, que é o que os dois
    -- consumidores dela sempre afirmaram. Era `max(data_brt)` sobre TODOS os
    -- tipos, e o registro mais recente é `invoice.created`: a tela dizia
    -- "o último webhook de pagamento é de 18/04" quando o último pagamento
    -- entrou em 02/04, e o achado publicava 124 dias onde são 140.
    -- É também a data em que a série de fato termina — `bi_receita_mensal`
    -- filtra `payment_succeeded`.
    max(data_brt) filter (where tipo = 'invoice.payment_succeeded'),
    -- E a outra data continua disponível, com o nome certo: a fonte seguiu
    -- registrando fatura criada e falhada por mais dezesseis dias sem nenhuma
    -- aprovada. Conflatar as duas escondia justamente isso.
    max(data_brt)
  from marts.fact_fatura;
$function$;

grant execute on function public.bi_receita_kpis() to authenticated, service_role;

comment on function public.bi_receita_kpis() is
  'KPIs de receita. dados_ate e a data do ultimo PAGAMENTO APROVADO - ate 20/08/2026 era max(data_brt) sobre todos os tipos, e o registro mais recente e invoice.created: a tela afirmava "ultimo webhook de pagamento" sobre uma fatura apenas emitida, e o achado rec_fonte_parada publicava 124 dias onde sao 140. fonte_ate guarda a data do ultimo registro de qualquer tipo, porque a diferenca entre as duas e informativa: a fonte seguiu registrando fatura criada e falhada por dezesseis dias sem nenhuma aprovada.';

create or replace function insights.calcular_achados_visao_geral(
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
      -- A supressão continua nos dois sentidos: variação pequena é ruído, suba
      -- ou desça.
      case when k.ativos_ant is null then 'período anterior sem comparação sustentada pela régua de amostra'
           when abs(k.ativos::numeric / k.ativos_ant - 1) < 0.05 then 'variação abaixo do limiar de cinco por cento'
      end as motivo,
      jsonb_build_object('ativos', k.ativos, 'ativos_ant', k.ativos_ant,
        'delta', round(k.ativos::numeric / nullif(k.ativos_ant, 0) - 1, 4)) as parametros,
      -- ⚠️ O SCORE CONTA SÓ A QUEDA. Era `abs(delta) / 0.05`, e o abs() fazia
      -- crescer e encolher pontuarem igual: a tela publicava a pílula "atenção"
      -- ao lado de um KPI verde com o mesmo número, e o item caía na aba
      -- "Atenção" do /plano como coisa a fazer.
      --
      -- Medido em treze janelas de quinze em quinze dias nos últimos cento e
      -- oitenta: DOZE são crescimento, e o abs() dava score 14,61 em fevereiro
      -- (+73,1%) — "risco alto" por crescer. Com a queda isolada, as treze dão
      -- zero, que é a resposta certa: não houve queda a tratar no período.
      --
      -- O achado continua sendo PUBLICADO no crescimento, em severidade neutra:
      -- o número é digno de leitura, e a leitura dele é que carrega o aviso do
      -- denominador. O que ele deixa de fazer é alarmar.
      round(greatest(0, 1 - k.ativos::numeric / nullif(k.ativos_ant, 0)) / 0.05, 2) as score
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

update insights.regra set
  limiar_descricao = 'Variação de pelo menos cinco por cento em qualquer sentido, com os dois períodos acima do piso de amostra. Só a QUEDA pontua: crescimento é publicado e não alarma.'
where id = 'vg_tendencia';

delete from insights.achado_cache where chave like 'visao-geral|%' or chave like 'receita|%';
