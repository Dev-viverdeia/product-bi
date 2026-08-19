-- O card "A IA resolveu sozinha?" passa a afirmar o que ele desenha
--
-- O DEFEITO
--
-- O card publicava "15,6% sem humano assumir" e o gráfico plotava `so_ia` por
-- desfecho — resolvido 29 · em aberto 65. O headline era uma terceira conta,
-- feita no front: a soma de `so_ia` sobre a soma de `total` (94/614). Esse
-- número não existe em nenhuma barra, e quem clicou no card para conferir de
-- onde ele saiu não encontrava.
--
-- Pior: as duas metades do card respondem perguntas diferentes. O título
-- pergunta se a IA RESOLVEU; o headline responde quantos ciclos a IA TOCOU
-- sozinha, resolvendo ou não. O gráfico, esse sim, tinha a resposta certa e
-- ninguém a estava lendo: dos 94 ciclos sem humano, 65 seguem em aberto.
--
-- O CONSERTO
--
-- `pct_dos_sem_humano` é a fatia de cada desfecho DENTRO dos ciclos sem humano:
-- as duas linhas somam 100% e cada uma é exatamente uma barra do gráfico. O
-- headline passa a ser a linha 'resolvido' — 30,9% — que é a razão entre a
-- primeira barra e a soma das duas. A pergunta do título e o número do
-- headline voltam a ser a mesma pergunta.
--
-- A supressão tem denominador em `sem_humano_total`, não em `ciclos_total`:
-- é sobre os sem humano que a fatia é calculada, e é essa base que fica
-- pequena numa janela curta.
--
-- `sem_humano_total` e `ciclos_total` viram colunas de janela para a tela poder
-- declarar a cobertura sem somar no front — 94 de 614 ciclos no período.
--
-- ⚠️ `now()` fica, e isso NÃO é dívida esquecida: a fonte desta família é o
-- Pulse, que tem frescor próprio, e as seis `bi_cs_*` estão fora da migração
-- para `marts.data_referencia()` por decisão declarada.
--
-- `drop` e não `create or replace`: o tipo de retorno muda.

drop function if exists public.bi_cs_atendimento_ia_humano(integer);

create function public.bi_cs_atendimento_ia_humano(p_dias integer default 30)
returns table(
  desfecho text,
  so_ia bigint,
  com_humano bigint,
  total bigint,
  pct_dos_sem_humano numeric,
  sem_humano_total bigint,
  ciclos_total bigint
)
language sql
stable
set search_path to ''
as $function$
  with base as (
    select a.desfecho,
           count(*) filter (where not a.tem_atendente_humano) as so_ia,
           count(*) filter (where a.tem_atendente_humano) as com_humano,
           count(*) as total
    from marts.fact_cs_atendimento a
    where a.abriu_em_brt > (now() at time zone 'America/Sao_Paulo')::date - p_dias
    group by 1
  ),
  tot as (
    select coalesce(sum(so_ia), 0)::bigint as sem_humano_total,
           coalesce(sum(total), 0)::bigint as ciclos_total
    from base
  )
  select b.desfecho, b.so_ia, b.com_humano, b.total,
         case when t.sem_humano_total >= 30
              then round(b.so_ia::numeric / t.sem_humano_total, 4) end,
         t.sem_humano_total, t.ciclos_total
  from base b cross join tot t
  order by b.total desc;
$function$;

grant execute on function public.bi_cs_atendimento_ia_humano(integer) to authenticated, service_role;

comment on function public.bi_cs_atendimento_ia_humano(integer) is
  'Desfecho dos ciclos de atendimento, separando quem teve atendente humano de quem nao teve. pct_dos_sem_humano e a fatia de cada desfecho DENTRO dos ciclos sem humano - as linhas somam 100% e cada uma e uma barra do card. Existe porque o headline do card era uma terceira conta feita no front (soma de so_ia sobre soma de total) que nao aparecia em barra nenhuma. Denominador da supressao e sem_humano_total, nao ciclos_total. now() fica de proposito: a fonte e o Pulse, que tem frescor proprio.';
