-- Fase 2 — a análise ganha aba própria, e o catálogo ganha a leitura.
--
-- O bloco de resumo nasceu como faixa navy no topo da tela: parede de texto
-- entre o cabeçalho e os gráficos, com a contabilidade em mono no fim. Lia como
-- saída de sistema, não como análise. Agora a leitura escrita tem aba própria,
-- e com o espaço apareceu o degrau que faltava no catálogo.
--
-- "Leitura" é o que um analista escreveria entre o fato e a ação: o que aquele
-- número significa — e, tão importante quanto, o que ele NÃO significa. Sem
-- ela o texto dava o número e mandava fazer, deixando o salto por conta do
-- leitor.

alter table insights.regra add column if not exists gabarito_leitura text not null default '';

update insights.regra set gabarito_leitura =
  'A distância entre a base contratada e a base que aparece é o espaço onde o churn se forma. Quem não abriu o produto no período ainda não decidiu sair — mas também não acumulou motivo para renovar.'
where id = 'vg_penetracao';

update insights.regra set gabarito_leitura =
  'Variação de base inteira raramente tem causa única: entrada nova, reativação e retenção empurram o mesmo número em direções diferentes, e podem se anular sem que nada tenha melhorado.'
where id = 'vg_tendencia';

update insights.regra set gabarito_leitura =
  'Quando um comportamento responde por perto de metade do volume, o indicador de uso da casa é, na prática, o indicador desse comportamento — e vai subir ou cair junto com ele.'
where id = 'vg_concentracao';

update insights.regra set gabarito_leitura =
  'Papel aqui é tipo de contrato, e o corte que mais explica é outro: o master user comprou e é dono da organização, os demais entram pelo convite dele. O produto retém quem paga melhor do que retém quem o pagante trouxe.'
where id = 'cli_gap_papel';

update insights.regra set gabarito_leitura =
  'A relação é monotônica: cada módulo a mais na primeira janela vem com retenção maior. Isso não prova que amplitude causa retenção — quem chega mais engajado tende a experimentar mais — mas nenhum outro sinal desta tela tem gradiente tão limpo.'
where id = 'cli_amplitude';

update insights.regra set gabarito_leitura =
  'Vida média abaixo de um ciclo mensal significa que a maior parte da perda acontece antes da primeira renovação. Programa de retenção que começa perto do vencimento chega depois do problema.'
where id = 'cli_churn_precoce';

update insights.regra set gabarito_leitura =
  'Frequência é o degrau anterior à retenção. Quem aparece uma vez só não formou hábito, e sem hábito a retenção não tem de onde vir — o número de ativos do mês esconde essa diferença.'
where id = 'cli_frequencia';

update insights.regra set gabarito_leitura =
  'Correlação, não causa: quem faz isso na primeira semana provavelmente já chegou mais disposto. O valor do sinal está em identificar cedo quem tende a ficar, mesmo sem provar que a ação é o que faz ficar.'
where id = 'cli_aha';

alter table insights.regra alter column gabarito_leitura drop default;

-- A coluna nova entra na saída de todas elas, então a assinatura muda e o
-- CREATE OR REPLACE não serve. Drop na ordem da dependência: o invólucro
-- depende do calculador.
drop function public.bi_achados_clientes(integer, text, text);
drop function public.bi_achados_visao_geral(integer, text, text);
drop function insights.calcular_achados_clientes(integer, text, text);
drop function insights.calcular_achados_visao_geral(integer, text, text);
drop function public.bi_regras();

-- As definições abaixo repetem as da migration do motor, com gabarito_leitura
-- acrescentado à saída. A lógica de detecção não muda nesta leva.

create function public.bi_regras()
returns table(
  id text, tela text, familia text, titulo text, pergunta text,
  gabarito text, gabarito_leitura text, gabarito_acao text,
  limiar_descricao text, ordem integer)
language sql stable set search_path to ''
as $$
  select r.id, r.tela, r.familia, r.titulo, r.pergunta,
         r.gabarito, r.gabarito_leitura, r.gabarito_acao, r.limiar_descricao, r.ordem
  from insights.regra r
  order by r.tela, r.ordem;
$$;;

create function insights.calcular_achados_visao_geral(
  p_dias integer default 30, p_papel text default null, p_plano text default null)
returns table(
  regra text, familia text, severidade text, titulo text,
  gabarito text, gabarito_leitura text, gabarito_acao text, parametros jsonb,
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
    g.titulo, g.gabarito, g.gabarito_leitura, g.gabarito_acao, t.parametros,
    t.score, (t.motivo is not null) as suprimida, t.motivo,
    g.ancora_aba, g.ancora_id
  from todas t
  join insights.regra g on g.id = t.regra
  order by (t.motivo is not null), t.score desc;
$$;;

create function insights.calcular_achados_clientes(
  p_dias integer default 30, p_papel text default null, p_plano text default null)
returns table(
  regra text, familia text, severidade text, titulo text,
  gabarito text, gabarito_leitura text, gabarito_acao text, parametros jsonb,
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
    g.titulo, g.gabarito, g.gabarito_leitura, g.gabarito_acao, t.parametros,
    t.score, (t.motivo is not null) as suprimida, t.motivo,
    g.ancora_aba, g.ancora_id
  from todas t
  join insights.regra g on g.id = t.regra
  order by (t.motivo is not null), t.score desc;
$$;;

-- Os invólucros de cache passam a repassar a leitura junto.
create function public.bi_achados_clientes(
  p_dias integer default 30, p_papel text default null, p_plano text default null)
returns table(
  regra text, familia text, severidade text, titulo text,
  gabarito text, gabarito_leitura text, gabarito_acao text, parametros jsonb,
  score numeric, suprimida boolean, motivo text, ancora_aba text, ancora_id text)
language plpgsql volatile security invoker set search_path to ''
as $$
declare v_ref date; v_chave text; v_payload jsonb;
begin
  v_ref := marts.data_referencia();
  v_chave := format('clientes|%s|%s|%s|%s', p_dias, coalesce(p_papel, ''), coalesce(p_plano, ''), v_ref);
  select c.payload into v_payload from insights.achado_cache c where c.chave = v_chave;
  if v_payload is null then
    select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) into v_payload
    from insights.calcular_achados_clientes(p_dias, p_papel, p_plano) a;
    insert into insights.achado_cache (chave, payload, data_referencia)
    values (v_chave, v_payload, v_ref)
    on conflict (chave) do update set payload = excluded.payload, calculado_em = now();
  end if;
  return query
  select x.regra, x.familia, x.severidade, x.titulo, x.gabarito, x.gabarito_leitura,
         x.gabarito_acao, x.parametros, x.score, x.suprimida, x.motivo, x.ancora_aba, x.ancora_id
  from jsonb_to_recordset(v_payload) as x(
    regra text, familia text, severidade text, titulo text,
    gabarito text, gabarito_leitura text, gabarito_acao text, parametros jsonb,
    score numeric, suprimida boolean, motivo text, ancora_aba text, ancora_id text);
end $$;

create function public.bi_achados_visao_geral(
  p_dias integer default 30, p_papel text default null, p_plano text default null)
returns table(
  regra text, familia text, severidade text, titulo text,
  gabarito text, gabarito_leitura text, gabarito_acao text, parametros jsonb,
  score numeric, suprimida boolean, motivo text, ancora_aba text, ancora_id text)
language plpgsql volatile security invoker set search_path to ''
as $$
declare v_ref date; v_chave text; v_payload jsonb;
begin
  v_ref := marts.data_referencia();
  v_chave := format('visao-geral|%s|%s|%s|%s', p_dias, coalesce(p_papel, ''), coalesce(p_plano, ''), v_ref);
  select c.payload into v_payload from insights.achado_cache c where c.chave = v_chave;
  if v_payload is null then
    select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) into v_payload
    from insights.calcular_achados_visao_geral(p_dias, p_papel, p_plano) a;
    insert into insights.achado_cache (chave, payload, data_referencia)
    values (v_chave, v_payload, v_ref)
    on conflict (chave) do update set payload = excluded.payload, calculado_em = now();
  end if;
  return query
  select x.regra, x.familia, x.severidade, x.titulo, x.gabarito, x.gabarito_leitura,
         x.gabarito_acao, x.parametros, x.score, x.suprimida, x.motivo, x.ancora_aba, x.ancora_id
  from jsonb_to_recordset(v_payload) as x(
    regra text, familia text, severidade text, titulo text,
    gabarito text, gabarito_leitura text, gabarito_acao text, parametros jsonb,
    score numeric, suprimida boolean, motivo text, ancora_aba text, ancora_id text);
end $$;


-- O payload do cache muda de formato: esvaziar é mais barato e mais seguro que
-- migrar. Cache derivado, custo de um recálculo.
delete from insights.achado_cache;

do $$
declare f text;
begin
  foreach f in array array[
    'public.bi_regras()',
    'public.bi_achados_clientes(integer, text, text)',
    'public.bi_achados_visao_geral(integer, text, text)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
  execute 'grant execute on function insights.calcular_achados_clientes(integer, text, text) to authenticated';
  execute 'grant execute on function insights.calcular_achados_visao_geral(integer, text, text) to authenticated';
end $$;
