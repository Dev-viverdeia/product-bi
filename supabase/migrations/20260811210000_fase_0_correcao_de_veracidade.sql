-- Fase 0 — correção de veracidade.
--
-- Não dá para construir a camada de resumo sobre número errado: ela amplifica o
-- que estiver embaixo. Estas são as correções que precisam vir antes, todas
-- independentes do pipeline voltar. Diagnóstico completo em
-- docs/proposta-fase-2-profundidade.md §5.
--
-- 1. Âncora de janela: marts.data_referencia() em vez de now()
-- 2. Percentual que era calculado no front (e escapava da supressão)
-- 3. Duração ideal de aula medindo curso não publicado
-- 4. NPS sem a régua e_cliente

-- ============ 1 · ÂNCORA DE JANELA ============

-- Toda janela do produto era ancorada em now(). Com o pipeline parado desde
-- 08/08 e now() em 11/08, "últimos 30 dias" virou 27 dias de dado comparados
-- com 30 do período anterior — e o delta passou a medir a parada do pipeline,
-- não o comportamento do cliente. É o mesmo defeito de "Pageviews +313,3%" da
-- auditoria de 08/ago, em outra roupa.
--
-- A âncora passa a ser o último dia com dado. Quando o pipeline está saudável,
-- data_referencia() = hoje e nada muda; quando para, as janelas continuam do
-- tamanho certo e o delta compara períodos comparáveis.
--
-- fact_evento é a fonte da régua "ativo" (contrato da E2), então é ela quem
-- define a data de referência do produto. As funções de CS ficam de fora de
-- propósito: a fonte delas é outra (Pulse) e terá o frescor próprio.
create or replace function marts.data_referencia()
returns date
language sql stable set search_path to ''
as $$
  select coalesce(
    (select max(data_brt) from marts.fact_evento),
    (now() at time zone 'America/Sao_Paulo')::date
  );
$$;

comment on function marts.data_referencia() is
  'Último dia com dado carregado — âncora de toda janela de análise. Substitui now() para que a parada do pipeline encurte o histórico em vez de falsear o delta.';

grant execute on function marts.data_referencia() to authenticated;

drop function public.bi_visao_geral_kpis(integer, text, text);

create function public.bi_visao_geral_kpis(
  p_dias integer default 30, p_papel text default null, p_plano text default null)
returns table(
  ativos bigint, ativos_ant bigint, novos bigint, novos_ant bigint,
  aulas bigint, aulas_ant bigint, pageviews bigint, pageviews_ant bigint)
language sql stable set search_path to ''
as $$
  with hoje as (select marts.data_referencia() d),
  clientes as (
    select u.user_id, u.criado_em from marts.dim_usuario u
    where u.e_cliente
      and (p_papel is null or u.papel = p_papel)
      and (p_plano is null or coalesce(u.plano, 'sem_plano') = p_plano)
  ),
  rastreio as (select min(data_brt) as inicio from marts.fact_pageview),
  comparavel as (
    select (h.d - 2 * p_dias) >= r.inicio as ok from hoje h, rastreio r
  ),
  n as (
    select
      (select count(distinct f.user_id) from marts.fact_evento f
         join clientes c on c.user_id = f.user_id, hoje
        where f.data_brt > hoje.d - p_dias) as ativos,
      (select count(distinct f.user_id) from marts.fact_evento f
         join clientes c on c.user_id = f.user_id, hoje
        where f.data_brt > hoje.d - 2*p_dias and f.data_brt <= hoje.d - p_dias) as ativos_ant,
      (select count(*) from clientes c, hoje
        where (c.criado_em at time zone 'America/Sao_Paulo')::date > hoje.d - p_dias) as novos,
      (select count(*) from clientes c, hoje
        where (c.criado_em at time zone 'America/Sao_Paulo')::date > hoje.d - 2*p_dias
          and (c.criado_em at time zone 'America/Sao_Paulo')::date <= hoje.d - p_dias) as novos_ant,
      (select count(*) from marts.fact_evento f join clientes c on c.user_id = f.user_id, hoje
        where f.tipo = 'lesson_completed' and f.data_brt > hoje.d - p_dias) as aulas,
      (select count(*) from marts.fact_evento f join clientes c on c.user_id = f.user_id, hoje
        where f.tipo = 'lesson_completed'
          and f.data_brt > hoje.d - 2*p_dias and f.data_brt <= hoje.d - p_dias) as aulas_ant,
      (select count(*) from marts.fact_pageview p join clientes c on c.user_id = p.user_id, hoje
        where p.data_brt > hoje.d - p_dias) as pageviews,
      (select case when (select ok from comparavel) then
         (select count(*) from marts.fact_pageview p join clientes c on c.user_id = p.user_id, hoje
           where p.data_brt > hoje.d - 2*p_dias and p.data_brt <= hoje.d - p_dias)
       end) as pageviews_ant
  )
  select
    n.ativos,    case when n.ativos    >= 30 and n.ativos_ant    >= 30 then n.ativos_ant    end,
    n.novos,     case when n.novos     >= 30 and n.novos_ant     >= 30 then n.novos_ant     end,
    n.aulas,     case when n.aulas     >= 30 and n.aulas_ant     >= 30 then n.aulas_ant     end,
    n.pageviews, case when n.pageviews >= 30 and n.pageviews_ant >= 30 then n.pageviews_ant end
  from n;
$$;

-- "dias inativo" contado a partir de now() engorda a lista sozinho a cada dia
-- de pipeline parado: em duas semanas de parada, toda a base entra em risco sem
-- que nada tenha acontecido. Ancorado no dado, a lista fica estável enquanto o
-- dado estiver.
drop function public.bi_clientes_em_risco(integer, text, text);

create function public.bi_clientes_em_risco(
  p_limite integer default 30, p_papel text default null, p_plano text default null)
returns table(
  nome text, email text, organizacao text, plano text, motivo text,
  ultima_atividade date, dias_inativo integer, dias_ate_vencer integer)
language sql stable set search_path to ''
as $$
  with hoje as (select marts.data_referencia() d),
  ult as (
    select f.user_id, max(f.data_brt) as ultima
    from marts.fact_evento f
    group by f.user_id
  ),
  inatividade as (
    select u.nome, u.email, u.organizacao,
           coalesce(u.plano_display, u.plano) as plano,
           'inatividade'::text as motivo,
           l.ultima as ultima_atividade,
           (h.d - l.ultima)::integer as dias_inativo,
           null::integer as dias_ate_vencer
    from marts.dim_usuario u
    join ult l on l.user_id = u.user_id
    cross join hoje h
    where u.e_cliente
      and (p_papel is null or u.papel = p_papel)
      and (p_plano is null or coalesce(u.plano, 'sem_plano') = p_plano)
      and l.ultima < h.d - 14
      and l.ultima >= h.d - 74
  ),
  vencimento as (
    select u.nome as nome, u.email as email,
           coalesce(s.organizacao, u.organizacao) as organizacao,
           coalesce(s.plano, u.plano_display, u.plano) as plano,
           'plano_vencendo'::text as motivo,
           l.ultima as ultima_atividade,
           (h.d - l.ultima)::integer as dias_inativo,
           s.days_until_expiry as dias_ate_vencer
    from marts.master_snapshot s
    join marts.dim_usuario u on u.user_id = s.master_user_id and u.e_cliente
      and (p_papel is null or u.papel = p_papel)
      and (p_plano is null or coalesce(u.plano, 'sem_plano') = p_plano)
    left join ult l on l.user_id = s.master_user_id
    cross join hoje h
    where s.days_until_expiry between 0 and 30
      and (l.ultima is null or l.ultima < h.d - 7)
  )
  select * from (
    select * from vencimento
    union all
    select * from inatividade
  ) r
  order by case r.motivo when 'plano_vencendo' then 0 else 1 end,
           r.dias_ate_vencer nulls last,
           r.dias_inativo desc
  limit p_limite;
$$;

-- ============ 2 · PERCENTUAL SAI DO FRONT ============

-- O headline "ativos em mais de um dia" mostrava 37,2% e a resposta é 57,1%:
-- o front fazia `faixa.startsWith('1')` e subtraía o balde "1–2 dias" INTEIRO,
-- descartando os 665 clientes ativos em exatamente dois dias. Além do erro de
-- 20 pontos, o cálculo no front escapa da régua de supressão — contagem nunca é
-- suprimida, então num recorte estreito a tela imprimia percentual sobre
-- denominador abaixo de 30.
--
-- pct_mais_de_um_dia entra aqui, ao lado dos outros percentuais da tela, com a
-- mesma supressão.
drop function public.bi_engajamento_clientes(integer, text, text);

create function public.bi_engajamento_clientes(
  p_dias integer default 30, p_papel text default null, p_plano text default null)
returns table(
  mau bigint, dau_medio numeric, stickiness numeric, pct_habito_semanal numeric,
  dias_ativos_medio numeric, pct_multimodulo numeric, pct_mais_de_um_dia numeric,
  base_habito bigint)
language sql stable set search_path to ''
as $$
  with hoje as (select marts.data_referencia() d),
  atv as (
    select f.user_id, f.data_brt, f.tipo
    from marts.fact_evento f
    join marts.dim_usuario u on u.user_id = f.user_id and u.e_cliente
      and (p_papel is null or u.papel = p_papel)
      and (p_plano is null or coalesce(u.plano, 'sem_plano') = p_plano), hoje h
    where f.data_brt > h.d - p_dias
  ),
  por_usuario as (
    select user_id,
           count(distinct data_brt) as dias_ativos,
           count(distinct marts.modulo_do_evento(tipo)) as modulos
    from atv group by user_id
  ),
  por_dia as (
    select data_brt, count(distinct user_id) as dau from atv group by data_brt
  ),
  habito as (
    select f.user_id, count(distinct ((h.d - 1 - f.data_brt) / 7)) as semanas
    from marts.fact_evento f
    join marts.dim_usuario u on u.user_id = f.user_id and u.e_cliente
      and (p_papel is null or u.papel = p_papel)
      and (p_plano is null or coalesce(u.plano, 'sem_plano') = p_plano), hoje h
    where f.data_brt > h.d - 28 and f.data_brt <= h.d
    group by f.user_id
  )
  select
    (select count(*) from por_usuario),
    round((select avg(dau) from por_dia), 1),
    case when (select count(*) from por_usuario) >= 30 then
      round((select avg(dau) from por_dia) / nullif((select count(*) from por_usuario), 0), 4) end,
    case when (select count(*) from habito) >= 30 then
      round((select count(*) filter (where semanas >= 3) from habito)::numeric
        / nullif((select count(*) from habito), 0), 4) end,
    case when (select count(*) from por_usuario) >= 30 then
      round((select avg(dias_ativos) from por_usuario), 1) end,
    case when (select count(*) from por_usuario) >= 30 then
      round((select count(*) filter (where modulos >= 2) from por_usuario)::numeric
        / nullif((select count(*) from por_usuario), 0), 4) end,
    case when (select count(*) from por_usuario) >= 30 then
      round((select count(*) filter (where dias_ativos > 1) from por_usuario)::numeric
        / nullif((select count(*) from por_usuario), 0), 4) end,
    (select count(*) from habito);
$$;

-- Mesma história: a página dividia a maior fatia pelo total para dizer "59%
-- param em Formações". A fatia sai calculada e suprimida.
drop function public.bi_churn_ultimo_modulo(text, text);

create function public.bi_churn_ultimo_modulo(
  p_papel text default null, p_plano text default null)
returns table(modulo text, clientes bigint, pct numeric)
language sql stable set search_path to ''
as $$
  with hoje as (select marts.data_referencia() d),
  vida as (
    select f.user_id, max(f.data_brt) as ultima
    from marts.fact_evento f
    join marts.dim_usuario u on u.user_id = f.user_id and u.e_cliente
      and (p_papel is null or u.papel = p_papel)
      and (p_plano is null or coalesce(u.plano, 'sem_plano') = p_plano)
    group by f.user_id
  ),
  churned as (select v.user_id, v.ultima from vida v, hoje h where v.ultima < h.d - 60),
  ultimo as (
    select c.user_id,
           (array_agg(marts.modulo_do_evento(f.tipo) order by f.criado_em desc))[1] as modulo
    from churned c
    join marts.fact_evento f on f.user_id = c.user_id and f.data_brt = c.ultima
    group by c.user_id
  )
  select modulo,
         count(*),
         case when sum(count(*)) over () >= 30
              then round(count(*)::numeric / sum(count(*)) over (), 4) end
  from ultimo group by 1 order by 2 desc;
$$;

-- ============ 3 · DURAÇÃO IDEAL MEDIA CURSO NÃO PUBLICADO ============

-- A função filtrava `aula.publicada` e nunca o CURSO. Medido: 11 cursos não
-- publicados contêm 172 aulas publicadas, das quais 76 têm 30+ min — contra
-- apenas 2 aulas longas nos 48 cursos publicados. Ou seja, praticamente toda a
-- evidência sobre aula longa vinha de conteúdo que o aluno não alcança pelo
-- caminho normal, e era ela que formava o precipício do gráfico.
--
-- Com o curso publicado no filtro, a direção se mantém (aula curta conclui
-- mais) mas a queda é muito menor, e as faixas longas ficam sem lastro. A tela
-- passa a declarar isso em vez de recomendar sobre 2 aulas.
--
-- Piso de 10 aulas por faixa: a taxa aqui é média de taxas POR AULA, então o
-- denominador é o número de aulas da faixa, não de clientes — a régua de 30
-- clientes não se aplica. Dez é o mínimo para uma média de taxas dizer algo, e
-- o número de aulas continua visível na resposta para a tela declarar o corte.
drop function public.bi_duracao_ideal();

create function public.bi_duracao_ideal()
returns table(faixa text, ordem integer, aulas bigint, taxa_media numeric)
language sql stable set search_path to ''
as $$
  with conc as (
    select a.curso_id, a.id as lesson_id, a.duracao_s, count(*) as n
    from marts.dim_aula a
    join marts.dim_curso c on c.id = a.curso_id and c.publicado
    join marts.fact_progresso_aula f on f.lesson_id = a.id and f.concluido_em is not null
    join marts.dim_usuario u on u.user_id = f.user_id and u.e_cliente
    where a.publicada and a.duracao_s > 0
    group by a.curso_id, a.id, a.duracao_s
  ),
  cursos_estaveis as (
    select curso_id, max(n) as mx from conc group by curso_id having max(n) >= 50
  ),
  taxas as (
    select c.duracao_s, c.n::numeric / ce.mx as taxa
    from conc c join cursos_estaveis ce on ce.curso_id = c.curso_id
  )
  select faixa, ordem, count(*),
         case when count(*) >= 10 then round(avg(taxa), 4) end
  from (
    select taxa,
      case
        when duracao_s < 300 then 'Até 5 min' when duracao_s < 600 then '5–10 min'
        when duracao_s < 1200 then '10–20 min' when duracao_s < 1800 then '20–30 min'
        when duracao_s < 3600 then '30–60 min' else '60+ min'
      end as faixa,
      case
        when duracao_s < 300 then 1 when duracao_s < 600 then 2
        when duracao_s < 1200 then 3 when duracao_s < 1800 then 4
        when duracao_s < 3600 then 5 else 6
      end as ordem
    from taxas
  ) s
  group by faixa, ordem order by ordem;
$$;

comment on function public.bi_duracao_ideal() is
  'Taxa de conclusão por faixa de duração, só em curso E aula publicados. taxa_media null = faixa com menos de 10 aulas, sem lastro para média.';

-- ============ 4 · NPS SEM A RÉGUA DE CLIENTE ============

-- Três dos quatro KPIs de Formações aplicam e_cliente; o NPS não aplicava, e
-- por isso media aluno interno e conta de teste junto. A régua vale em toda
-- métrica de uso, sem exceção (auditoria de 08/ago).
drop function public.bi_formacoes_kpis(integer);

create function public.bi_formacoes_kpis(p_dias integer default 30)
returns table(alunos_ativos bigint, aulas_concluidas bigint, certificados bigint, nps_medio numeric)
language sql stable set search_path to ''
as $$
  with hoje as (select marts.data_referencia() d)
  select
    (select count(distinct f.user_id)
     from marts.fact_progresso_aula f
     join marts.dim_usuario u on u.user_id = f.user_id and u.e_cliente, hoje h
     where f.concluido_em is not null
       and (f.concluido_em at time zone 'America/Sao_Paulo')::date > h.d - p_dias),
    (select count(*)
     from marts.fact_progresso_aula f
     join marts.dim_usuario u on u.user_id = f.user_id and u.e_cliente, hoje h
     where f.concluido_em is not null
       and (f.concluido_em at time zone 'America/Sao_Paulo')::date > h.d - p_dias),
    (select count(*)
     from marts.fact_certificado c
     join marts.dim_usuario u on u.user_id = c.user_id and u.e_cliente, hoje h
     where (c.emitido_em at time zone 'America/Sao_Paulo')::date > h.d - p_dias),
    (select round(avg(n.score), 2)
     from marts.fact_nps_aula n
     join marts.dim_usuario u on u.user_id = n.user_id and u.e_cliente, hoje h
     where (n.criado_em at time zone 'America/Sao_Paulo')::date > h.d - p_dias);
$$;

-- ============ PERMISSÕES ============

do $$
declare f text;
begin
  foreach f in array array[
    'public.bi_visao_geral_kpis(integer, text, text)',
    'public.bi_clientes_em_risco(integer, text, text)',
    'public.bi_engajamento_clientes(integer, text, text)',
    'public.bi_churn_ultimo_modulo(text, text)',
    'public.bi_duracao_ideal()',
    'public.bi_formacoes_kpis(integer)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
