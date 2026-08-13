-- A régua e_cliente nas cinco RPCs que a auditoria pegou
--
-- Medido em 13/08/2026: dos fatos que estas funções leem, a parcela de
-- admin/interno/teste é 2,3% em aula, 8,6% em solução, 11,4% em evento e
-- 30,8% em consultor_thread. Quase um terço do uso do Consultor é o próprio
-- time testando a ferramenta de IA.
--
-- O EFEITO NÃO FOI COSMÉTICO. Em bi_ia_profundidade_conversa o total caiu de
-- 9.507 para 6.580 conversas e a ORDEM DAS FAIXAS mudou: "Parou na 1ª mensagem"
-- era a 3ª maior (15,6%) e passou a ser a 5ª (13,4%), enquanto "Duas mensagens"
-- subiu de 14,4% para 17,5%. A tela contava o teste do time como comportamento
-- de cliente, e isso invertia a leitura de onde a conversa morre.
--
-- bi_saude_rastreio ficou de FORA de propósito — ver o comment no fim.

create or replace function public.bi_ia_modo_de_entrada()
returns table(modo text, clientes bigint, voltaram bigint, pct_volta numeric, margem_pp numeric)
language sql stable set search_path to ''
as $function$
  with ref as materialized (select marts.data_referencia() as d),
  -- Régua aplicada AQUI, na origem da coorte: filtrando só o `primeiro`, todo
  -- user_id que sobra já é cliente, e as threads seguintes dele também são.
  thread as (
    select t.* from marts.fact_consultor_thread t
    join marts.dim_usuario u on u.user_id = t.user_id and u.e_cliente
  ),
  primeiro as (
    select distinct on (t.user_id) t.user_id, t.modo, t.criado_em
    from thread t order by t.user_id, t.criado_em
  ),
  elegivel as (
    select p.user_id, p.modo,
      exists (
        select 1 from thread t
        where t.user_id = p.user_id and t.criado_em > p.criado_em + interval '1 day'
      ) as voltou
    from primeiro p, ref r
    where (p.criado_em at time zone 'America/Sao_Paulo')::date < r.d - 30
  ),
  agregado as (
    select e.modo, count(*) as clientes,
      count(*) filter (where e.voltou) as voltaram,
      case when count(*) >= 30
        then round(count(*) filter (where e.voltou)::numeric / count(*), 4) end as pct_volta
    from elegivel e group by 1 having count(*) >= 30
  ),
  margem as (
    select round(200 * sqrt(sum(
      coalesce(a.pct_volta, 0) * (1 - coalesce(a.pct_volta, 0)) / nullif(a.clientes, 0)
    ))::numeric, 1) as pp from agregado a
  )
  select a.modo, a.clientes, a.voltaram, a.pct_volta, m.pp
  from agregado a cross join margem m
  order by a.clientes desc;
$function$;

create or replace function public.bi_ia_profundidade_conversa()
returns table(faixa text, ordem integer, conversas bigint, pct numeric, total bigint)
language sql stable set search_path to ''
as $function$
  with faixas as (
    select case
        when t.mensagens = 0 then 'Aberta e nunca usada'
        when t.mensagens = 1 then 'Parou na 1ª mensagem'
        when t.mensagens = 2 then 'Duas mensagens'
        when t.mensagens <= 4 then 'Três a quatro'
        when t.mensagens <= 10 then 'Cinco a dez'
        else 'Mais de dez'
      end as faixa,
      case
        when t.mensagens = 0 then 1
        when t.mensagens = 1 then 2
        when t.mensagens = 2 then 3
        when t.mensagens <= 4 then 4
        when t.mensagens <= 10 then 5
        else 6
      end as ordem
    from marts.fact_consultor_thread t
    join marts.dim_usuario u on u.user_id = t.user_id and u.e_cliente
  ),
  tot as (select count(*) as n from faixas)
  select f.faixa, f.ordem, count(*) as conversas,
    case when t.n >= 30 then round(count(*)::numeric / t.n, 4) end as pct,
    t.n
  from faixas f cross join tot t
  group by f.faixa, f.ordem, t.n
  order by f.ordem;
$function$;

create or replace function public.bi_formacoes_entrada_na_grade()
returns table(grupo text, alunos bigint, certificaram bigint, pct numeric, margem_pp numeric)
language sql stable set search_path to ''
as $function$
  with ref as materialized (select marts.data_referencia() as d),
  inicio as (
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

create or replace function public.bi_solucoes_ordem_da_tentativa()
returns table(grupo text, tentativas bigint, clientes bigint, concluidas bigint, pct numeric, margem_pp numeric)
language sql stable set search_path to ''
as $function$
  with ref as materialized (select marts.data_referencia() as d),
  p as (
    select p.user_id, p.concluido,
      row_number() over (partition by p.user_id order by p.iniciado_em, p.solution_id) as ordem,
      count(*) over (partition by p.user_id) as tentativas
    from marts.fact_progresso_solucao p
    join marts.dim_usuario u on u.user_id = p.user_id and u.e_cliente
    cross join ref r
    -- A régua entra ANTES da janela: as funções de ordem (row_number, count over)
    -- se calculam sobre o conjunto filtrado, senão a "primeira tentativa" de um
    -- cliente poderia ser a segunda contando uma tentativa de conta interna.
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

create or replace function public.bi_funil_entrada(p_dias integer default 30)
returns table(etapa text, ordem integer, quantidade bigint, pct_do_inicio numeric)
language sql stable set search_path to ''
as $function$
  with hoje as (select (now() at time zone 'America/Sao_Paulo')::date d),
  janela as (
    select c.* from marts.fact_convite c, hoje h
    where c.deletado_em is null
      and (c.criado_em at time zone 'America/Sao_Paulo')::date > h.d - p_dias
      -- A régua sai do NUMERADOR E DO DENOMINADOR. Filtrar só as etapas de baixo
      -- deixaria o funil incoerente: o convite de teste continuaria no total e
      -- derrubaria a conversão de propósito nenhum. Convite ainda não usado fica,
      -- porque não há como saber quem vai usá-lo.
      and (c.usado_por is null
           or exists (select 1 from marts.dim_usuario d
                       where d.user_id = c.usado_por and d.e_cliente))
  ),
  n as (
    select
      (select count(*) from janela) as criados,
      (select count(usado_em) from janela) as usados,
      (select count(*) from janela j
        join marts.fact_onboarding o on o.user_id = j.usado_por and o.concluido) as onboarding,
      (select count(distinct j.usado_por) from janela j
        where j.usado_por is not null
          and exists (select 1 from marts.fact_evento f where f.user_id = j.usado_por)) as primeira_acao
  )
  select e.etapa, e.ordem, e.quantidade,
         round(e.quantidade::numeric / nullif(n.criados, 0), 4)
  from n, lateral (values
    ('Convites criados', 1, n.criados),
    ('Cadastros (convite usado)', 2, n.usados),
    ('Onboarding concluído', 3, n.onboarding),
    ('1ª ação de produto', 4, n.primeira_acao)
  ) as e(etapa, ordem, quantidade)
  order by e.ordem;
$function$;

-- EXCEÇÃO DECLARADA: bi_saude_rastreio não recebe a régua.
comment on function public.bi_saude_rastreio() is
  'Mede saúde de instrumentação, não comportamento de cliente — por isso NÃO aplica a régua e_cliente, de propósito. Filtrar por cliente esconderia justamente o rastreio quebrado que só aparece no uso interno, que é o que esta função existe para encontrar. Não "corrigir".';

-- O conjunto de regras não entra na chave do cache, então sem esta purga a tela
-- serviria o texto antigo sem erro nenhum — citando um número que o card ao lado
-- não mostra mais. Quatro telas tiveram o número de base alterado pela régua.
delete from insights.achado_cache
where chave like 'entrada|%'
   or chave like 'ia|%'
   or chave like 'solucoes|%'
   or chave like 'formacoes|%';
