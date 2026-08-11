-- Fase 1 — motor de achados determinístico.
--
-- O bloco "Resumo e direcionamento" de cada tela sai daqui. Três decisões de
-- desenho, todas registradas em docs/proposta-fase-2-profundidade.md §3:
--
-- 1. **O achado é calculado, não redigido.** Não há modelo de linguagem no
--    caminho. A frase vem de um gabarito versionado no catálogo; os números
--    vêm da mesma função que o card desenha.
--
-- 2. **O motor só lê `public.bi_*`.** Nunca `marts.` nem `etl.`. É o que
--    garante que o número da frase é O MESMO número do card — não uma segunda
--    conta que pode divergir. Um teste no CI reprova o contrário.
--
-- 3. **Zero literal numérico no gabarito.** A régua viaja em `parametros`
--    (`janela_churn: 60`), emitida pela mesma função que calcula. Se a janela
--    mudar na função, a frase acompanha sozinha. Teste no CI reprova gabarito
--    com dígito.
--
-- Duas travas estatísticas, porque com 60 recortes por tela achado falso é
-- garantido sem elas:
--   · piso de amostra: herdado das RPCs, que já devolvem null abaixo de 30;
--   · margem: diferença entre dois grupos só vira achado se passar de dois
--     erros padrão da própria estimativa. É o que impede a tela de afirmar
--     "Master retém mais que Membro do Club" — 2,6 pontos com margem de 5,9.

create schema if not exists insights;

comment on schema insights is
  'Catálogo de regras do motor de achados. Fora da API REST: a tela lê pelas funções bi_* do public.';

-- ============ CATÁLOGO ============

-- Populado por migration e sem escrita em runtime. O ciclo lento é o recurso:
-- impede afrouxar a régua na semana em que o bloco ficou vazio.
create table if not exists insights.regra (
  id                text primary key,
  tela              text not null,
  familia           text not null,
  titulo            text not null,
  pergunta          text not null,
  gabarito          text not null,
  gabarito_acao     text not null,
  limiar_descricao  text not null,
  ancora_aba        text,
  ancora_id         text not null,
  ordem             integer not null
);

comment on table insights.regra is
  'Uma linha por pergunta que o motor sabe fazer. O gabarito é a frase, com marcadores {nome:formato} preenchidos pela função de achados.';
comment on column insights.regra.familia is
  'Duas regras da mesma família nunca aparecem juntas — senão a tela diz a mesma coisa com palavras diferentes.';
comment on column insights.regra.limiar_descricao is
  'O limiar em português, para a página /regras. O valor efetivo vive na função, versionado nesta migration.';

alter table insights.regra enable row level security;

-- Policy de leitura obrigatória, não opcional: as RPCs são SECURITY INVOKER, e
-- RLS ligada sem policy faz o join do motor devolver ZERO LINHA em silêncio,
-- sem erro nenhum. É a armadilha registrada no CLAUDE.md, e ela cobrou o preço
-- aqui: o bloco chegou a dizer "As 0 regras desta tela foram avaliadas".
--
-- O catálogo é público por natureza — é a lista de perguntas que o resumo sabe
-- fazer, e a página /regras existe para mostrá-la.
grant usage on schema insights to authenticated;
grant select on insights.regra to authenticated;

drop policy if exists leitura_bi on insights.regra;
create policy leitura_bi on insights.regra
  for select to authenticated using (true);

delete from insights.regra;

insert into insights.regra
  (id, tela, familia, titulo, pergunta, gabarito, gabarito_acao, limiar_descricao, ancora_aba, ancora_id, ordem)
values
  ('cli_gap_papel', 'clientes', 'retencao',
   'Retenção depende de quem é o cliente',
   'A retenção é a mesma para quem comprou e para quem foi convidado?',
   '{papel_maior:papel} retém {taxa_maior:pct} contra {taxa_menor:pct} de {papel_menor:papel} — {gap:pp} de diferença, medidos sobre clientes com {janela_elegibilidade:int}+ dias de casa ativos nos últimos {janela_atividade:int} dias.',
   'O grupo que menos retém é o maior: {n_menor:int} clientes elegíveis, contra {n_maior:int} no topo. Cada ponto ganho ali vale mais.',
   'Diferença de pelo menos cinco pontos percentuais entre o maior e o menor papel, e maior que dois erros padrão da estimativa.',
   'retencao', 'card-retencao-papel', 1),

  ('cli_amplitude', 'clientes', 'habito',
   'Amplitude de uso é a alavanca mais forte',
   'Usar mais módulos está associado a reter mais?',
   'Quem usou {modulos_maior:int} módulos nos primeiros {janela_amplitude:int} dias retém {taxa_maior:pct}, contra {taxa_menor:pct} de quem usou {modulos_menor:int} — {gap:pp} de diferença.',
   'Associação, não causa. Ainda assim, é o gradiente mais forte da tela: empurrar o segundo módulo na primeira semana é a intervenção mais barata que o dado sugere.',
   'Diferença de pelo menos dez pontos percentuais entre a maior e a menor faixa com amostra suficiente, e maior que dois erros padrão.',
   'retencao', 'card-retencao-amplitude', 2),

  ('cli_churn_precoce', 'clientes', 'churn',
   'A perda acontece antes do primeiro ciclo',
   'Quanto tempo o cliente que sai fica antes de sumir?',
   '{churned:int} clientes estão em churn comportamental — {janela_churn:int} dias corridos sem nenhuma ação — com vida média de {vida:dec} dias.',
   'A vida média fica abaixo de um ciclo mensal de cobrança: a janela de intervenção é a primeira semana, não a renovação.',
   'Vida média do churn abaixo de trinta dias, com pelo menos trinta clientes em churn.',
   'risco', 'card-churn-modulos', 3),

  ('cli_frequencia', 'clientes', 'frequencia',
   'A maioria aparece e some',
   'Quem apareceu no período voltou alguma vez?',
   '{pct_um_dia:pct} dos {mau:int} clientes ativos no período apareceram em um único dia.',
   'Frequência é o degrau anterior à retenção: sem segundo dia não há hábito, e sem hábito a retenção não tem de onde vir.',
   'Ao menos um terço dos ativos com um único dia de uso.',
   'retencao', 'card-frequencia', 4),

  ('cli_aha', 'clientes', 'ativacao',
   'A ação da primeira semana que mais prevê retenção',
   'Que ação nos primeiros dias separa quem fica de quem sai?',
   'Quem fez {acao_nome:evento} nos primeiros {janela_aha:int} dias retém {lift:mult} mais que quem não fez — {fizeram:int} clientes fizeram.',
   'Correlação, não causa: quem faz isso na primeira semana provavelmente já chegou mais engajado. Vale desenhar um experimento com grupo de controle antes de mover recurso.',
   'Lift de pelo menos um vírgula cinco, com os dois lados da comparação acima do piso de amostra.',
   'funciona', 'card-aha', 5),

  ('vg_penetracao', 'visao-geral', 'alcance',
   'Quantos clientes de fato apareceram',
   'Que fatia da base pagante usou o produto no período?',
   '{ativos:int} de {base:int} clientes tiveram ao menos uma ação no período — {penetracao:pct} da base.',
   'O restante não é churn ainda: é gente pagando sem usar. A lista nominal está em Clientes & Retenção.',
   'Penetração abaixo de metade da base pagante.',
   null, 'card-kpis', 1),

  ('vg_tendencia', 'visao-geral', 'tendencia',
   'Ativos contra o período anterior',
   'O uso cresceu ou encolheu em relação à janela anterior?',
   'Os ativos variaram {delta:pctsigned} em relação ao período anterior — {ativos:int} contra {ativos_ant:int}.',
   'Variação de base inteira raramente vem de uma causa só. Antes de concluir, olhe a composição: entrada nova e reativação movem o número em direções diferentes.',
   'Variação de pelo menos cinco por cento, com os dois períodos acima do piso de amostra.',
   null, 'card-atividade', 2),

  ('vg_concentracao', 'visao-geral', 'uso',
   'O uso se concentra em um comportamento',
   'De que depende o número de ações da plataforma?',
   '{tipo_lider:evento} responde por {parte:pct} de todas as ações do período — {total:int} ações no total.',
   'Concentração alta significa que a saúde aparente do produto depende de um comportamento só; se ele oscilar, o número inteiro oscila junto.',
   'A ação mais frequente respondendo por pelo menos um terço do total.',
   null, 'card-eventos', 3);

-- ============ LEITURA DO CATÁLOGO PELA TELA ============

create or replace function public.bi_regras()
returns table(
  id text, tela text, familia text, titulo text, pergunta text,
  gabarito text, gabarito_acao text, limiar_descricao text, ordem integer)
language sql stable set search_path to ''
as $$
  select r.id, r.tela, r.familia, r.titulo, r.pergunta,
         r.gabarito, r.gabarito_acao, r.limiar_descricao, r.ordem
  from insights.regra r
  order by r.tela, r.ordem;
$$;

comment on function public.bi_regras() is
  'Catálogo completo, para a página /regras. O bloco de resumo não certifica ausência de problema — ele cobre exatamente estas perguntas, e por isso elas ficam visíveis.';

create or replace function public.bi_data_referencia()
returns date
language sql stable set search_path to ''
as $$ select marts.data_referencia(); $$;

comment on function public.bi_data_referencia() is
  'Carimbo do dado para o bloco de resumo. Com o pipeline parado, isso não é enfeite.';

-- ============ MOTOR — CLIENTES & RETENÇÃO ============

create or replace function public.bi_achados_clientes(
  p_dias integer default 30, p_papel text default null, p_plano text default null)
returns table(
  regra text, familia text, severidade text, titulo text,
  gabarito text, gabarito_acao text, parametros jsonb,
  score numeric, suprimida boolean, motivo text,
  ancora_aba text, ancora_id text)
language sql stable set search_path to ''
as $$
  with
  -- ---- leitura: SOMENTE funções public.bi_* ----
  eng as materialized (select * from public.bi_engajamento_clientes(p_dias, p_papel, p_plano)),
  pap as materialized (select * from public.bi_retencao_por_papel(p_plano)),
  amp as materialized (select * from public.bi_retencao_por_amplitude(p_papel, p_plano)),
  chu as materialized (select * from public.bi_churn_resumo(p_papel, p_plano)),
  aha as materialized (select * from public.bi_aha_moment(p_papel, p_plano)),

  -- ---- cli_gap_papel ----
  pap_ok as (select * from pap where pct_retidos is not null),
  pap_par as (
    select
      (select p.papel from pap_ok p order by p.pct_retidos desc limit 1) as papel_maior,
      (select p.pct_retidos from pap_ok p order by p.pct_retidos desc limit 1) as taxa_maior,
      (select p.clientes from pap_ok p order by p.pct_retidos desc limit 1) as n_maior,
      (select p.papel from pap_ok p order by p.pct_retidos asc limit 1) as papel_menor,
      (select p.pct_retidos from pap_ok p order by p.pct_retidos asc limit 1) as taxa_menor,
      (select p.clientes from pap_ok p order by p.pct_retidos asc limit 1) as n_menor,
      (select count(*) from pap_ok) as grupos
  ),
  r_gap_papel as (
    select
      'cli_gap_papel'::text as regra,
      case when p.grupos < 2 then 'sem dois papéis com amostra suficiente no recorte'
           when p.taxa_maior - p.taxa_menor < 0.05 then 'diferença abaixo do limiar de cinco pontos'
           when p.taxa_maior - p.taxa_menor
                < 2 * sqrt(p.taxa_maior * (1 - p.taxa_maior) / nullif(p.n_maior, 0)
                         + p.taxa_menor * (1 - p.taxa_menor) / nullif(p.n_menor, 0))
             then 'diferença dentro da margem de erro da própria estimativa'
      end as motivo,
      jsonb_build_object(
        'papel_maior', p.papel_maior, 'papel_menor', p.papel_menor,
        'taxa_maior', p.taxa_maior, 'taxa_menor', p.taxa_menor,
        'n_maior', p.n_maior, 'n_menor', p.n_menor,
        'gap', round((p.taxa_maior - p.taxa_menor) * 100, 1),
        'janela_elegibilidade', 120, 'janela_atividade', 30
      ) as parametros,
      round((p.taxa_maior - p.taxa_menor) / 0.05, 2) as score
    from pap_par p
  ),

  -- ---- cli_amplitude ----
  amp_ok as (select * from amp where pct_retidos is not null),
  amp_par as (
    select
      (select a.modulos from amp_ok a order by a.pct_retidos desc limit 1) as modulos_maior,
      (select a.pct_retidos from amp_ok a order by a.pct_retidos desc limit 1) as taxa_maior,
      (select a.clientes from amp_ok a order by a.pct_retidos desc limit 1) as n_maior,
      (select a.modulos from amp_ok a order by a.pct_retidos asc limit 1) as modulos_menor,
      (select a.pct_retidos from amp_ok a order by a.pct_retidos asc limit 1) as taxa_menor,
      (select a.clientes from amp_ok a order by a.pct_retidos asc limit 1) as n_menor,
      (select count(*) from amp_ok) as faixas
  ),
  r_amplitude as (
    select
      'cli_amplitude'::text as regra,
      case when a.faixas < 2 then 'sem duas faixas de amplitude com amostra suficiente'
           when a.taxa_maior - a.taxa_menor < 0.10 then 'gradiente abaixo do limiar de dez pontos'
           when a.taxa_maior - a.taxa_menor
                < 2 * sqrt(a.taxa_maior * (1 - a.taxa_maior) / nullif(a.n_maior, 0)
                         + a.taxa_menor * (1 - a.taxa_menor) / nullif(a.n_menor, 0))
             then 'gradiente dentro da margem de erro'
      end as motivo,
      jsonb_build_object(
        'modulos_maior', a.modulos_maior, 'modulos_menor', a.modulos_menor,
        'taxa_maior', a.taxa_maior, 'taxa_menor', a.taxa_menor,
        'gap', round((a.taxa_maior - a.taxa_menor) * 100, 1),
        'janela_amplitude', 30
      ) as parametros,
      round((a.taxa_maior - a.taxa_menor) / 0.10, 2) as score
    from amp_par a
  ),

  -- ---- cli_churn_precoce ----
  r_churn as (
    select
      'cli_churn_precoce'::text as regra,
      case when c.vida_media_dias is null then 'vida média suprimida: menos de trinta clientes em churn no recorte'
           when c.vida_media_dias >= 30 then 'vida média acima de um ciclo mensal'
      end as motivo,
      jsonb_build_object(
        'churned', c.churned, 'vida', c.vida_media_dias, 'janela_churn', 60
      ) as parametros,
      round(30 / nullif(c.vida_media_dias, 0), 2) as score
    from chu c
  ),

  -- ---- cli_frequencia ----
  r_frequencia as (
    select
      'cli_frequencia'::text as regra,
      case when e.pct_mais_de_um_dia is null then 'fatia suprimida: amostra do recorte abaixo do piso'
           when 1 - e.pct_mais_de_um_dia < 0.333 then 'concentração em um dia abaixo do limiar de um terço'
      end as motivo,
      jsonb_build_object(
        'pct_um_dia', round(1 - coalesce(e.pct_mais_de_um_dia, 0), 4), 'mau', e.mau
      ) as parametros,
      round((1 - coalesce(e.pct_mais_de_um_dia, 0)) / 0.333, 2) as score
    from eng e
  ),

  -- ---- cli_aha ----
  aha_top as (select * from aha where lift is not null order by lift desc limit 1),
  r_aha as (
    select
      'cli_aha'::text as regra,
      case when not exists (select 1 from aha_top) then 'nenhuma ação com os dois lados da comparação acima do piso'
           when (select a.lift from aha_top a) < 1.5 then 'lift abaixo do limiar de um e meio'
      end as motivo,
      jsonb_build_object(
        'acao_nome', (select a.acao from aha_top a),
        'lift', (select a.lift from aha_top a),
        'fizeram', (select a.fizeram from aha_top a),
        'janela_aha', 7
      ) as parametros,
      round(coalesce((select a.lift from aha_top a), 0) / 1.5, 2) as score
  ),

  todas as (
    select * from r_gap_papel
    union all select * from r_amplitude
    union all select * from r_churn
    union all select * from r_frequencia
    union all select * from r_aha
  )
  select
    t.regra, g.familia,
    case when t.motivo is not null then 'neutro'
         when t.score >= 2.0 then 'critico'
         when t.score >= 1.5 then 'atencao'
         else 'neutro' end as severidade,
    g.titulo, g.gabarito, g.gabarito_acao, t.parametros,
    t.score, (t.motivo is not null) as suprimida, t.motivo,
    g.ancora_aba, g.ancora_id
  from todas t
  join insights.regra g on g.id = t.regra
  order by (t.motivo is not null), t.score desc;
$$;

-- ============ BASE DO RECORTE NO KPI DA VISÃO GERAL ============

-- A pergunta "que fatia da base pagante apareceu" não tinha denominador em
-- lugar nenhum: a tela contava ativos sem nunca dizer sobre quantos. Sem isso,
-- 3.471 lê como número grande — e é um quarto da base.
drop function public.bi_visao_geral_kpis(integer, text, text);

create function public.bi_visao_geral_kpis(
  p_dias integer default 30, p_papel text default null, p_plano text default null)
returns table(
  ativos bigint, ativos_ant bigint, novos bigint, novos_ant bigint,
  aulas bigint, aulas_ant bigint, pageviews bigint, pageviews_ant bigint,
  base bigint)
language sql stable set search_path to ''
as $$
  with hoje as materialized (select marts.data_referencia() d),
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
       end) as pageviews_ant,
      (select count(*) from clientes) as base
  )
  select
    n.ativos,    case when n.ativos    >= 30 and n.ativos_ant    >= 30 then n.ativos_ant    end,
    n.novos,     case when n.novos     >= 30 and n.novos_ant     >= 30 then n.novos_ant     end,
    n.aulas,     case when n.aulas     >= 30 and n.aulas_ant     >= 30 then n.aulas_ant     end,
    n.pageviews, case when n.pageviews >= 30 and n.pageviews_ant >= 30 then n.pageviews_ant end,
    n.base
  from n;
$$;

do $$
begin
  execute 'revoke execute on function public.bi_visao_geral_kpis(integer, text, text) from public, anon';
  execute 'grant execute on function public.bi_visao_geral_kpis(integer, text, text) to authenticated';
end $$;

-- ============ MOTOR — VISÃO GERAL ============

create or replace function public.bi_achados_visao_geral(
  p_dias integer default 30, p_papel text default null, p_plano text default null)
returns table(
  regra text, familia text, severidade text, titulo text,
  gabarito text, gabarito_acao text, parametros jsonb,
  score numeric, suprimida boolean, motivo text,
  ancora_aba text, ancora_id text)
language sql stable set search_path to ''
as $$
  with
  kpi as materialized (select * from public.bi_visao_geral_kpis(p_dias, p_papel, p_plano)),
  evt as materialized (select * from public.bi_eventos_por_tipo(p_dias, p_papel, p_plano)),

  r_penetracao as (
    select
      'vg_penetracao'::text as regra,
      case when k.base is null or k.base = 0 then 'base do recorte indisponível'
           when k.ativos::numeric / k.base >= 0.5 then 'penetração acima de metade da base'
      end as motivo,
      jsonb_build_object(
        'ativos', k.ativos, 'base', k.base,
        'penetracao', round(k.ativos::numeric / nullif(k.base, 0), 4)
      ) as parametros,
      round(0.5 / nullif(k.ativos::numeric / nullif(k.base, 0), 0), 2) as score
    from kpi k
  ),

  r_tendencia as (
    select
      'vg_tendencia'::text as regra,
      case when k.ativos_ant is null then 'período anterior sem comparação sustentada pela régua de amostra'
           when abs(k.ativos::numeric / k.ativos_ant - 1) < 0.05 then 'variação abaixo do limiar de cinco por cento'
      end as motivo,
      jsonb_build_object(
        'ativos', k.ativos, 'ativos_ant', k.ativos_ant,
        'delta', round(k.ativos::numeric / nullif(k.ativos_ant, 0) - 1, 4)
      ) as parametros,
      round(abs(k.ativos::numeric / nullif(k.ativos_ant, 0) - 1) / 0.05, 2) as score
    from kpi k
  ),

  evt_total as (select sum(e.eventos) as total from evt e),
  evt_lider as (select e.tipo, e.eventos from evt e order by e.eventos desc limit 1),
  r_concentracao as (
    select
      'vg_concentracao'::text as regra,
      case when (select t.total from evt_total t) is null or (select t.total from evt_total t) = 0
             then 'sem ação registrada no período'
           when (select l.eventos from evt_lider l)::numeric / (select t.total from evt_total t) < 0.333
             then 'concentração abaixo do limiar de um terço'
      end as motivo,
      jsonb_build_object(
        'tipo_lider', (select l.tipo from evt_lider l),
        'total', (select t.total from evt_total t),
        'parte', round((select l.eventos from evt_lider l)::numeric
                       / nullif((select t.total from evt_total t), 0), 4)
      ) as parametros,
      round((select l.eventos from evt_lider l)::numeric
            / nullif((select t.total from evt_total t), 0) / 0.333, 2) as score
  ),

  todas as (
    select * from r_penetracao
    union all select * from r_tendencia
    union all select * from r_concentracao
  )
  select
    t.regra, g.familia,
    case when t.motivo is not null then 'neutro'
         when t.score >= 2.0 then 'critico'
         when t.score >= 1.5 then 'atencao'
         else 'neutro' end as severidade,
    g.titulo, g.gabarito, g.gabarito_acao, t.parametros,
    t.score, (t.motivo is not null) as suprimida, t.motivo,
    g.ancora_aba, g.ancora_id
  from todas t
  join insights.regra g on g.id = t.regra
  order by (t.motivo is not null), t.score desc;
$$;

-- ============ PERMISSÕES ============

do $$
declare f text;
begin
  foreach f in array array[
    'public.bi_regras()',
    'public.bi_data_referencia()',
    'public.bi_achados_clientes(integer, text, text)',
    'public.bi_achados_visao_geral(integer, text, text)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
