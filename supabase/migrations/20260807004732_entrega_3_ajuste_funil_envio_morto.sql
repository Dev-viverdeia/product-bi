-- Ajuste de honestidade do funil: o rastreamento de envio (invite_deliveries)
-- PAROU em 19/abr/2026 (medido). Em janelas atuais a etapa ficaria 0 e
-- enganaria o leitor — removida do funil padrão. Histórico jul/25–abr/26
-- permanece em marts.fact_convite_envio para análises retroativas.
create or replace function public.bi_funil_entrada(p_dias integer default 30)
returns table (etapa text, ordem integer, quantidade bigint, pct_do_inicio numeric)
language sql stable security invoker set search_path = '' as $$
  with hoje as (select (now() at time zone 'America/Sao_Paulo')::date d),
  janela as (
    select c.* from marts.fact_convite c, hoje h
    where c.deletado_em is null
      and (c.criado_em at time zone 'America/Sao_Paulo')::date > h.d - p_dias
  ),
  n as (
    select
      (select count(*) from janela) as criados,
      (select count(usado_em) from janela) as usados,
      (select count(*) from janela j
        join marts.fact_onboarding o on o.user_id = j.usado_por and o.concluido) as onboarding,
      (select count(distinct j.usado_por) from janela j
        where j.usado_por is not null
          and exists (select 1 from marts.fact_evento f where f.user_id = j.usado_por)) as primeira_acao
  )
  select e.etapa, e.ordem, e.quantidade,
         round(e.quantidade::numeric / nullif(n.criados, 0), 4)
  from n, lateral (values
    ('Convites criados', 1, n.criados),
    ('Cadastros (convite usado)', 2, n.usados),
    ('Onboarding concluído', 3, n.onboarding),
    ('1ª ação de produto', 4, n.primeira_acao)
  ) as e(etapa, ordem, quantidade)
  order by e.ordem;
$$;
