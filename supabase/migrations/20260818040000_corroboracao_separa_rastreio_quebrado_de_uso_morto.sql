-- A régua de rastreio ganha corroboração: "parado" deixa de significar duas
-- coisas ao mesmo tempo
--
-- Passo 5 de 5 da Fase 2, e o último do lote.
--
-- O DESENHO ORIGINAL FOI DESCARTADO PELA MEDIÇÃO
--
-- O passo 1 (20260818003000) deixou marts.rastreio_por_tipo() como régua única
-- e prometeu, no próprio comment on function, que a guarda de
-- bi_acoes_por_modulo leria dela. A guarda seria "suprimir quando o tipo
-- estiver parado".
--
-- Antes de escrever a guarda, medi os quatro tipos parados contra uma fonte
-- independente do MESMO fato. O resultado reprova aquele desenho:
--
--   tipo                    evento parou   fonte independente         veredito
--   solution_started        22/06  17.694  fact_progresso_solucao:    quebrado
--                                          11.666 inícios na janela
--   connection_accepted     05/05     144  member_connections aceitas: quebrado
--                                          190 linhas, última em 14/08
--   community_post_created  18/06     137  community_posts raiz:      sem uso
--                                          142 linhas, última em 18/06
--   community_comment       23/04      22  community_posts respostas: sem uso
--                                          20 linhas, última em 23/04
--
-- As duas últimas batem na DATA EXATA e quase na contagem. Ninguém publica na
-- Comunidade desde 18/06 e ninguém comenta desde 23/04: a instrumentação está
-- sadia e o que morreu foi o uso. A guarda original carimbaria as duas de
-- rastreio quebrado — publicaria um diagnóstico falso, que é exatamente a
-- classe de defeito que o passo 4 acabou de tirar da tela.
--
-- "Faz tempo que não registra" não separa cano entupido de torneira fechada.
-- Quem separa é comparar o evento com uma fonte independente do mesmo fato —
-- que é, literalmente, o teste que pegou o solution_started.
--
-- POR QUE NO CRON, E NÃO DENTRO DA RPC
--
-- Duas razões, as duas medidas:
--
--   1. A corroboração da Comunidade lê plataforma.community_posts, que é
--      foreign table: seria uma ida à plataforma dentro do card. O passo 1
--      levou esta função de ~3,5 s para ~0,15 s, e não vou devolver isso.
--   2. Pior que lento: o card de saúde do rastreio passaria a falhar
--      justamente quando o FDW cai — que é quando se olha para ele.
--
-- Corroboração é fato de movimento lento: um evento não quebra duas vezes por
-- dia. Roda no cron diário e grava em marts.rastreio_corroboracao.
--
-- A GUARDA DE SANIDADE, QUE AQUI É OBRIGATÓRIA
--
-- Mesmo princípio de etl.propagar_exclusoes(): com o FDW fora do ar, "a fonte
-- não tem registro" é verdade para TODAS as fontes, e o passo concluiria
-- "sem uso" para tudo — trocaria um diagnóstico falso por outro, de madrugada,
-- sem ninguém ver. Por isso qualquer falha de leitura, e qualquer fonte que
-- volte com zero linha no total, viram 'sem_corroboracao' e NUNCA 'sem_uso'.
--
-- O QUE FICA DECLARADO EM VEZ DE ADIVINHADO
--
-- connection_accepted é o único dos quatro cuja fonte (member_connections) não
-- está espelhada — cheguei ao veredito consultando a plataforma direto. Ele
-- entra como 'sem_corroboracao', que é o honesto: o BI não publica o que não
-- consegue recomputar. Espelhar member_connections é entrega própria, e ela
-- destrava Networking como módulo (hoje sem nenhuma instrumentação viva de
-- desfecho).
--
-- A GUARDA DE bi_acoes_por_modulo É NO-OP HOJE, DE PROPÓSITO
--
-- Ela suprime pct_compromisso quando o módulo tem consumo vivo E um tipo de
-- compromisso quebrado — o caso do Soluções em 17/08. Hoje não dispara para
-- ninguém: o único compromisso quebrado é o solution_started, que o passo 4
-- aposentou da função. Mesmo espírito do escopo por quadro do passo 2 — existe
-- para a falha seguinte, não para a de hoje.
--
-- SEM PURGA DE insights.achado_cache, E ISSO FOI CONFERIDO: nenhum dos nove
-- calculadores lê bi_saude_rastreio ou bi_acoes_por_modulo.

-- ---------------------------------------------------------------------------
-- 1. A lista de eventos aposentados, num lugar só
-- ---------------------------------------------------------------------------

create or replace function marts.evento_aposentado(p_tipo text)
returns boolean
language sql immutable set search_path to ''
as $function$
  select p_tipo = 'solution_started';
$function$;

comment on function marts.evento_aposentado(text) is
  'Tipos de evento que uma fonte melhor substituiu e que public.bi_acoes_por_modulo NÃO conta. Lida pela exclusão do braço de eventos E pela guarda de rastreio quebrado: as duas precisam da MESMA lista, porque uma guarda vigiando evento que a função não lê suprimiria um número correto. solution_started entrou aqui em 20260818030000 — o evento viveu de 13/04 a 22/06/2026 e marts.fact_progresso_solucao cobre desde 25/07/2025, batendo em 0,3% na janela comum.';

-- ---------------------------------------------------------------------------
-- 2. Onde a corroboração fica guardada
-- ---------------------------------------------------------------------------

create table marts.rastreio_corroboracao (
  tipo               text primary key,
  fonte              text,
  registros_na_fonte bigint,
  fonte_total        bigint,
  ultimo_evento      date,
  veredito           text not null
    check (veredito in ('quebrado', 'sem_uso', 'sem_corroboracao')),
  verificado_em      timestamptz not null default now()
);

alter table marts.rastreio_corroboracao enable row level security;

-- A policy vai no MESMO commit da tabela: as RPCs são SECURITY INVOKER, e RLS
-- sem policy faz a função devolver zero linha em silêncio, sem erro nenhum.
create policy leitura_bi on marts.rastreio_corroboracao
  for select to authenticated using (true);

grant select on marts.rastreio_corroboracao to authenticated;

comment on table marts.rastreio_corroboracao is
  'Por que um tipo de evento parou de registrar: rastreio quebrado ou funcionalidade sem uso. Preenchida por etl.corroborar_rastreio() no cron diário bi_corroborar_rastreio, nunca no caminho da RPC. Guarda apenas tipos atrasados ou parados — tipo que volta a registrar é removido, porque veredito velho sobre evento vivo é a mesma classe de mentira que esta tabela existe para fechar.';

comment on column marts.rastreio_corroboracao.fonte is
  'Fonte independente do mesmo fato, ou null quando não existe nenhuma espelhada. Null implica veredito sem_corroboracao.';
comment on column marts.rastreio_corroboracao.registros_na_fonte is
  'Registros na fonte DEPOIS da última data do evento. Maior que zero = o fato continua acontecendo e o evento é que calou.';
comment on column marts.rastreio_corroboracao.fonte_total is
  'Total de linhas da fonte. É a guarda de sanidade: zero significa fonte ilegível (FDW caído, permissão), não fonte vazia, e derruba o veredito para sem_corroboracao.';
comment on column marts.rastreio_corroboracao.veredito is
  'quebrado = o fato acontece e o evento não sai · sem_uso = ninguém faz mais isso, instrumentação sadia · sem_corroboracao = não há fonte independente espelhada, ou a leitura dela falhou. Na dúvida o veredito é sempre sem_corroboracao: afirmar sem_uso sem prova é trocar um diagnóstico falso por outro.';

-- ---------------------------------------------------------------------------
-- 3. Quem calcula, no cron diário
-- ---------------------------------------------------------------------------

create or replace function etl.corroborar_rastreio()
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  r          record;
  v_fonte    text;
  v_total    bigint;
  v_desde    bigint;
  v_veredito text;
begin
  for r in
    select rp.tipo, rp.ultimo_registro
    from marts.rastreio_por_tipo() rp
    where rp.status in ('atrasado', 'parado')
  loop
    v_fonte := null;
    v_total := null;
    v_desde := null;

    begin
      case r.tipo
        when 'solution_started' then
          v_fonte := 'marts.fact_progresso_solucao';
          select count(*),
                 count(*) filter (
                   where (p.iniciado_em at time zone 'America/Sao_Paulo')::date
                         > r.ultimo_registro)
            into v_total, v_desde
          from marts.fact_progresso_solucao p;

        when 'community_post_created' then
          v_fonte := 'plataforma.community_posts (raiz)';
          select count(*) filter (where c.parent_id is null),
                 count(*) filter (
                   where c.parent_id is null
                     and (c.created_at at time zone 'America/Sao_Paulo')::date
                         > r.ultimo_registro)
            into v_total, v_desde
          from plataforma.community_posts c;

        when 'community_comment' then
          -- A plataforma não tem tabela de comentário da comunidade: resposta é
          -- post com parent_id preenchido, na mesma tabela.
          v_fonte := 'plataforma.community_posts (respostas)';
          select count(*) filter (where c.parent_id is not null),
                 count(*) filter (
                   where c.parent_id is not null
                     and (c.created_at at time zone 'America/Sao_Paulo')::date
                         > r.ultimo_registro)
            into v_total, v_desde
          from plataforma.community_posts c;

        else
          -- Sem fonte independente espelhada. Fica declarado, não adivinhado.
          null;
      end case;
    exception when others then
      -- FDW fora do ar, coluna renomeada na origem, permissão revogada:
      -- qualquer falha de LEITURA vira ausência de corroboração. Nunca
      -- 'sem_uso' — ver a guarda de sanidade no cabeçalho.
      v_total := null;
      v_desde := null;
    end;

    v_veredito := case
      when v_fonte is null              then 'sem_corroboracao'
      when v_total is null or v_total = 0 then 'sem_corroboracao'
      when v_desde > 0                  then 'quebrado'
      else                                   'sem_uso'
    end;

    insert into marts.rastreio_corroboracao
      (tipo, fonte, registros_na_fonte, fonte_total, ultimo_evento,
       veredito, verificado_em)
    values
      (r.tipo, v_fonte, v_desde, v_total, r.ultimo_registro,
       v_veredito, now())
    on conflict (tipo) do update set
      fonte              = excluded.fonte,
      registros_na_fonte = excluded.registros_na_fonte,
      fonte_total        = excluded.fonte_total,
      ultimo_evento      = excluded.ultimo_evento,
      veredito           = excluded.veredito,
      verificado_em      = excluded.verificado_em;
  end loop;

  delete from marts.rastreio_corroboracao c
  where not exists (
    select 1 from marts.rastreio_por_tipo() rp
    where rp.tipo = c.tipo and rp.status in ('atrasado', 'parado'));
end;
$function$;

comment on function etl.corroborar_rastreio() is
  'Decide, para cada tipo atrasado ou parado, se o silêncio é rastreio quebrado ou funcionalidade sem uso, comparando o evento com uma fonte independente do mesmo fato desde a última data registrada. Roda no cron diário porque lê foreign table: dentro da RPC seria uma ida à plataforma por render, e o card de saúde passaria a falhar exatamente quando o FDW cai. Qualquer falha de leitura vira sem_corroboracao, nunca sem_uso.';

-- ---------------------------------------------------------------------------
-- 4. A régua publica o veredito
-- ---------------------------------------------------------------------------

drop function public.bi_saude_rastreio();
drop function marts.rastreio_por_tipo();

create function marts.rastreio_por_tipo()
returns table(
  tipo text, modulo text, ultimo_registro date, dias_parado integer,
  eventos_total bigint, status text,
  veredito text, fonte text, registros_na_fonte bigint,
  verificado_em timestamptz)
language sql stable set search_path to ''
as $function$
  with hoje as materialized (select marts.data_referencia() d),
  por_tipo as materialized (
    select f.tipo, max(f.data_brt) as ultimo, count(*) as eventos
    from marts.fact_evento f
    group by 1
  )
  select t.tipo,
         marts.modulo_do_evento(t.tipo),
         t.ultimo,
         (h.d - t.ultimo)::integer,
         t.eventos,
         case when h.d - t.ultimo <= 7 then 'ativo'
              when h.d - t.ultimo <= 30 then 'atrasado'
              else 'parado' end,
         c.veredito,
         c.fonte,
         c.registros_na_fonte,
         c.verificado_em
  from por_tipo t
  cross join hoje h
  left join marts.rastreio_corroboracao c on c.tipo = t.tipo;
$function$;

comment on function marts.rastreio_por_tipo() is
  'Régua única de saúde de instrumentação: última data com registro por tipo de evento, contada a partir de marts.data_referencia(). O status responde SÓ "faz quanto tempo que não registra" — e isso não separa cano entupido de torneira fechada. Quem separa é o veredito, que vem de marts.rastreio_corroboracao (cron diário) e pode ser null enquanto o tipo estiver ativo ou ainda não verificado. Lida por public.bi_saude_rastreio (que a publica) e pela guarda de public.bi_acoes_por_modulo. NÃO aplica a régua e_cliente, de propósito — mede instrumentação, não cliente; filtrar por cliente esconderia justamente o rastreio quebrado que só aparece no uso interno. Quem a ler não deve repetir o filtro nem "corrigir" a ausência dele.';

create function public.bi_saude_rastreio()
returns table(
  tipo text, modulo text, ultimo_registro date, dias_parado integer,
  eventos_total bigint, status text,
  veredito text, fonte text, registros_na_fonte bigint,
  verificado_em timestamptz)
language sql stable set search_path to ''
as $function$
  select r.tipo, r.modulo, r.ultimo_registro, r.dias_parado, r.eventos_total,
         r.status, r.veredito, r.fonte, r.registros_na_fonte, r.verificado_em
  from marts.rastreio_por_tipo() r
  order by r.dias_parado desc, r.eventos_total desc;
$function$;

comment on function public.bi_saude_rastreio() is
  'Mede saúde de instrumentação, não comportamento de cliente — por isso NÃO aplica a régua e_cliente, de propósito. Filtrar por cliente esconderia justamente o rastreio quebrado que só aparece no uso interno, que é o que esta função existe para encontrar. Não "corrigir". Publica a classificação de marts.rastreio_por_tipo() e o veredito que a distingue: parado sozinho não diz se o cano entupiu ou se a torneira fechou.';

revoke execute on function public.bi_saude_rastreio() from public, anon;
grant execute on function public.bi_saude_rastreio() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. A guarda prometida pelo passo 1
-- ---------------------------------------------------------------------------

drop function public.bi_acoes_por_modulo(integer, text, text);

create function public.bi_acoes_por_modulo(
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
  -- A guarda. Só morde quando a razão de fato sai errada: o módulo tem consumo
  -- vivo (logo o denominador continua enchendo) E um tipo de compromisso
  -- QUEBRADO que esta função lê (logo o numerador perdeu eventos). Módulo sem
  -- consumo vivo publica 100% com ou sem a quebra — ali o que engana é o
  -- volume, e isso é outro card.
  guarda as (
    select r.modulo,
           bool_or(marts.tipo_de_acao(r.tipo) = 'consumo' and r.status = 'ativo')
             as tem_consumo_vivo,
           array_agg(r.tipo order by r.tipo) filter (
             where r.veredito = 'quebrado'
               and marts.tipo_de_acao(r.tipo) = 'compromisso'
               and not marts.evento_aposentado(r.tipo)
           ) as quebrados
    from marts.rastreio_por_tipo() r
    group by 1
  ),
  com_guarda as (
    select m.modulo, m.consumo, m.compromisso, m.total, m.clientes,
           case when coalesce(g.tem_consumo_vivo, false) and g.quebrados is not null
                then g.quebrados end as suprimido_por
    from por_modulo m
    left join guarda g on g.modulo = m.modulo
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
  'Ações de produto por módulo, separadas em consumo e compromisso. O INÍCIO DE SOLUÇÃO sai de marts.fact_progresso_solucao, não do evento solution_started, e isso é permanente (ver 20260818030000). A lista de eventos aposentados vive em marts.evento_aposentado, lida aqui pela exclusão E pela guarda. GUARDA: pct_compromisso e a média da plataforma são suprimidos quando o módulo tem consumo vivo e um tipo de compromisso com veredito quebrado — o caso do Soluções em 17/08, quando solution_started calou e a tela publicou 1,6%. suprimido_por nomeia os tipos, para a tela declarar em vez de o módulo sumir do gráfico. Régua e_cliente nos dois braços; janela em marts.data_referencia().';

revoke execute on function public.bi_acoes_por_modulo(integer, text, text) from public, anon;
grant execute on function public.bi_acoes_por_modulo(integer, text, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6. No ciclo diário, depois das reconciliações
-- ---------------------------------------------------------------------------

select cron.schedule(
  'bi_corroborar_rastreio',
  '45 7 * * *',  -- 04:45 BRT, depois de propagar_exclusoes e reconciliar_valores
  $cron$select etl.executar_passo('etl.corroborar_rastreio()')$cron$);

-- Primeira carga junto da migration: sem ela a régua serviria veredito nulo
-- para todo mundo até a madrugada seguinte, e o card mostraria "a verificar"
-- num estado que já dá para calcular agora.
select etl.corroborar_rastreio();
