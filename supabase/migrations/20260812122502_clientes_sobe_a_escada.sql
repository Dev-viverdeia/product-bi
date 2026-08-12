-- Fase 2 — Clientes & Retenção sobe a escada.
--
-- Duas trocas, as duas do tipo "o número estava certo e respondia a pergunta
-- errada".

-- 1. Comprador × convidado.
--
-- O card de retenção por papel mostra três barras e a leitura natural é "três
-- personas". Não é: master_user e membro_club são majoritariamente COMPRADORES
-- (dono da organização, quem comprou o Viver de IA) e hands_on é quem eles
-- convidaram. O corte estrutural é esse, e ele é mais forte e mais simples —
-- 38,9% contra 19,4%.
--
-- is_master bate 1:1 com organizations.master_user_id e NÃO se confunde com o
-- campo papel, que é tipo de contrato: 445 membro_club são donos de org e 223
-- master_user não são.
create or replace function public.bi_retencao_comprador(
  p_papel text default null, p_plano text default null)
returns table(grupo text, clientes bigint, pct_retidos numeric)
language sql stable set search_path to ''
as $$
  with hoje as materialized (select marts.data_referencia() d),
  primeira as materialized (
    select f.user_id, u.is_master, min(f.data_brt) as inicio
    from marts.fact_evento f
    join marts.dim_usuario u on u.user_id = f.user_id and u.e_cliente
      and (p_papel is null or u.papel = p_papel)
      and (p_plano is null or coalesce(u.plano, 'sem_plano') = p_plano)
    group by f.user_id, u.is_master
  ),
  elegiveis as materialized (
    select p.user_id, p.is_master from primeira p, hoje h where p.inicio <= h.d - 120
  ),
  retido as materialized (
    select e.is_master,
           exists (select 1 from marts.fact_evento f, hoje h
                   where f.user_id = e.user_id and f.data_brt > h.d - 30) as ativo
    from elegiveis e
  )
  select case when r.is_master then 'Comprador' else 'Convidado' end,
         count(*),
         case when count(*) >= 30 then round(avg(r.ativo::int::numeric), 4) end
  from retido r
  group by 1
  order by 3 desc nulls last;
$$;

comment on function public.bi_retencao_comprador(text, text) is
  'Retenção de quem comprou (dono de organização) contra quem entrou pelo convite dele. Mesma régua de bi_retencao_por_amplitude: elegível = 120+ dias de casa, retido = ativo nos últimos 30.';

-- 2. Mortalidade por módulo, em taxa.
--
-- O card anterior contava churned pelo último módulo usado e publicava "59%
-- param em Formações" — que mede POPULARIDADE do módulo, não mortalidade: o
-- mais usado tende a ser o último de qualquer jornada. Dividindo pela audiência
-- de cada módulo, a pergunta vira "de quem passou por aqui, quantos não
-- voltaram" — e a ordem muda: Formações 33,8%, Consultor 2,8%.
drop function if exists public.bi_churn_ultimo_modulo(text, text);

create or replace function public.bi_mortalidade_modulo(
  p_papel text default null, p_plano text default null)
returns table(modulo text, usaram bigint, pararam_ali bigint, taxa numeric)
language sql stable set search_path to ''
as $$
  with hoje as materialized (select marts.data_referencia() d),
  base as materialized (
    select u.user_id from marts.dim_usuario u
    where u.e_cliente
      and (p_papel is null or u.papel = p_papel)
      and (p_plano is null or coalesce(u.plano, 'sem_plano') = p_plano)
  ),
  vida as materialized (
    select f.user_id, max(f.data_brt) as ultima
    from marts.fact_evento f join base b on b.user_id = f.user_id
    group by f.user_id
  ),
  churned as materialized (select v.* from vida v, hoje h where v.ultima < h.d - 60),
  ultimo as materialized (
    select c.user_id,
           (array_agg(marts.modulo_do_evento(f.tipo) order by f.criado_em desc))[1] as modulo
    from churned c
    join marts.fact_evento f on f.user_id = c.user_id and f.data_brt = c.ultima
    group by c.user_id
  ),
  usou as materialized (
    select distinct t.user_id, marts.modulo_do_evento(t.tipo) as modulo
    from (select distinct f.user_id, f.tipo from marts.fact_evento f
          join base b on b.user_id = f.user_id) t
  )
  select u.modulo,
         count(distinct u.user_id),
         count(distinct ul.user_id),
         case when count(distinct u.user_id) >= 30
              then round(count(distinct ul.user_id)::numeric / count(distinct u.user_id), 4) end
  from usou u
  left join ultimo ul on ul.user_id = u.user_id and ul.modulo = u.modulo
  group by 1
  order by 4 desc nulls last;
$$;

comment on function public.bi_mortalidade_modulo(text, text) is
  'De quem usou cada módulo, que fatia teve ali a última ação antes de sumir. Taxa, não contagem: a contagem mede popularidade do módulo e não mortalidade.';

do $$
declare f text;
begin
  foreach f in array array[
    'public.bi_retencao_comprador(text, text)',
    'public.bi_mortalidade_modulo(text, text)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
