-- /organizacoes sobe a escada.
--
-- Tinha um descritivo, um comparativo e dois prescritivos -- e nenhum
-- diagnostico: a tela dizia quem esta mal e para quem ligar, nunca onde nem por
-- que. Entram um comparativo e os dois diagnosticos.
--
-- Medida e REPROVADA: "comprar mais assento do que precisa prediz time parado".
-- Orgs com sobra de assento tem 39,4% de contas zeradas contra 8,9% das quase
-- cheias -- mas isso e TAMANHO disfarcado de sobra: as orgs com folga tem 1,5
-- membro em media, e org de uma pessoa so e 0% ou 100% ativa. A media de time
-- ativo ate inverte o sinal (51,8% x 45,5%). O tamanho virou card proprio.

-- 1) Quanto maior o time, menor a fatia que aparece.
--
-- Taxa AGREGADA (pessoas ativas / pessoas), nao media das organizacoes: media de
-- org mistura conta de uma pessoa com conta de cem, e org de uma pessoa so
-- assume 0% ou 100%. As duas contas vao juntas no card justamente para mostrar
-- que aqui elas concordam -- o gradiente nao e artefato de agregacao.
create or replace function public.bi_orgs_por_tamanho()
returns table(
  faixa text, ordem integer, orgs bigint, pessoas bigint, ativos bigint,
  taxa numeric, media_das_orgs numeric, margem_pp numeric)
language sql
stable
set search_path to ''
as $function$
  with base as (
    select
      case when v.membros <= 5 then 'Até 5 pessoas'
           when v.membros <= 20 then '6 a 20 pessoas'
           else 'Mais de 20 pessoas' end as faixa,
      case when v.membros <= 5 then 1
           when v.membros <= 20 then 2
           else 3 end as ordem,
      v.membros, v.ativos_30d, v.pct_time_ativo
    from marts.v_saude_organizacao v
    where v.ativa and v.membros > 0
  ),
  agregado as (
    select b.faixa, b.ordem, count(*) as orgs,
      sum(b.membros) as pessoas, sum(b.ativos_30d) as ativos,
      case when sum(b.membros) >= 30
        then round(sum(b.ativos_30d)::numeric / sum(b.membros), 4) end as taxa,
      round(avg(b.pct_time_ativo)::numeric, 4) as media_das_orgs
    from base b group by b.faixa, b.ordem
  ),
  -- Margem entre as duas pontas: e a comparacao que o card afirma.
  margem as (
    select round(200 * sqrt(sum(
      coalesce(a.taxa, 0) * (1 - coalesce(a.taxa, 0)) / nullif(a.pessoas, 0)
    ))::numeric, 1) as pp
    from agregado a where a.ordem in (1, 3)
  )
  select a.faixa, a.ordem, a.orgs, a.pessoas, a.ativos, a.taxa, a.media_das_orgs, m.pp
  from agregado a cross join margem m
  order by a.ordem;
$function$;

comment on function public.bi_orgs_por_tamanho() is
  'Fatia do time ativa por faixa de tamanho da organizacao. Taxa agregada por pessoa e media por organizacao lado a lado, de proposito: quando as duas concordam o gradiente nao e artefato de agregacao.';

-- 2) Onde estao as contas e onde estao as pessoas.
--
-- O diagnostico que faltava, e o que destrava a regra recusada em 12/ago
-- (org_time_morto): agora o total de conta zerada existe num card. O ponto do
-- card e o contraste -- contar organizacao e contar gente aponta para lugares
-- diferentes, e a decisao muda conforme qual das duas se olha.
create or replace function public.bi_orgs_distribuicao_engajamento()
returns table(
  faixa text, ordem integer, orgs bigint, pct_orgs numeric,
  pessoas bigint, pct_pessoas numeric, total_orgs bigint, total_pessoas bigint)
language sql
stable
set search_path to ''
as $function$
  with base as (
    select
      case
        when v.membros = 0 then 'Sem membro nenhum'
        when v.ativos_30d = 0 then 'Ninguém ativo'
        when v.pct_time_ativo < 0.25 then 'Menos de 25% ativo'
        when v.pct_time_ativo < 0.5 then '25% a 50%'
        when v.pct_time_ativo < 1 then '50% a 99%'
        else 'Time inteiro ativo'
      end as faixa,
      case
        when v.membros = 0 then 1
        when v.ativos_30d = 0 then 2
        when v.pct_time_ativo < 0.25 then 3
        when v.pct_time_ativo < 0.5 then 4
        when v.pct_time_ativo < 1 then 5
        else 6
      end as ordem,
      v.membros
    from marts.v_saude_organizacao v
    where v.ativa
  ),
  tot as (select count(*) as n_orgs, sum(membros) as n_pessoas from base)
  select b.faixa, b.ordem, count(*) as orgs,
    case when t.n_orgs >= 30 then round(count(*)::numeric / t.n_orgs, 4) end as pct_orgs,
    sum(b.membros) as pessoas,
    case when t.n_pessoas >= 30
      then round(sum(b.membros)::numeric / t.n_pessoas, 4) end as pct_pessoas,
    t.n_orgs, t.n_pessoas
  from base b cross join tot t
  group by b.faixa, b.ordem, t.n_orgs, t.n_pessoas
  order by b.ordem;
$function$;

comment on function public.bi_orgs_distribuicao_engajamento() is
  'Organizacoes ativas por faixa de time ativo, com a contagem de contas e a de pessoas lado a lado. As duas apontam para faixas diferentes -- e o ponto do card.';

-- 3) Quando a conta esfria, quem parou primeiro?
--
-- Le a ordem no tempo, nao a correlacao: e o degrau seguinte ao card do efeito
-- do master. Janela de 14 dias para nao chamar de "antes" o que e a mesma
-- semana.
--
-- O que o card NAO consegue dizer, e declara: organizacao onde um dos lados
-- nunca registrou acao fica de fora (nao esfriou, nunca esquentou), e master
-- que delegou o uso aparece como "parou" sem ter abandonado.
create or replace function public.bi_orgs_quem_parou_primeiro()
returns table(
  quem text, ordem integer, orgs bigint, pct numeric,
  base_com_historico bigint, fora_sem_historico bigint)
language sql
stable
set search_path to ''
as $function$
  with ref as materialized (select marts.data_referencia() as d),
  ult as materialized (
    select f.user_id, max(f.data_brt) as ultima from marts.fact_evento f group by f.user_id
  ),
  org as (
    select o.id,
      (select l.ultima from ult l where l.user_id = o.master_user_id) as master_ultima,
      (select max(l.ultima) from ult l
         join marts.dim_usuario u on u.user_id = l.user_id
        where u.organization_id = o.id and u.e_cliente and u.user_id <> o.master_user_id
      ) as time_ultima
    from marts.dim_organizacao o
    where o.ativa and o.master_user_id is not null
  ),
  esfriou as (
    select * from org, ref r
    where org.master_ultima is null or org.master_ultima < r.d - 30
  ),
  com_historico as (
    select
      case
        when e.master_ultima < e.time_ultima - 14 then 'O master parou antes'
        when e.time_ultima < e.master_ultima - 14 then 'O time parou antes'
        else 'Pararam na mesma janela'
      end as quem,
      case
        when e.master_ultima < e.time_ultima - 14 then 1
        when e.time_ultima < e.master_ultima - 14 then 3
        else 2
      end as ordem
    from esfriou e
    where e.master_ultima is not null and e.time_ultima is not null
  ),
  tot as (
    select (select count(*) from com_historico) as n,
           (select count(*) from esfriou e
             where e.master_ultima is null or e.time_ultima is null) as fora
  )
  select c.quem, c.ordem, count(*) as orgs,
    case when t.n >= 30 then round(count(*)::numeric / t.n, 4) end as pct,
    t.n, t.fora
  from com_historico c cross join tot t
  group by c.quem, c.ordem, t.n, t.fora
  order by c.ordem;
$function$;

comment on function public.bi_orgs_quem_parou_primeiro() is
  'Entre organizacoes cujo master esta parado ha 30+ dias, quem registrou a ultima acao primeiro. Exclui organizacao sem historico de um dos lados: essa nao esfriou, nunca esquentou.';

revoke execute on function public.bi_orgs_por_tamanho() from public, anon;
revoke execute on function public.bi_orgs_distribuicao_engajamento() from public, anon;
revoke execute on function public.bi_orgs_quem_parou_primeiro() from public, anon;
grant execute on function public.bi_orgs_por_tamanho() to authenticated;
grant execute on function public.bi_orgs_distribuicao_engajamento() to authenticated;
grant execute on function public.bi_orgs_quem_parou_primeiro() to authenticated;
