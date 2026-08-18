-- A série de cancelamento declara o que fica de fora
--
-- Quarto corte da auditoria de 18/08: a tela de CS, que nenhum corte anterior
-- tinha alcançado (fonte diferente, grão de empresa).
--
-- A TELA DE CS PASSOU BEM NA MAIOR PARTE
--
-- Conferido e reconciliando exatamente:
--
--   bi_cs_kpis.atendimentos            582
--   bi_cs_atendimento_por_canal        582  ✓
--   bi_cs_atendimento_ia_humano        582  ✓ (so_ia 82 + com_humano 500)
--   bi_cs_atendimento_por_atendente    500  = com_humano, por construção
--
-- O 500 do card "Quem atendeu" parecia divergir do KPI de 582, e não diverge:
-- os 82 que faltam são exatamente os ciclos `so_ia`, que o card vizinho publica.
-- Os dois são complementares.
--
-- bi_cs_retencao reconcilia com os KPIs (351 + 90 + 42 = 483), e
-- `desfecho_conflita_base` só é verdadeiro para PERDIDO (254 de 351) — o rótulo
-- "perdidos com base ativa" está certo. Os quatro KPIs de retenção são FOTO e
-- não janela, e a tela declara isso no próprio rótulo ("Clientes retidos
-- (total)").
--
-- O DEFEITO: A SÉRIE MENSAL MOSTRA MENOS QUE OS VIZINHOS, SEM DIZER
--
--   Solicitações de cancelamento por mês   509
--   Por origem                             539
--   Por desfecho                           539
--
-- Trinta pedidos (5,6%) não têm `solicitado_em` — e a exclusão está CERTA: não
-- há onde pôr linha sem data num eixo de tempo. O que falta é a declaração. Quem
-- soma a série e compara com o card ao lado encontra trinta de diferença e não
-- tem como saber de onde vêm.
--
-- Conferido na origem antes de tratar como defeito nosso: `pulse.cancelamentos`
-- também tem trinta sem data. O espelho não perdeu nada — o campo nasce vazio lá.
--
-- A CORREÇÃO SEGUE O PADRÃO QUE JÁ EXISTE NA CASA
--
-- `sem_data` vem repetido em toda linha, do mesmo jeito que
-- `bi_acoes_por_modulo` repete `pct_compromisso_geral`: o número sai do banco,
-- com a mesma régua da série, e a tela não precisa calculá-lo — que é
-- justamente como um total escaparia da supressão.
--
-- ⚠️ ISTO SÓ APARECEU PORQUE AS REDES DE CS RODARAM PELA PRIMEIRA VEZ
--
-- `bi_propagar_exclusoes_cs` e `bi_reconciliar_valores_cs` foram criados hoje de
-- manhã (passo 2 da Fase 2) com horário 07:25 e 07:35 UTC — ou seja, DEPOIS da
-- janela de hoje. `cron.job_run_details` mostrava zero execução para os dois, e
-- eu os executei à mão durante esta auditoria:
--
--   propagar_exclusoes_cs   16 cancelamentos fantasmas removidos
--                           (mart 555 -> 539 = origem 539; canário 16 -> 0)
--   reconciliar_valores_cs  47 cancelamentos e 14 atendimentos com valor
--                           defasado, corrigidos
--
-- Sessenta e um registros com valor errado estavam publicados na tela de CS. O
-- desenho do passo 2 estava certo; ele só nunca tinha rodado. Fica o registro de
-- que **criar o cron não é o mesmo que o cron ter rodado** — a primeira execução
-- de um passo novo merece ser forçada à mão, ou o defeito que ele conserta
-- continua no ar até a madrugada seguinte.

drop function public.bi_cs_cancelamento_mensal();

create function public.bi_cs_cancelamento_mensal()
returns table(mes date, solicitacoes bigint, sem_data bigint)
language sql stable set search_path to ''
as $function$
  -- sem_data é o mesmo número em toda linha, de propósito: a tela declara o
  -- corte sem somar nada por conta própria. Mesmo padrão de
  -- bi_acoes_por_modulo.pct_compromisso_geral.
  select date_trunc('month', c.solicitado_em_brt)::date,
         count(*),
         (select count(*) from marts.fact_cs_cancelamento f
          where f.solicitado_em_brt is null)
  from marts.fact_cs_cancelamento c
  where c.solicitado_em_brt is not null
  group by 1 order by 1;
$function$;

comment on function public.bi_cs_cancelamento_mensal() is
  'Solicitações de cancelamento por mês. Pedido sem `solicitado_em` fica FORA da série — não há onde pôr linha sem data num eixo de tempo — e por isso a soma desta série é menor que a de bi_cs_cancelamento_origem e bi_cs_cancelamento_desfecho, que contam o fato inteiro. `sem_data` devolve quantos ficaram de fora, repetido em toda linha, para a tela declarar o corte sem calcular nada. O campo nasce vazio na origem (pulse.cancelamentos tem a mesma proporção), então não é perda do espelho. Ancora em now() como o resto de CS: a fonte é o Pulse e tem frescor próprio.';

revoke execute on function public.bi_cs_cancelamento_mensal() from public, anon;
grant execute on function public.bi_cs_cancelamento_mensal() to authenticated, service_role;
