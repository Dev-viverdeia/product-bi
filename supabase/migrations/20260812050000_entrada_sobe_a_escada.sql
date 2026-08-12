-- /entrada sobe a escada de profundidade.
--
-- A tela tinha quatro cards descritivos, um diagnostico e um prescritivo: contava
-- quanto, e quase nunca comparado a que. Entram tres perguntas que o dado sustenta
-- (as duas que NAO sustentaram estao registradas no fim deste comentario, para
-- ninguem tentar de novo).
--
-- Reprovadas na medicao, de proposito fora daqui:
--   * Conversao por canal do convite. No agregado email da 60,0% e "both" 53,1%,
--     mas mes a mes as duas taxas se cruzam -- a diferenca e efeito de mistura
--     (o volume de email explodiu em 2026 e o de "both" encolheu), nao de canal.
--   * Convite de quem esta ativo converte mais. Da o contrario e por pouco:
--     56,9% de quem convidou e segue ativo contra 61,2% de quem convidou e parou.

-- 1) Tempo ate a primeira acao, separado por quem comprou e quem foi convidado.
--
-- Substitui o uso de bi_tempo_primeiro_valor no card: a distribuicao sozinha era
-- descritiva e escondia o unico corte que importa aqui. O convidado nao demora
-- mais que o comprador -- ele simplesmente nao aparece.
create or replace function public.bi_entrada_primeira_acao_por_origem()
returns table(
  faixa text, ordem integer,
  compradores bigint, pct_comprador numeric,
  convidados bigint, pct_convidado numeric,
  base_comprador bigint, base_convidado bigint)
language sql
stable
set search_path to ''
as $function$
  with ref as materialized (select marts.data_referencia() as d),
  base as (
    select u.user_id, u.is_master,
      (u.criado_em at time zone 'America/Sao_Paulo')::date as entrada
    from marts.dim_usuario u, ref r
    where u.e_cliente
      -- Safra fechada: 30 dias de carencia para todo mundo ter tido a mesma
      -- chance de agir, e teto de 180 para nao misturar era antiga com atual.
      and (u.criado_em at time zone 'America/Sao_Paulo')::date between r.d - 180 and r.d - 30
  ),
  primeira as (
    select b.user_id, b.is_master, b.entrada, min(f.data_brt) as primeira_acao
    from base b
    left join marts.fact_evento f on f.user_id = b.user_id
    group by b.user_id, b.is_master, b.entrada
  ),
  faixas as (
    select p.is_master,
      case
        when p.primeira_acao is null then 'Nunca agiu'
        when p.primeira_acao - p.entrada <= 0 then 'No mesmo dia'
        when p.primeira_acao - p.entrada <= 7 then 'Até 1 semana'
        else 'Mais de 1 semana'
      end as faixa,
      case
        when p.primeira_acao is null then 4
        when p.primeira_acao - p.entrada <= 0 then 1
        when p.primeira_acao - p.entrada <= 7 then 2
        else 3
      end as ordem
    from primeira p
  ),
  totais as (
    select count(*) filter (where is_master) as n_comprador,
           count(*) filter (where not is_master) as n_convidado
    from faixas
  )
  select f.faixa, f.ordem,
    count(*) filter (where f.is_master) as compradores,
    -- Supressao no banco, nunca na tela: abaixo de 30 no denominador a taxa nao
    -- descreve nada e o card declara o motivo em vez de desenhar ruido.
    case when t.n_comprador >= 30
      then round(count(*) filter (where f.is_master)::numeric / t.n_comprador, 4) end as pct_comprador,
    count(*) filter (where not f.is_master) as convidados,
    case when t.n_convidado >= 30
      then round(count(*) filter (where not f.is_master)::numeric / t.n_convidado, 4) end as pct_convidado,
    t.n_comprador, t.n_convidado
  from faixas f cross join totais t
  group by f.faixa, f.ordem, t.n_comprador, t.n_convidado
  order by f.ordem;
$function$;

comment on function public.bi_entrada_primeira_acao_por_origem() is
  'Tempo ate a primeira acao por origem (comprou x foi convidado). Safra fechada: entrou entre 180 e 30 dias atras da data de referencia, para todos terem tido a mesma janela.';

-- 2) O que acontece com quem nao termina o onboarding.
--
-- Comparativo com os dois grupos nomeados. O confundidor e obvio e vai declarado
-- no card: quem ja ia sumir tambem nao terminou o onboarding -- a ordem causal
-- nao sai daqui.
create or replace function public.bi_entrada_efeito_onboarding()
returns table(grupo text, clientes bigint, ativos bigint, pct_ativo numeric)
language sql
stable
set search_path to ''
as $function$
  with ref as materialized (select marts.data_referencia() as d),
  base as (
    select u.user_id, o.concluido,
      exists (
        select 1 from marts.fact_evento f, ref r2
        where f.user_id = u.user_id and f.data_brt > r2.d - 30
      ) as ativo
    from marts.dim_usuario u
    join marts.fact_onboarding o on o.user_id = u.user_id
    cross join ref r
    where u.e_cliente
      -- 120 dias de casa: sem isso, quem entrou ontem e ainda esta no onboarding
      -- entraria como "parou no meio".
      and (u.criado_em at time zone 'America/Sao_Paulo')::date < r.d - 120
  )
  select
    case when b.concluido then 'Concluiu o onboarding' else 'Parou no meio' end as grupo,
    count(*) as clientes,
    count(*) filter (where b.ativo) as ativos,
    case when count(*) >= 30
      then round(count(*) filter (where b.ativo)::numeric / count(*), 4) end as pct_ativo
  from base b
  group by 1
  order by 1;
$function$;

comment on function public.bi_entrada_efeito_onboarding() is
  'Atividade recente de quem concluiu o onboarding x parou no meio, entre clientes com 120+ dias de casa. Associacao, nao causa: quem ja ia sumir tambem nao terminou.';

-- 3) Quando o convite e aceito -- e quando deixa de ser.
--
-- Diagnostico do "quando": a mediana ate aceitar e de horas, nao de dias. O que o
-- card NAO consegue separar, e declara: convite nunca aceito pode nunca ter sido
-- enviado. O rastreamento de envio da plataforma parou em 19/abr/2026.
create or replace function public.bi_entrada_aceite_convite()
returns table(
  faixa text, ordem integer, convites bigint, pct numeric,
  mediana_horas numeric, total bigint, nunca bigint)
language sql
stable
set search_path to ''
as $function$
  with ref as materialized (select marts.data_referencia() as d),
  c as (
    select c.usado_em, c.criado_em,
      extract(epoch from (c.usado_em - c.criado_em)) / 3600 as horas
    from marts.fact_convite c, ref r
    where c.deletado_em is null
      and (c.criado_em at time zone 'America/Sao_Paulo')::date < r.d - 30
  ),
  faixas as (
    select case
        when usado_em is null then 'Nunca aceito'
        when horas < 1 then 'Menos de 1 hora'
        when horas < 24 then 'No primeiro dia'
        when horas < 168 then 'Na primeira semana'
        else 'Depois de uma semana'
      end as faixa,
      case
        when usado_em is null then 5
        when horas < 1 then 1
        when horas < 24 then 2
        when horas < 168 then 3
        else 4
      end as ordem
    from c
  ),
  resumo as (
    select count(*) as total,
      count(*) filter (where usado_em is null) as nunca,
      round((percentile_cont(0.5) within group (order by horas))::numeric, 1) as mediana
    from c
  )
  select f.faixa, f.ordem, count(*) as convites,
    case when r.total >= 30 then round(count(*)::numeric / r.total, 4) end as pct,
    r.mediana, r.total, r.nunca
  from faixas f cross join resumo r
  group by f.faixa, f.ordem, r.mediana, r.total, r.nunca
  order by f.ordem;
$function$;

comment on function public.bi_entrada_aceite_convite() is
  'Distribuicao do tempo entre criar o convite e aceita-lo, safra fechada de 30 dias. Nunca aceito NAO separa ignorado de nunca enviado: o rastreamento de envio da plataforma parou em 19/abr/2026.';

revoke execute on function public.bi_entrada_primeira_acao_por_origem() from public, anon;
revoke execute on function public.bi_entrada_efeito_onboarding() from public, anon;
revoke execute on function public.bi_entrada_aceite_convite() from public, anon;
grant execute on function public.bi_entrada_primeira_acao_por_origem() to authenticated;
grant execute on function public.bi_entrada_efeito_onboarding() to authenticated;
grant execute on function public.bi_entrada_aceite_convite() to authenticated;
