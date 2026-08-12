-- =====================================================================
-- RPCs de disparos no vocabulário do contrato pulse
-- =====================================================================
-- marts.v_cs_frescor e public.bi_cs_frescor NÃO estão aqui: a dona dos dois é a
-- migration cs_view_frescor, que reconcilia as três versões entregues pelos
-- grupos. Recriar qualquer um dos dois aqui faria a última migration vencer.

create or replace function public.bi_cs_disparos_mensal()
 returns table (mes date, disparos bigint, mensagens bigint, pessoas bigint, falhas bigint)
 language sql stable set search_path to ''
as $function$
  -- 'disparos' passa a contar sent E partial: o filtro só em 'sent' deixava de fora as 16
  -- campanhas parciais, que mandaram mensagem de verdade. Mensagem/pessoa/falha vêm sempre
  -- do log por destinatário — o contador da campanha é intenção (9.846 declarados contra
  -- 4.721 entregues na campanha cancelada de 23/07/2026).
  with envio as (
    select date_trunc('month', e.criado_em_brt)::date as mes,
           count(*) filter (where e.status = 'sent') as mensagens,
           count(distinct e.pessoa_hash) filter (where e.status = 'sent') as pessoas,
           count(*) filter (where e.status = 'failed') as falhas
    from marts.fact_cs_envio e group by 1
  ),
  campanha as (
    select date_trunc('month', d.criado_em_brt)::date as mes,
           count(*) filter (where d.status in ('sent','partial')) as disparos
    from marts.fact_cs_disparo d group by 1
  )
  select e.mes, coalesce(c.disparos, 0), e.mensagens, e.pessoas, e.falhas
  from envio e left join campanha c using (mes)
  order by 1;
$function$;

revoke execute on function public.bi_cs_disparos_mensal() from public;
revoke execute on function public.bi_cs_disparos_mensal() from anon;
grant  execute on function public.bi_cs_disparos_mensal() to authenticated;


-- Série própria: avulso é envio 1:1, não broadcast — somar com campanha misturaria
-- duas naturezas de mensageria no mesmo número. A parada em 06/07/2026 não é tratada
-- aqui; quem declara é bi_cs_frescor.
create or replace function public.bi_cs_avulsos_mensal()
 returns table (mes date, envios bigint, falhas bigint, pessoas bigint)
 language sql stable set search_path to ''
as $function$
  select date_trunc('month', a.criado_em_brt)::date,
         count(*) filter (where a.status = 'sent'),
         count(*) filter (where a.status = 'failed'),
         count(distinct a.fone_hash) filter (where a.status = 'sent')
  from marts.fact_cs_disparo_avulso a
  group by 1 order by 1;
$function$;

revoke execute on function public.bi_cs_avulsos_mensal() from public;
revoke execute on function public.bi_cs_avulsos_mensal() from anon;
grant  execute on function public.bi_cs_avulsos_mensal() to authenticated;
