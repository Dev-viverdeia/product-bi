-- A guarda lê a tabela de vereditos, não a varredura inteira
--
-- Correção do passo 5, medida logo depois de aplicá-lo.
--
-- O DEFEITO: 317 ms PARA LER QUATRO LINHAS
--
-- A primeira versão da guarda chamava marts.rastreio_por_tipo(), que agrupa
-- marts.fact_evento inteiro (~350 mil linhas) para devolver doze. Medido:
--
--   corpo do passo 4, sem guarda   1.472 ms
--   com a guarda por varredura     1.789 ms
--
-- Só que a guarda não precisa da varredura. O veredito já está calculado em
-- marts.rastreio_corroboracao — quatro linhas, escritas pelo cron. Ler o fato
-- de novo para redescobrir o que a tabela já sabe é a mesma classe de
-- desperdício que o passo 1 tirou desta régua.
--
-- E O SEGUNDO CANAL DA GUARDA FICA MAIS CERTO, NÃO SÓ MAIS BARATO
--
-- "O módulo tem consumo vivo?" era respondido por status = 'ativo' no tipo —
-- uma leitura global, de todo o histórico. Mas a razão que a guarda protege é
-- da JANELA pedida e do RECORTE pedido, e a função já calcula exatamente isso:
-- m.consumo > 0. Um recorte de papel sem nenhuma ação de consumo no módulo
-- publica 100% com ou sem quebra, e ali não há razão distorcida para suprimir.
--
-- Nada mais muda: mesmas colunas, mesmo veredito, mesma lista de aposentados.

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
      and not marts.evento_aposentado(f.tipo)

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
      and not marts.evento_aposentado(rc.tipo)
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
  'Ações de produto por módulo, separadas em consumo e compromisso. O INÍCIO DE SOLUÇÃO sai de marts.fact_progresso_solucao, não do evento solution_started, e isso é permanente (ver 20260818030000). A lista de eventos aposentados vive em marts.evento_aposentado, lida aqui pela exclusão E pela guarda. GUARDA: pct_compromisso e a média da plataforma são suprimidos quando o módulo tem consumo na janela e um tipo de compromisso com veredito quebrado em marts.rastreio_corroboracao — o caso do Soluções em 17/08, quando solution_started calou e a tela publicou 1,6%. suprimido_por nomeia os tipos, para a tela declarar em vez de o módulo sumir do gráfico. Régua e_cliente nos dois braços; janela em marts.data_referencia().';
