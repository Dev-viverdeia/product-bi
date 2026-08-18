-- Início de solução passa a sair do mart de progresso, e o compromisso de
-- Soluções deixa de publicar 1,6%
--
-- Passo 4 de 5 da Fase 2. Decisão do Mateus em 18/08: publicar o número
-- reconstruído em vez de suprimir o card.
--
-- O DEFEITO
--
-- O card "O uso é raso ou profundo?" da Visão Geral publicava 1,61% de
-- compromisso para Soluções, e o card de saúde do rastreio, NA MESMA TELA,
-- provava que o número era falso: solution_started parou de ser emitido em
-- 22/06/2026. Na janela de 30 dias o evento tem ZERO ocorrências, então o
-- numerador de Soluções ficou só com solution_completed (419) contra 25.960
-- ações — praticamente só solution_viewed.
--
-- O achado nº 3 do roadmap ("Soluções tem 1,6% de compromisso — atrai atenção e
-- não converte") saiu daí, e já foi retirado do documento.
--
-- POR QUE A CORREÇÃO NÃO É UM REMENDO TEMPORÁRIO
--
-- Medido antes de escolher o desenho:
--
--   marts.fact_progresso_solucao   25/07/2025 -> hoje    53.586 inícios
--   evento solution_started        13/04/2026 -> 22/06   16.333 eventos
--
-- O evento viveu DEZ SEMANAS. O mart de progresso tem treze meses. E na janela
-- em que os dois coexistiram (mai a 21/jun) eles medem a mesma coisa: 12.925
-- contra 12.963, 0,3% de diferença.
--
-- Ou seja: o evento nunca foi a fonte certa para "iniciou uma solução" — era um
-- sinal duplicado, de vida curta, sobre um fato que o mart já registrava. A
-- correção é trocar a fonte, não tapar um buraco: mesmo que a plataforma
-- ressuscite o evento amanhã, o mart continua sendo o lugar certo, e nada aqui
-- precisa ser desfeito.
--
-- solution_started é EXCLUÍDO do braço de eventos de propósito. Sem isso, a
-- janela em que o evento existe contaria duas vezes o mesmo início.
--
-- GANHO COLATERAL: AS DUAS TELAS PASSAM A CONCORDAR POR CONSTRUÇÃO
--
-- marts.fact_progresso_solucao já é a fonte de bi_solucoes_kpis e do funil da
-- tela de Soluções. Com esta migration, a Visão Geral e Soluções contam início
-- pelo mesmo lugar — o tipo de divergência silenciosa que este projeto vem
-- caçando em outras camadas deixa de ser possível aqui.
--
-- EFEITO MEDIDO NA JANELA DE 30 DIAS
--
--   Soluções, compromisso:  1,61% -> 32,11%
--   média da plataforma:   56,2%  -> 63,51%
--   Mentoria (11 ações) e Networking (1 ação) seguem suprimidos pelo piso de 30
--
-- SEM purga de insights.achado_cache: varri os nove calculadores e NENHUM lê
-- bi_acoes_por_modulo (vg_concentracao lê bi_eventos_por_tipo, que conta tipo de
-- evento e não é afetada). Nenhuma frase de nenhuma tela cita o número que esta
-- migration move, então não há texto para envelhecer.

drop function public.bi_acoes_por_modulo(integer, text, text);

create function public.bi_acoes_por_modulo(
  p_dias integer default 30,
  p_papel text default null,
  p_plano text default null)
returns table(
  modulo text, consumo bigint, compromisso bigint, total bigint, clientes bigint,
  pct_compromisso numeric, pct_compromisso_geral numeric)
language sql stable set search_path to ''
as $function$
  with acoes as (
    -- Braço 1: os eventos, SEM solution_started. A exclusão evita contagem
    -- dupla na janela de dez semanas em que o evento existiu; fora dela ele é
    -- zero de qualquer forma.
    select marts.modulo_do_evento(f.tipo) as modulo,
           marts.tipo_de_acao(f.tipo) as acao,
           f.user_id
    from marts.fact_evento f
    join marts.dim_usuario u on u.user_id = f.user_id and u.e_cliente
      and (p_papel is null or u.papel = p_papel)
      and (p_plano is null or coalesce(u.plano, 'sem_plano') = p_plano)
    where f.data_brt > (select marts.data_referencia()) - p_dias
      and f.tipo <> 'solution_started'

    union all

    -- Braço 2: o início de solução, do mart de progresso — a fonte que a tela
    -- de Soluções já usa. Compromisso por definição: iniciar é produzir.
    select 'Soluções', 'compromisso', p.user_id
    from marts.fact_progresso_solucao p
    join marts.dim_usuario u on u.user_id = p.user_id and u.e_cliente
      and (p_papel is null or u.papel = p_papel)
      and (p_plano is null or coalesce(u.plano, 'sem_plano') = p_plano)
    where (p.iniciado_em at time zone 'America/Sao_Paulo')::date
            > (select marts.data_referencia()) - p_dias
      and (p.iniciado_em at time zone 'America/Sao_Paulo')::date
            <= (select marts.data_referencia())
  ),
  por_modulo as (
    select a.modulo,
           count(*) filter (where a.acao = 'consumo') as consumo,
           count(*) filter (where a.acao = 'compromisso') as compromisso,
           count(*) as total,
           count(distinct a.user_id) as clientes
    from acoes a
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
$function$;

comment on function public.bi_acoes_por_modulo(integer, text, text) is
  'Ações de produto por módulo, separadas em consumo e compromisso. O INÍCIO DE SOLUÇÃO sai de marts.fact_progresso_solucao, não do evento solution_started, e isso é permanente: o evento viveu de 13/04 a 22/06/2026 (dez semanas) enquanto o mart cobre desde 25/07/2025, e na janela comum os dois batem em 0,3%. O evento é excluído do braço de eventos para não contar duas vezes. Efeito colateral desejado: esta função e a tela de Soluções passam a contar início pelo mesmo lugar. Régua e_cliente aplicada nos dois braços; janela em marts.data_referencia().';

revoke execute on function public.bi_acoes_por_modulo(integer, text, text) from public, anon;
grant execute on function public.bi_acoes_por_modulo(integer, text, text) to authenticated, service_role;
