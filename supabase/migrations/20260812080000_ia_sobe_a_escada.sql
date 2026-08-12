-- /ia sobe a escada.
--
-- Tinha tres descritivos, um comparativo e um diagnostico, e nenhum prescritivo.
-- Entram um de cada um dos que faltavam.
--
-- Medidas e REPROVADAS:
--   * "A IA deixa pergunta sem resposta". Nao deixa: sao 1,34 mensagem do
--     assistente por mensagem do usuario, e so 126 dos 5.864 dias-usuario tem
--     menos resposta que pergunta. Nao ha problema de confiabilidade a reportar.
--   * "Credito de mentoria parado vira lista de acao". O dado existe
--     (marts.fact_credito_mentoria) e mostra 58 sessoes estrategicas disponiveis
--     e ZERO usadas -- mas sao 47 pessoas, e o assunto ja tem card proprio em
--     /organizacoes ("Valor contratado e nao consumido"). Repetir aqui seria dois
--     donos para o mesmo numero.

-- 1) Por qual porta o cliente entra no Consultor -- e isso muda se ele volta.
create or replace function public.bi_ia_modo_de_entrada()
returns table(
  modo text, clientes bigint, voltaram bigint, pct_volta numeric, margem_pp numeric)
language sql
stable
set search_path to ''
as $function$
  with ref as materialized (select marts.data_referencia() as d),
  -- A PRIMEIRA thread de cada pessoa: e a porta de entrada. Usar todas as
  -- threads mediria preferencia de quem ja ficou, que e outra pergunta.
  primeiro as (
    select distinct on (t.user_id) t.user_id, t.modo, t.criado_em
    from marts.fact_consultor_thread t
    order by t.user_id, t.criado_em
  ),
  elegivel as (
    select p.user_id, p.modo,
      exists (
        select 1 from marts.fact_consultor_thread t
        where t.user_id = p.user_id and t.criado_em > p.criado_em + interval '1 day'
      ) as voltou
    from primeiro p, ref r
    -- 30 dias de carencia: quem estreou ontem ainda nao teve chance de voltar.
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

comment on function public.bi_ia_modo_de_entrada() is
  'Taxa de retorno ao Consultor por modo da PRIMEIRA conversa, entre quem estreou ha 30+ dias. Modo com menos de 30 estreantes nao aparece.';

-- 2) Onde a conversa para.
--
-- Diagnostico do "onde", com o confundidor declarado no card: conversa curta
-- tambem descreve pergunta respondida de primeira, e resposta boa encerra o
-- assunto. O numero sozinho nao separa as duas coisas.
create or replace function public.bi_ia_profundidade_conversa()
returns table(faixa text, ordem integer, conversas bigint, pct numeric, total bigint)
language sql
stable
set search_path to ''
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
  ),
  tot as (select count(*) as n from faixas)
  select f.faixa, f.ordem, count(*) as conversas,
    case when t.n >= 30 then round(count(*)::numeric / t.n, 4) end as pct,
    t.n
  from faixas f cross join tot t
  group by f.faixa, f.ordem, t.n
  order by f.ordem;
$function$;

comment on function public.bi_ia_profundidade_conversa() is
  'Distribuicao das conversas do Consultor por numero de mensagens. Conversa curta nao e necessariamente falha: pode ser pergunta respondida de primeira.';

-- 3) Lista de acao: experimentou a IA, nao voltou, e ainda esta no produto.
--
-- E o recorte que faz a lista valer. Quem sumiu do produto inteiro e problema de
-- retencao e ja tem lista propria em /clientes; quem continua aparecendo e
-- parou de usar a IA especificamente esta ao alcance de um empurrao.
--
-- Devolve nome e email seguindo o mesmo modelo de public.bi_clientes_em_risco --
-- ver pendencia registrada no roadmap sobre alinhar as listas nomeadas.
create or replace function public.bi_ia_experimentaram_e_sumiram(p_limite integer default 30)
returns table(
  nome text, email text, organizacao text, plano text,
  ultima_conversa date, dias_sem_ia integer, ativo_no_produto boolean)
language sql
stable
set search_path to ''
as $function$
  with ref as materialized (select marts.data_referencia() as d),
  uso as (
    select t.user_id,
      count(distinct (t.criado_em at time zone 'America/Sao_Paulo')::date) as dias,
      max((t.criado_em at time zone 'America/Sao_Paulo')::date) as ultima
    from marts.fact_consultor_thread t
    group by t.user_id
  )
  select u.nome, u.email, u.organizacao,
    coalesce(u.plano_display, u.plano) as plano,
    x.ultima as ultima_conversa,
    (r.d - x.ultima)::integer as dias_sem_ia,
    true as ativo_no_produto
  from uso x
  join marts.dim_usuario u on u.user_id = x.user_id and u.e_cliente
  cross join ref r
  where x.dias = 1
    and x.ultima < r.d - 30
    and exists (
      select 1 from marts.fact_evento f
      where f.user_id = x.user_id and f.data_brt > r.d - 30
    )
  order by x.ultima desc
  limit p_limite;
$function$;

comment on function public.bi_ia_experimentaram_e_sumiram(integer) is
  'Clientes que usaram o Consultor em UM unico dia, nao voltaram ha 30+ dias e seguem ativos no produto. Lista de acao: estao ao alcance porque continuam aparecendo.';

revoke execute on function public.bi_ia_modo_de_entrada() from public, anon;
revoke execute on function public.bi_ia_profundidade_conversa() from public, anon;
revoke execute on function public.bi_ia_experimentaram_e_sumiram(integer) from public, anon;
grant execute on function public.bi_ia_modo_de_entrada() to authenticated;
grant execute on function public.bi_ia_profundidade_conversa() to authenticated;
grant execute on function public.bi_ia_experimentaram_e_sumiram(integer) to authenticated;
