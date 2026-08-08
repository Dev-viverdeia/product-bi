-- Auditoria 08/ago/2026 — funil de Soluções misturava janelas.
--
-- As etapas 1 e 2 vêm de fact_pageview (rastreado só desde 03/07/2026); as
-- etapas 3 e 4 vêm de fact_progresso_solucao (histórico completo). No filtro
-- de 90 dias o funil ficava impossível: "Iniciou uma solução" batia 112,6% do
-- topo — mais gente iniciando do que abrindo o catálogo.
--
-- Correção: todas as etapas passam a cobrir a MESMA janela, recortada no
-- início do rastreio. A RPC devolve `desde` para a tela dizer o período real
-- em vez de prometer 90 dias que não existem.

drop function if exists public.bi_solucoes_conversao_tela(integer);

create function public.bi_solucoes_conversao_tela(p_dias integer default 30)
returns table (etapa text, ordem integer, usuarios bigint, pct numeric, desde date)
language sql stable security invoker set search_path = ''
as $$
  with hoje as (select (now() at time zone 'America/Sao_Paulo')::date d),
  -- a janela efetiva nunca começa antes do rastreio de navegação existir
  janela as (
    select greatest(h.d - p_dias, (select min(data_brt) from marts.fact_pageview) - 1) as ini
    from hoje h
  ),
  catalogo as (
    select count(distinct pv.user_id) as n
    from marts.fact_pageview pv
    join marts.dim_usuario u on u.user_id = pv.user_id and u.e_cliente, janela j
    where pv.path = '/solucoes' and pv.data_brt > j.ini
  ),
  detalhe as (
    select count(distinct pv.user_id) as n
    from marts.fact_pageview pv
    join marts.dim_usuario u on u.user_id = pv.user_id and u.e_cliente, janela j
    where pv.path like '/solucoes/%' and pv.data_brt > j.ini
  ),
  iniciou as (
    select count(distinct p.user_id) as n
    from marts.fact_progresso_solucao p
    join marts.dim_usuario u on u.user_id = p.user_id and u.e_cliente, janela j
    where (p.iniciado_em at time zone 'America/Sao_Paulo')::date > j.ini
  ),
  concluiu as (
    select count(distinct p.user_id) as n
    from marts.fact_progresso_solucao p
    join marts.dim_usuario u on u.user_id = p.user_id and u.e_cliente, janela j
    where p.concluido and (p.concluido_em at time zone 'America/Sao_Paulo')::date > j.ini
  )
  select e.etapa, e.ordem, e.n,
         round(e.n::numeric / nullif((select n from catalogo), 0), 4),
         (select ini + 1 from janela)
  from (values
    ('Abriu o catálogo /solucoes', 1, (select n from catalogo)),
    ('Abriu alguma solução', 2, (select n from detalhe)),
    ('Iniciou uma solução', 3, (select n from iniciou)),
    ('Concluiu uma solução', 4, (select n from concluiu))
  ) as e(etapa, ordem, n)
  order by e.ordem;
$$;

comment on function public.bi_solucoes_conversao_tela(integer) is
  'Funil catálogo→conclusão. Janela recortada no início do rastreio de pageview para que as 4 etapas cubram o mesmo período; `desde` informa a data efetiva.';

revoke execute on function public.bi_solucoes_conversao_tela(integer) from public, anon;
grant execute on function public.bi_solucoes_conversao_tela(integer) to authenticated;
