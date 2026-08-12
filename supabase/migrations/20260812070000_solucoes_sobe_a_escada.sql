-- /solucoes sobe a escada.
--
-- Tinha dois descritivos, dois diagnosticos, um prescritivo e nenhum comparativo.
-- Entram os dois que o dado sustenta.
--
-- Medidas e REPROVADAS -- ficam aqui para ninguem refazer o caminho:
--   * Dificuldade explica a conclusao. Nao: medium 7,02%, easy 6,25%, advanced
--     5,24%. A distancia entre easy e advanced e de 1,0 ponto contra margem de
--     1,1 -- e o topo e "medium", nao "easy", entao nem a direcao se sustenta.
--   * Favoritar prediz concluir (10,9% x 6,2%). Passa raspando na margem, mas
--     favoritar e acao de 1,1% da base (329 de 29.792): recomendacao apoiada
--     nisso seria recomendacao sobre quase ninguem.
--   * Nota alta entrega conclusao. Vem invertida (5,3% para nota 9+ contra 6,9%
--     abaixo de 9) e sobre UNIDADE ERRADA: sao 13 solucoes contra 22, tratadas
--     como 18 mil tentativas independentes. Mesmo erro da "grade longa" em
--     /formacoes.
--   * Concluir aba prediz concluir solucao. E circular por construcao: apenas
--     0,15% das solucoes sao concluidas sem passar pela aba tools -- a aba nao
--     prediz o desfecho, ela faz parte dele.
--
-- Nota de dado: marts.fact_pedido_implementacao existe e esta VAZIA (0 linhas).
-- E a pendencia 3 da auditoria de 08/ago. Tabela vazia e pior que tabela
-- ausente: um join silencioso devolve nada e parece resposta.

-- 1) Concluir solucao muda a retencao do cliente?
--
-- A tela mostra 4,9% de conclusao. Antes de tratar isso como problema, e preciso
-- saber se concluir importa. Importa: quem concluiu alguma segue ativo em
-- proporcao bem maior. Os dois lados JA iniciaram alguma solucao, de proposito.
create or replace function public.bi_solucoes_efeito_conclusao()
returns table(
  grupo text, clientes bigint, ativos bigint, pct_ativo numeric, margem_pp numeric)
language sql
stable
set search_path to ''
as $function$
  with ref as materialized (select marts.data_referencia() as d),
  base as (
    select u.user_id,
      exists (
        select 1 from marts.fact_progresso_solucao p
        where p.user_id = u.user_id and p.concluido
      ) as concluiu,
      exists (
        select 1 from marts.fact_evento f, ref r2
        where f.user_id = u.user_id and f.data_brt > r2.d - 30
      ) as ativo
    from marts.dim_usuario u, ref r
    where u.e_cliente
      and (u.criado_em at time zone 'America/Sao_Paulo')::date < r.d - 120
      -- Os dois lados iniciaram: sem isso a comparacao mede quem entrou no
      -- modulo, nao quem terminou o que comecou.
      and exists (select 1 from marts.fact_progresso_solucao p where p.user_id = u.user_id)
  ),
  agregado as (
    select
      case when b.concluiu then 'Concluiu alguma solução' else 'Iniciou e nunca concluiu' end as grupo,
      count(*) as clientes,
      count(*) filter (where b.ativo) as ativos,
      case when count(*) >= 30
        then round(count(*) filter (where b.ativo)::numeric / count(*), 4) end as pct_ativo
    from base b group by 1
  ),
  margem as (
    select round(200 * sqrt(sum(
      coalesce(a.pct_ativo, 0) * (1 - coalesce(a.pct_ativo, 0)) / nullif(a.clientes, 0)
    ))::numeric, 1) as pp from agregado a
  )
  select a.grupo, a.clientes, a.ativos, a.pct_ativo, m.pp
  from agregado a cross join margem m
  order by a.grupo;
$function$;

comment on function public.bi_solucoes_efeito_conclusao() is
  'Atividade recente de quem concluiu alguma solucao x quem iniciou e nunca concluiu, entre clientes com 120+ dias de casa. Os dois lados iniciaram, de proposito. Associacao, nao causa.';

-- 2) A primeira tentativa e a que mais termina.
--
-- O corte que faz este card valer: os DOIS grupos saem das mesmas pessoas -- so
-- entra quem tentou duas ou mais solucoes. Isso tira de cena a diferenca entre
-- clientes, que e o confundidor que estraga toda comparacao de engajamento.
-- O que sobra e a ordem da tentativa dentro da mesma pessoa.
create or replace function public.bi_solucoes_ordem_da_tentativa()
returns table(
  grupo text, tentativas bigint, clientes bigint, concluidas bigint,
  pct numeric, margem_pp numeric)
language sql
stable
set search_path to ''
as $function$
  with ref as materialized (select marts.data_referencia() as d),
  p as (
    select p.user_id, p.concluido,
      row_number() over (partition by p.user_id order by p.iniciado_em, p.solution_id) as ordem,
      count(*) over (partition by p.user_id) as tentativas
    from marts.fact_progresso_solucao p, ref r
    -- 60 dias de carencia: solucao iniciada ontem ainda pode ser concluida, e
    -- entraria como fracasso.
    where (p.iniciado_em at time zone 'America/Sao_Paulo')::date < r.d - 60
  ),
  agregado as (
    select
      case when p.ordem = 1 then 'A primeira que tentou' else 'Da segunda em diante' end as grupo,
      count(*) as tentativas,
      count(distinct p.user_id) as clientes,
      count(*) filter (where p.concluido) as concluidas,
      case when count(*) >= 30
        then round(count(*) filter (where p.concluido)::numeric / count(*), 4) end as pct
    from p where p.tentativas >= 2 group by 1
  ),
  margem as (
    select round(200 * sqrt(sum(
      coalesce(a.pct, 0) * (1 - coalesce(a.pct, 0)) / nullif(a.tentativas, 0)
    ))::numeric, 1) as pp from agregado a
  )
  select a.grupo, a.tentativas, a.clientes, a.concluidas, a.pct, m.pp
  from agregado a cross join margem m
  order by a.grupo;
$function$;

comment on function public.bi_solucoes_ordem_da_tentativa() is
  'Taxa de conclusao da primeira solucao tentada x das seguintes, entre clientes que tentaram 2+. Os dois grupos vem das mesmas pessoas: e o que neutraliza a diferenca entre clientes.';

revoke execute on function public.bi_solucoes_efeito_conclusao() from public, anon;
revoke execute on function public.bi_solucoes_ordem_da_tentativa() from public, anon;
grant execute on function public.bi_solucoes_efeito_conclusao() to authenticated;
grant execute on function public.bi_solucoes_ordem_da_tentativa() to authenticated;
