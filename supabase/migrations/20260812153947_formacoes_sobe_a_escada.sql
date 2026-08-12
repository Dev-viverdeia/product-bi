-- /formacoes sobe a escada.
--
-- A tela tinha tres descritivos, dois diagnosticos e um prescritivo -- e nenhum
-- comparativo. Entram os dois que o dado sustenta.
--
-- Medidas e REPROVADAS, escritas aqui para ninguem repetir o trabalho:
--   * "Grade longa entrega menos certificado" (58,97% ate 10 aulas x 35,98% acima).
--     Parece forte e nao e: UM curso sozinho responde por 59,4% dos alunos da faixa
--     longa. A faixa e aquele curso disfarcado de faixa. E as faixas se sobrepoem --
--     o pior curso curto certifica 31,2%, o melhor longo 63,5%.
--   * "Maratonar prejudica" (36,2% de quem fez o curso num dia x 33,8% de quem
--     espalhou). Diferenca de 2,4 pontos contra margem de 4,5 -- dentro do ruido.
--     Vale saber: a maratona NAO aparece como problema de retencao.

-- 1) O certificado prende, ou so marca quem ja estava preso?
--
-- Comparativo com os dois grupos nomeados, e o confundidor mora no proprio
-- recorte: os dois lados JA estudaram. Sem isso, o grupo sem certificado
-- carregaria quem nunca abriu uma aula e a diferenca mediria presenca, nao
-- conclusao. O que sobra ainda e associacao, e o card diz isso.
create or replace function public.bi_formacoes_efeito_certificado()
returns table(
  grupo text, clientes bigint, ativos bigint, pct_ativo numeric, margem_pp numeric)
language sql
stable
set search_path to ''
as $function$
  with ref as materialized (select marts.data_referencia() as d),
  base as (
    select u.user_id,
      exists (select 1 from marts.fact_certificado c where c.user_id = u.user_id) as tem_certificado,
      exists (
        select 1 from marts.fact_evento f, ref r2
        where f.user_id = u.user_id and f.data_brt > r2.d - 30
      ) as ativo
    from marts.dim_usuario u, ref r
    where u.e_cliente
      and (u.criado_em at time zone 'America/Sao_Paulo')::date < r.d - 120
      -- Os dois lados estudaram: e o que impede a comparacao de virar
      -- "quem usa o produto x quem nao usa".
      and exists (select 1 from marts.fact_progresso_aula p where p.user_id = u.user_id)
  ),
  agregado as (
    select
      case when b.tem_certificado then 'Tirou certificado' else 'Estudou e não tirou' end as grupo,
      count(*) as clientes,
      count(*) filter (where b.ativo) as ativos,
      case when count(*) >= 30
        then round(count(*) filter (where b.ativo)::numeric / count(*), 4) end as pct_ativo
    from base b group by 1
  ),
  -- Dois erros padrao da estimativa combinada, em pontos percentuais. A tela
  -- publica isto junto: diferenca sem margem nao e comparacao, e uma tabela
  -- lado a lado convida a ler qualquer diferenca como real.
  margem as (
    select round(200 * sqrt(sum(
      coalesce(a.pct_ativo, 0) * (1 - coalesce(a.pct_ativo, 0)) / nullif(a.clientes, 0)
    ))::numeric, 1) as pp from agregado a
  )
  select a.grupo, a.clientes, a.ativos, a.pct_ativo, m.pp
  from agregado a cross join margem m
  order by a.grupo;
$function$;

comment on function public.bi_formacoes_efeito_certificado() is
  'Atividade recente de quem tirou certificado x quem estudou e nao tirou, entre clientes com 120+ dias de casa. Os dois lados estudaram, de proposito. Associacao, nao causa.';

-- 2) Entrar pela porta da frente muda o desfecho?
--
-- Diagnostico do "por onde": o aluno que abre a grade na primeira aula certifica
-- mais que o que entra no meio. Recorte de 90 dias desde a primeira aula daquele
-- curso, para todo mundo ter tido tempo de terminar.
create or replace function public.bi_formacoes_entrada_na_grade()
returns table(
  grupo text, alunos bigint, certificaram bigint, pct numeric, margem_pp numeric)
language sql
stable
set search_path to ''
as $function$
  with ref as materialized (select marts.data_referencia() as d),
  inicio as (
    select a.curso_id, p.user_id,
      min(p.iniciado_em) as comecou,
      -- A aula de MENOR posicao entre as primeiras iniciadas seria outra
      -- pergunta; aqui e a posicao da aula que ele abriu primeiro no tempo.
      (array_agg(a.posicao order by p.iniciado_em))[1] as primeira_posicao
    from marts.fact_progresso_aula p
    join marts.dim_aula a on a.id = p.lesson_id
    where p.iniciado_em is not null and a.posicao is not null
    group by 1, 2
  ),
  elegivel as (
    select i.primeira_posicao,
      exists (
        select 1 from marts.fact_certificado f
        where f.user_id = i.user_id and f.curso_id = i.curso_id
      ) as certificou
    from inicio i, ref r
    where (i.comecou at time zone 'America/Sao_Paulo')::date < r.d - 90
  ),
  agregado as (
    select
      case when e.primeira_posicao <= 1 then 'Começou pela 1ª aula'
           else 'Entrou no meio da grade' end as grupo,
      count(*) as alunos,
      count(*) filter (where e.certificou) as certificaram,
      case when count(*) >= 30
        then round(count(*) filter (where e.certificou)::numeric / count(*), 4) end as pct
    from elegivel e group by 1
  ),
  margem as (
    select round(200 * sqrt(sum(
      coalesce(a.pct, 0) * (1 - coalesce(a.pct, 0)) / nullif(a.alunos, 0)
    ))::numeric, 1) as pp from agregado a
  )
  select a.grupo, a.alunos, a.certificaram, a.pct, m.pp
  from agregado a cross join margem m
  order by a.grupo;
$function$;

comment on function public.bi_formacoes_entrada_na_grade() is
  'Taxa de certificado de quem abriu o curso pela primeira aula x quem entrou no meio da grade, entre alunos com 90+ dias desde a primeira aula daquele curso.';

revoke execute on function public.bi_formacoes_efeito_certificado() from public, anon;
revoke execute on function public.bi_formacoes_entrada_na_grade() from public, anon;
grant execute on function public.bi_formacoes_efeito_certificado() to authenticated;
grant execute on function public.bi_formacoes_entrada_na_grade() to authenticated;
