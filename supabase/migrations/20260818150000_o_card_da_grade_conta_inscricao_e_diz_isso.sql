-- O card da grade conta inscrição, e passa a dizer isso
--
-- Terceiro corte da auditoria de 18/08: unidade de análise. O corte de dedup e
-- o de denominador cortado saíram limpos; este achou um defeito.
--
-- O DEFEITO
--
-- `bi_formacoes_entrada_na_grade` agrupa por `(curso_id, user_id)` e depois faz
-- `count(*)`, publicando o resultado numa coluna chamada `alunos`. O card
-- renderiza esse número sob o cabeçalho "Alunos" e a régua diz "Alunos com 90+
-- dias desde a 1ª aula daquele curso".
--
-- Só que a unidade não é aluno, é INSCRIÇÃO — o par pessoa×curso:
--
--   Começou pela 1ª aula   5.591 inscrições   2.944 pessoas   1,90 por pessoa
--   Entrou no meio         6.159 inscrições   3.513 pessoas   1,75 por pessoa
--   total                 11.750 inscrições   4.715 pessoas   2,49 por pessoa
--
-- O card publica 11.750 onde as pessoas são 4.715: infla 2,5x.
--
-- E 2.944 + 3.513 = 6.457 contra 4.715 distintas, ou seja **1.742 pessoas estão
-- nos DOIS grupos** — alguém que abriu um curso pela primeira aula e outro pelo
-- meio. O card as apresenta como dois grupos separados, sem dizer isso.
--
-- ESTE É UM ERRO QUE O PROJETO JÁ TINHA NOMEADO
--
-- O CLAUDE.md registra a recusa de uma análise de Soluções por exatamente isto:
-- "Nota alta entrega conclusão. Vem invertida E SOBRE UNIDADE ERRADA — 13
-- soluções contra 22, tratadas como 18 mil tentativas independentes. Mesmo erro
-- da 'grade longa' em Formações." O erro foi nomeado e recusado num lugar, e
-- sobreviveu publicado em outro.
--
-- A CONSEQUÊNCIA QUE MAIS IMPORTA É A MARGEM
--
-- `margem_pp` existe porque "diferença sem margem não é comparação" — é regra da
-- casa, e é o que impede ler qualquer gap como real. Mas ela vinha calculada
-- sobre 11.750 observações tratadas como independentes, quando cada pessoa
-- contribui ~2,5 delas e as suas observações são correlacionadas.
--
--   margem sobre inscrições (como estava)   1,8 pp
--   margem sobre pessoas    (honesta)       2,4 pp
--
-- **O achado sobrevive**: a diferença medida é 45,2% contra 35,3%, quase dez
-- pontos, que passa folgado nas duas margens. Não é o resultado que muda — é a
-- prova que sustenta o resultado, e publicar margem menor do que a real é
-- prometer precisão que o dado não tem.
--
-- Usar as PESSOAS como n é a escolha conservadora: é o piso de informação
-- independente do grupo. O caminho exato seria um fator de efeito de desenho, e
-- ele exigiria estimar a correlação intra-pessoa — mais máquina para um número
-- que já é declarado como piso.
--
-- O QUE MUDA NA SAÍDA
--
-- A coluna `alunos` vira `inscricoes`, e entra `pessoas`. As duas aparecem no
-- card: a taxa continua por inscrição (que é a unidade certa da PERGUNTA — a
-- mesma pessoa pode entrar bem num curso e mal em outro), e o número de gente
-- deixa de ser invisível.
--
-- Conferido: das oito funções que publicam `margem_pp`, esta é a ÚNICA que
-- agrupa por duas chaves. As outras agrupam por pessoa, então o `count(*)` já é
-- gente. Duas delas (`bi_solucoes_ordem_da_tentativa`,
-- `bi_jornada_profundidade_e_retencao`) já usavam `count(distinct)`.
--
-- Sem purga de insights.achado_cache: nenhuma regra de Formações lê esta função
-- (o calculador lê bi_dropoff_posicao, bi_duracao_ideal, bi_formacoes_uso e
-- bi_jornada_cursos). Conferido antes de aplicar.

drop function public.bi_formacoes_entrada_na_grade();

create function public.bi_formacoes_entrada_na_grade()
returns table(grupo text, inscricoes bigint, pessoas bigint, certificaram bigint,
              pct numeric, margem_pp numeric)
language sql stable set search_path to ''
as $function$
  with ref as materialized (select marts.data_referencia() as d),
  inicio as (
    -- Uma linha por (curso, pessoa): é a inscrição, e é a unidade da pergunta.
    -- A mesma pessoa pode abrir um curso pela primeira aula e outro pelo meio.
    select a.curso_id, p.user_id,
      min(p.iniciado_em) as comecou,
      (array_agg(a.posicao order by p.iniciado_em))[1] as primeira_posicao
    from marts.fact_progresso_aula p
    join marts.dim_aula a on a.id = p.lesson_id
    join marts.dim_usuario u on u.user_id = p.user_id and u.e_cliente
    where p.iniciado_em is not null and a.posicao is not null
    group by 1, 2
  ),
  elegivel as (
    select i.user_id, i.primeira_posicao,
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
      count(*) as inscricoes,
      count(distinct e.user_id) as pessoas,
      count(*) filter (where e.certificou) as certificaram,
      case when count(*) >= 30
        then round(count(*) filter (where e.certificou)::numeric / count(*), 4) end as pct
    from elegivel e group by 1
  ),
  margem as (
    -- n é PESSOAS, não inscrições. Cada pessoa contribui ~2,5 inscrições
    -- correlacionadas entre si; tratá-las como independentes encolhe a margem
    -- em cerca de um terço e promete precisão que o dado não tem.
    select round(200 * sqrt(sum(
      coalesce(a.pct, 0) * (1 - coalesce(a.pct, 0)) / nullif(a.pessoas, 0)
    ))::numeric, 1) as pp from agregado a
  )
  select a.grupo, a.inscricoes, a.pessoas, a.certificaram, a.pct, m.pp
  from agregado a cross join margem m
  order by a.grupo;
$function$;

comment on function public.bi_formacoes_entrada_na_grade() is
  'Certificação por onde a pessoa abriu o curso. A unidade é a INSCRIÇÃO (par pessoa x curso), não a pessoa: a mesma pessoa pode abrir um curso pela primeira aula e outro pelo meio, e 1.742 das 4.715 estão nos dois grupos. A taxa é por inscrição, que é a unidade da pergunta; `pessoas` aparece ao lado para o card não publicar inscrição chamando de gente — foi o defeito corrigido em 18/08, quando a coluna se chamava `alunos` e publicava 11.750 onde havia 4.715 pessoas. ⚠️ margem_pp usa PESSOAS como n, não inscrições: observações da mesma pessoa são correlacionadas, e tratá-las como independentes encolhia a margem de 2,4 pp para 1,8 pp.';

revoke execute on function public.bi_formacoes_entrada_na_grade() from public, anon;
grant execute on function public.bi_formacoes_entrada_na_grade() to authenticated, service_role;
