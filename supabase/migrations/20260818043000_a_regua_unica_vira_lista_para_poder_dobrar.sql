-- A régua única de eventos aposentados vira lista, para o planejador poder
-- dobrá-la em constante
--
-- Segunda correção do passo 5, e a mais cara das duas.
--
-- O DEFEITO: 31 ms VIRARAM 371 ms
--
-- marts.evento_aposentado(tipo) -> boolean entrou como "a lista num lugar só",
-- lida pela exclusão do braço de eventos e pela guarda. Boa ideia, forma
-- errada: como PREDICADO, ela é chamada uma vez POR LINHA do fato.
--
-- Medido no mesmo scan, mesmo índice, mesmas 69.062 linhas:
--
--   f.tipo <> 'solution_started'                31 ms
--   not marts.evento_aposentado(f.tipo)        371 ms   (12x)
--   f.tipo <> all (marts.eventos_aposentados()) 35 ms
--
-- A causa não é o custo da função: é que ela NÃO FAZ INLINE. O PostgreSQL se
-- recusa a inlinar função SQL que tem cláusula SET, e `set search_path to ''`
-- é obrigatório aqui pela regra da casa (o advisor function_search_path_mutable
-- existe por bons motivos). Ou seja: as duas regras do projeto — régua num
-- lugar só e search_path fixo — se combinam num defeito de desempenho que
-- nenhuma das duas prevê sozinha. Fica registrado, porque vai acontecer de
-- novo.
--
-- A SAÍDA É MUDAR A FORMA, NÃO ABRIR MÃO DE NENHUMA DAS DUAS REGRAS
--
-- Função sem argumento e IMMUTABLE é avaliada UMA vez e dobrada em constante no
-- plano — o EXPLAIN mostra `tipo <> ALL ('{solution_started}'::text[])`, que é
-- exatamente o que o literal produzia. A régua continua num lugar só, o
-- search_path continua fixo, e o custo volta a zero.
--
-- Regra que sai daqui: régua compartilhada que entra em predicado de linha
-- devolve CONJUNTO, nunca booleano por item.
--
-- Nenhum número muda: mesmo conjunto de tipos, mesma exclusão, mesma guarda.

create or replace function marts.eventos_aposentados()
returns text[]
language sql immutable set search_path to ''
as $function$
  select array['solution_started']::text[];
$function$;

comment on function marts.eventos_aposentados() is
  'Tipos de evento que uma fonte melhor substituiu e que public.bi_acoes_por_modulo NÃO conta. Devolve CONJUNTO e não booleano por item de propósito: como função sem argumento e immutable, o planejador a dobra em constante e o predicado custa o mesmo que um literal — na forma evento_aposentado(tipo) o mesmo scan ia de 31 ms para 371 ms, porque função SQL com cláusula SET não faz inline e passa a ser chamada por linha. Lida pela exclusão do braço de eventos E pela guarda de rastreio quebrado: as duas precisam da MESMA lista, porque uma guarda vigiando evento que a função não lê suprimiria um número correto. solution_started entrou em 20260818030000 — o evento viveu de 13/04 a 22/06/2026 e marts.fact_progresso_solucao cobre desde 25/07/2025, batendo em 0,3% na janela comum.';

create or replace function public.bi_acoes_por_modulo(
  p_dias integer default 30,
  p_papel text default null,
  p_plano text default null)
returns table(
  modulo text, consumo bigint, compromisso bigint, total bigint, clientes bigint,
  pct_compromisso numeric, pct_compromisso_geral numeric, suprimido_por text[])
language sql stable set search_path to ''
as $function$
  with acoes as (
    -- Braço 1: os eventos, sem os aposentados. A exclusão evita contagem dupla
    -- na janela em que o evento substituído ainda existiu.
    select marts.modulo_do_evento(f.tipo) as modulo,
           marts.tipo_de_acao(f.tipo) as acao,
           f.user_id
    from marts.fact_evento f
    join marts.dim_usuario u on u.user_id = f.user_id and u.e_cliente
      and (p_papel is null or u.papel = p_papel)
      and (p_plano is null or coalesce(u.plano, 'sem_plano') = p_plano)
    where f.data_brt > (select marts.data_referencia()) - p_dias
      and f.tipo <> all (marts.eventos_aposentados())

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
  ),
  -- Os tipos de compromisso com rastreio QUEBRADO que esta função lê. Sai da
  -- tabela de vereditos, não de uma segunda varredura do fato.
  quebrados as (
    select marts.modulo_do_evento(rc.tipo) as modulo,
           array_agg(rc.tipo order by rc.tipo) as tipos
    from marts.rastreio_corroboracao rc
    where rc.veredito = 'quebrado'
      and marts.tipo_de_acao(rc.tipo) = 'compromisso'
      and rc.tipo <> all (marts.eventos_aposentados())
    group by 1
  ),
  com_guarda as (
    -- A guarda só morde quando a razão de fato sai errada: o módulo tem consumo
    -- NA JANELA (logo o denominador continua enchendo) e um compromisso
    -- quebrado (logo o numerador perdeu eventos). Módulo sem consumo publica
    -- 100% com ou sem a quebra — ali o que engana é o volume, e isso é outro
    -- card.
    select m.modulo, m.consumo, m.compromisso, m.total, m.clientes,
           case when m.consumo > 0 then q.tipos end as suprimido_por
    from por_modulo m
    left join quebrados q on q.modulo = m.modulo
  )
  select c.modulo, c.consumo, c.compromisso, c.total, c.clientes,
         -- o piso aqui é de AÇÕES, não de clientes: uma razão sobre trinta e
         -- poucos eventos oscila com um clique
         case when c.suprimido_por is null and c.total >= 30
              then round(c.compromisso::numeric / c.total, 4) end,
         -- a média da plataforma cai junto: o numerador dela perdeu os mesmos
         -- eventos, então publicá-la seria publicar a média de um número que a
         -- linha ao lado se recusou a publicar
         case when bool_or(c.suprimido_por is not null) over () then null
              when sum(c.total) over () >= 30
              then round(sum(c.compromisso) over ()::numeric
                         / sum(c.total) over (), 4) end,
         c.suprimido_por
  from com_guarda c
  order by c.total desc;
$function$;

comment on function public.bi_acoes_por_modulo(integer, text, text) is
  'Ações de produto por módulo, separadas em consumo e compromisso. O INÍCIO DE SOLUÇÃO sai de marts.fact_progresso_solucao, não do evento solution_started, e isso é permanente (ver 20260818030000). A lista de eventos aposentados vive em marts.eventos_aposentados, lida aqui pela exclusão E pela guarda. GUARDA: pct_compromisso e a média da plataforma são suprimidos quando o módulo tem consumo na janela e um tipo de compromisso com veredito quebrado em marts.rastreio_corroboracao — o caso do Soluções em 17/08, quando solution_started calou e a tela publicou 1,6%. suprimido_por nomeia os tipos, para a tela declarar em vez de o módulo sumir do gráfico. Régua e_cliente nos dois braços; janela em marts.data_referencia().';

-- A forma booleana sai de cena: mantê-la seria deixar disponível justamente a
-- assinatura que custa 12x em predicado de linha.
drop function marts.evento_aposentado(text);
