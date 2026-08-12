-- =====================================================================
-- Frescor do CS — versão única e reconciliada dos três grupos
-- =====================================================================
-- Esta migration é a DONA da view. Os arquivos de DDL dos três grupos mantêm o
-- `drop view if exists marts.v_cs_frescor` (sem ele o drop das tabelas falha
-- por dependência) e NÃO recriam a view — as três versões entregues se
-- contradiziam e a última a rodar venceria:
--   · a do pipeline lia marts.fact_cs_clique, que o grupo de disparos DROPA;
--   · a de disparos lia dim_cs_empresa.snap_at, coluna que morreu no redesenho
--     do pipeline (a dim nova tem cliente_key/etapa_desde, não snap_at);
--   · nenhuma das duas respondia "até que data o dado vai", que é o pedido.
--
-- A view responde TRÊS perguntas que a tela precisa separar sozinha:
--   carga_defasada    → o BI parou de carregar              (problema nosso)
--   fonte_parada      → o BI está em dia, a origem é que não produz evento novo
--   ultimo_evento_brt → até que data a série vai            (a tela escreve a frase)
create or replace view marts.v_cs_frescor as
with declarado (tabela, limite_dias) as (
  -- limite_dias NÃO é chute: é o maior silêncio já medido na origem, arredondado
  -- para cima. Medição de 12/08/2026 sobre as foreign tables do pulse (maior
  -- intervalo entre eventos consecutivos, em dias):
  --   movimento 1,72 · atendimento 3,10 · empresa 3,10 · card 6,11
  --   envio 6,83 · disparo 6,86 · cancelamento p99 13,0 (máx 161, cauda do início)
  -- Os 3 dias que o grupo de disparos propôs para envio/disparo/avulso e os 14 de
  -- cancelamento acusariam "fonte parada" em silêncio de negócio normal — envio
  -- passou de 48h de silêncio 4 vezes na série, e cancelamento tem p99 de 13 dias.
  -- Limite que grita à toa é limite que o time desliga.
  values ('atendimento',  7), ('disparo',   10), ('envio',     10), ('avulso', 10),
         ('card',        10), ('movimento',  5), ('cancelamento', 30), ('empresa', 7)
),
medido (tabela, chave_sync, carregado_em, ultimo_evento, linhas) as (
  select 'atendimento', 'cs_atendimento', max(a.carregado_em), max(a.abriu_em),           count(*)::bigint from marts.fact_cs_atendimento a
  union all
  select 'disparo',     'cs_disparo',     max(d.carregado_em), max(d.criado_em),          count(*)::bigint from marts.fact_cs_disparo d
  union all
  select 'envio',       'cs_envio',       max(e.carregado_em), max(e.criado_em),          count(*)::bigint from marts.fact_cs_envio e
  union all
  select 'avulso',      'cs_avulso',      max(v.carregado_em), max(v.criado_em),          count(*)::bigint from marts.fact_cs_disparo_avulso v
  union all
  select 'card',        'cs_card',        max(c.carregado_em), max(c.entrou_na_etapa_em), count(*)::bigint from marts.fact_cs_card c
  union all
  select 'movimento',   'cs_movimento',   max(m.carregado_em), max(m.criado_em),          count(*)::bigint from marts.fact_cs_movimento m
  union all
  -- solicitado_em é nullable no contrato: max() ignora null, que é o certo aqui —
  -- a pergunta é "até quando vai o dado datado", não "quantos têm data".
  select 'cancelamento','cs_cancelamento',max(n.carregado_em), max(n.solicitado_em),      count(*)::bigint from marts.fact_cs_cancelamento n
  union all
  -- pulse.retencao não tem created_at nem updated_at; etapa_desde é o relógio de
  -- negócio mais recente que a origem entrega, e é por ele que dá para dizer até
  -- onde a foto vai. (É a mesma ausência de relógio que obriga o full refresh.)
  select 'empresa',     'cs_empresa',     max(p.carregado_em), max(p.etapa_desde),        count(*)::bigint from marts.dim_cs_empresa p
)
select
  m.tabela,
  m.linhas,
  m.carregado_em,
  -- Última leitura BEM-SUCEDIDA. sync_state só é escrito no caminho de sucesso, então
  -- este campo é o que denuncia credencial expirada. max(carregado_em) NÃO serve para
  -- isso: com carga automática ele é sempre "agora" para a linha que foi tocada, e
  -- fica verde mesmo com a origem morta.
  s.ultima_execucao                                        as ultima_leitura,
  m.ultimo_evento,
  (m.ultimo_evento at time zone 'America/Sao_Paulo')::date  as ultimo_evento_brt,
  round(extract(epoch from now() - m.ultimo_evento) / 86400.0, 1) as dias_sem_evento,
  d.limite_dias,
  -- Tabela vazia não é "origem parada", é "nunca carregou": sem linha não há
  -- ultimo_evento para comparar, e quem acusa o buraco é carga_defasada.
  (m.linhas > 0 and m.ultimo_evento < now() - make_interval(days => d.limite_dias))
                                                           as fonte_parada,
  (s.ultima_execucao is null or s.ultima_execucao < now() - interval '90 minutes')
                                                           as carga_defasada
from medido m
join declarado d using (tabela)
left join etl.sync_state s on s.tabela = m.chave_sync;

comment on view marts.v_cs_frescor is
  'Frescor por tabela de CS: quanto tem, quando carregou, até que data o dado vai e se o atraso é do BI (carga_defasada) ou da origem (fonte_parada). limite_dias vem do maior silêncio medido em cada foreign table do pulse.';

grant select on marts.v_cs_frescor to authenticated;


-- O formato de retorno mudou (4 colunas novas): tem que cair antes de subir.
drop function if exists public.bi_cs_frescor();

create function public.bi_cs_frescor()
returns table (
  tabela            text,
  linhas            bigint,
  carregado_em      timestamptz,
  ultima_leitura    timestamptz,
  carga_defasada    boolean,
  ultimo_evento     timestamptz,
  ultimo_evento_brt date,
  dias_sem_evento   numeric,
  limite_dias       integer,
  fonte_parada      boolean
)
language sql
stable
set search_path to ''
as $function$
  select f.tabela, f.linhas, f.carregado_em, f.ultima_leitura, f.carga_defasada,
         f.ultimo_evento, f.ultimo_evento_brt, f.dias_sem_evento, f.limite_dias,
         f.fonte_parada
  from marts.v_cs_frescor f
  order by f.tabela;
$function$;

-- drop function reseta a ACL e PUBLIC volta a ter execute: sem estas três linhas a
-- entrega desfaz a migration 20260812165144_fecha_rpcs_abertas_ao_anon.
revoke execute on function public.bi_cs_frescor() from public;
revoke execute on function public.bi_cs_frescor() from anon;
grant  execute on function public.bi_cs_frescor() to authenticated;
