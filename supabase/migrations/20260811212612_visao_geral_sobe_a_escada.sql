-- Fase 2 — a Visão Geral sobe a escada de profundidade.
--
-- A tela tinha oito cards descritivos e zero comparativos ou diagnósticos: ela
-- dizia "quanto" e nunca "comparado a quê" nem "por quê". Estas funções são o
-- degrau que faltava.
--
-- Todos os percentuais nascem aqui, com supressão. A trava de CI do projeto
-- pegou a primeira versão destes cards dividindo no front, sobre um total
-- somado lá — o mesmo defeito de vinte pontos que a Fase 0 corrigiu.

-- Consumo × compromisso.
--
-- O card "Ações na plataforma" somava solution_viewed (uma visualização) com
-- mentorship_booked (um agendamento com custo real) e ordenava por contagem —
-- o que garante que o evento mais barato sempre vence.
create or replace function marts.tipo_de_acao(p_tipo text)
returns text
language sql immutable set search_path to ''
as $$
  select case p_tipo
    when 'solution_viewed' then 'consumo'
    else 'compromisso'
  end;
$$;

comment on function marts.tipo_de_acao(text) is
  'Consumo = o cliente olhou. Compromisso = o cliente produziu, concluiu ou agendou. Hoje a plataforma emite um único evento de consumo, então a razão só discrimina de verdade em Soluções — a tela declara isso.';

grant execute on function marts.tipo_de_acao(text) to authenticated;

create or replace function public.bi_acoes_por_modulo(
  p_dias integer default 30, p_papel text default null, p_plano text default null)
returns table(
  modulo text, consumo bigint, compromisso bigint, total bigint, clientes bigint,
  pct_compromisso numeric, pct_compromisso_geral numeric)
language sql stable set search_path to ''
as $$
  with por_modulo as (
    select marts.modulo_do_evento(f.tipo) as modulo,
           count(*) filter (where marts.tipo_de_acao(f.tipo) = 'consumo') as consumo,
           count(*) filter (where marts.tipo_de_acao(f.tipo) = 'compromisso') as compromisso,
           count(*) as total,
           count(distinct f.user_id) as clientes
    from marts.fact_evento f
    join marts.dim_usuario u on u.user_id = f.user_id and u.e_cliente
      and (p_papel is null or u.papel = p_papel)
      and (p_plano is null or coalesce(u.plano, 'sem_plano') = p_plano)
    where f.data_brt > (select marts.data_referencia()) - p_dias
    group by 1
  )
  select m.modulo, m.consumo, m.compromisso, m.total, m.clientes,
         -- o piso aqui é de AÇÕES, não de clientes: uma razão sobre trinta e
         -- poucos eventos oscila com um clique
         case when m.total >= 30 then round(m.compromisso::numeric / m.total, 4) end,
         case when sum(m.total) over () >= 30
              then round(sum(m.compromisso) over ()::numeric / sum(m.total) over (), 4) end
  from por_modulo m
  order by m.total desc;
$$;

-- Diagnóstico: de onde veio o número de ativos.
--
-- Crescer comprando cliente novo é o oposto de crescer retendo, e o KPI de
-- ativos não distingue os dois. Cada ativo cai em uma origem só.
create or replace function public.bi_composicao_crescimento(
  p_dias integer default 30, p_papel text default null, p_plano text default null)
returns table(categoria text, ordem integer, clientes bigint, pct numeric)
language sql stable set search_path to ''
as $$
  with hoje as materialized (select marts.data_referencia() d),
  clientes as (
    select u.user_id from marts.dim_usuario u
    where u.e_cliente
      and (p_papel is null or u.papel = p_papel)
      and (p_plano is null or coalesce(u.plano, 'sem_plano') = p_plano)
  ),
  ativos as materialized (
    select distinct f.user_id
    from marts.fact_evento f join clientes c on c.user_id = f.user_id, hoje h
    where f.data_brt > h.d - p_dias
  ),
  primeira as materialized (
    select f.user_id, min(f.data_brt) as inicio
    from marts.fact_evento f join ativos a on a.user_id = f.user_id
    group by f.user_id
  ),
  anterior as materialized (
    select distinct f.user_id
    from marts.fact_evento f join ativos a on a.user_id = f.user_id, hoje h
    where f.data_brt > h.d - 2 * p_dias and f.data_brt <= h.d - p_dias
  ),
  classificado as (
    select case
      when p.inicio > h.d - p_dias then 'Novo'
      when an.user_id is not null then 'Retido'
      else 'Reativado'
    end as categoria
    from ativos a
    join primeira p on p.user_id = a.user_id
    left join anterior an on an.user_id = a.user_id, hoje h
  )
  select categoria,
         case categoria when 'Retido' then 1 when 'Reativado' then 2 else 3 end,
         count(*),
         case when sum(count(*)) over () >= 30
              then round(count(*)::numeric / sum(count(*)) over (), 4) end
  from classificado
  group by 1 order by 2;
$$;

-- Prescritivo: quais rastreios pararam, e há quanto tempo.
--
-- Existem rastreios mortos na plataforma e nenhuma tela reportava. Sem isto,
-- uma série que atravessa a data de morte de um evento vira "queda de
-- comportamento" — e alguém decide em cima disso.
--
-- Os dias sem registro contam a partir da data de referência do dado, não de
-- now(): com o pipeline parado, now() marcaria todo rastreio como morto.
create or replace function public.bi_saude_rastreio()
returns table(
  tipo text, modulo text, ultimo_registro date, dias_parado integer,
  eventos_total bigint, status text)
language sql stable set search_path to ''
as $$
  with hoje as materialized (select marts.data_referencia() d),
  por_tipo as (
    select f.tipo,
           marts.modulo_do_evento(f.tipo) as modulo,
           max(f.data_brt) as ultimo,
           count(*) as eventos
    from marts.fact_evento f
    group by 1, 2
  )
  select t.tipo, t.modulo, t.ultimo,
         (h.d - t.ultimo)::integer,
         t.eventos,
         case when h.d - t.ultimo <= 7 then 'ativo'
              when h.d - t.ultimo <= 30 then 'atrasado'
              else 'parado' end
  from por_tipo t, hoje h
  order by (h.d - t.ultimo) desc, t.eventos desc;
$$;

comment on function public.bi_saude_rastreio() is
  'Última data com registro por tipo de evento. Rastreio parado é dependência do time da plataforma, não defeito do BI — por isso a tela produz a lista em vez de esconder o buraco.';

do $$
declare f text;
begin
  foreach f in array array[
    'public.bi_acoes_por_modulo(integer, text, text)',
    'public.bi_composicao_crescimento(integer, text, text)',
    'public.bi_saude_rastreio()'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
