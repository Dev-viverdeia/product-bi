-- =====================================================================
-- bi_cs_kpis — a única RPC que os TRÊS grupos reescrevem
-- =====================================================================
-- Cada grupo entregou a sua versão mexendo num pedaço do corpo:
--   · retenção  → revertidos/em_tentativa_reversao viram retidos/em_aberto (+2 campos)
--   · disparos  → destinatario_hash vira pessoa_hash
--   · atendimento → não muda nada (abriu_em_brt e contato_hash sobreviveram de propósito)
-- Como o corpo é um só, aplicar as versões em sequência faria a última vencer e
-- desfazer as outras. Esta migration é a versão merged e é a ÚLTIMA a tocar
-- bi_cs_kpis; os blocos de bi_cs_kpis dos arquivos de grupo saíram.

-- A assinatura muda (6 → 8 colunas de retorno): create or replace não dá conta.
drop function if exists public.bi_cs_kpis(integer);

create function public.bi_cs_kpis(p_dias integer default 30)
returns table (
  atendimentos             bigint,
  contatos                 bigint,
  solicitacoes_cancelamento bigint,
  pessoas_impactadas       bigint,
  retidos                  bigint,
  em_aberto                bigint,
  perdidos                 bigint,
  perdidos_com_base_ativa  bigint
)
language sql
stable
set search_path to ''
as $function$
  with j as (select (now() at time zone 'America/Sao_Paulo')::date - p_dias as inicio)
  select
    (select count(*) from marts.fact_cs_atendimento
      where abriu_em_brt > (select inicio from j)),
    (select count(distinct contato_hash) from marts.fact_cs_atendimento
      where abriu_em_brt > (select inicio from j)),
    (select count(*) from marts.fact_cs_cancelamento
      where solicitado_em_brt > (select inicio from j)),
    -- pessoa_hash, não hash de canal: 46.245 das 49.472 linhas trazem e-mail E fone,
    -- e contar por canal contaria a mesma pessoa duas vezes.
    (select count(distinct pessoa_hash) from marts.fact_cs_envio
      where status = 'sent' and criado_em_brt > (select inicio from j)),
    -- Os quatro de retenção são FOTO, não janela: dim_cs_empresa é o estado atual
    -- das 232 empresas em processo, sem série temporal. Aplicar p_dias aqui daria a
    -- impressão de "retidos nos últimos 30 dias", que o dado não sustenta.
    (select count(*) from marts.dim_cs_empresa where desfecho = 'RETIDO'),
    (select count(*) from marts.dim_cs_empresa where desfecho = 'EM_ABERTO'),
    (select count(*) from marts.dim_cs_empresa where desfecho = 'PERDIDO'),
    -- Sai como KPI próprio porque é a divergência que a tela tem que declarar em vez
    -- de escolher um lado: PERDIDO é a verdade do CS, base_ativa é a da plataforma, e
    -- 57 dos 100 perdidos ainda têm acesso.
    (select count(*) from marts.dim_cs_empresa where desfecho_conflita_base);
$function$;

comment on function public.bi_cs_kpis(integer) is
  'KPIs de CS. atendimentos/contatos/solicitacoes/pessoas seguem p_dias; retidos/em_aberto/perdidos/perdidos_com_base_ativa são estado atual da carteira de retenção e ignoram o período.';

revoke execute on function public.bi_cs_kpis(integer) from public;
revoke execute on function public.bi_cs_kpis(integer) from anon;
grant  execute on function public.bi_cs_kpis(integer) to authenticated;
