-- Interface do módulo de CS. Lê marts.*_cs_*, que hoje estão vazias: quando a
-- carga entrar, estas funções acendem sem alteração.
--
-- Duas regras atravessam todas elas:
--   'skipped_dedup' nunca conta como envio (é trava anti-duplicidade de 24h);
--   empresa só é atribuída quando o telefone resolve UMA empresa.

create or replace function public.bi_cs_frescor()
returns table(tabela text, carregado_em timestamptz, linhas bigint)
language sql stable set search_path to ''
as $$ select f.tabela, f.carregado_em, f.linhas from marts.v_cs_frescor f order by 1; $$;

comment on function public.bi_cs_frescor() is
  'Data de carga por tabela. A tela usa para declarar de quando é o dado.';

-- Revertidos e tentativas NÃO são recortados por período: são estado atual da
-- carteira, não evento da janela. Misturar os dois num mesmo card seria comparar
-- coisas de naturezas diferentes.
create or replace function public.bi_cs_kpis(p_dias integer default 30)
returns table(
  atendimentos bigint, contatos bigint, solicitacoes_cancelamento bigint,
  pessoas_impactadas bigint, revertidos bigint, em_tentativa_reversao bigint)
language sql stable set search_path to ''
as $$
  with j as (select (now() at time zone 'America/Sao_Paulo')::date - p_dias as inicio)
  select
    (select count(*) from marts.fact_cs_atendimento where abriu_em_brt > (select inicio from j)),
    (select count(distinct contato_hash) from marts.fact_cs_atendimento where abriu_em_brt > (select inicio from j)),
    (select count(*) from marts.fact_cs_cancelamento where solicitado_em_brt > (select inicio from j)),
    (select count(distinct destinatario_hash) from marts.fact_cs_envio
      where status = 'sent' and criado_em_brt > (select inicio from j)),
    (select count(*) from marts.dim_cs_empresa where status_retencao = 'REVERTIDO'),
    (select count(*) from marts.dim_cs_empresa where em_tentativa_reversao);
$$;

create or replace function public.bi_cs_atendimento_mensal()
returns table(mes date, atendimentos bigint, conversas bigint, contatos bigint)
language sql stable set search_path to ''
as $$
  select date_trunc('month', a.abriu_em_brt)::date,
         count(*), count(distinct a.thread_id), count(distinct a.contato_hash)
  from marts.fact_cs_atendimento a group by 1 order by 1;
$$;

-- atendente_id nulo = a IA resolveu sozinha e nenhum humano assumiu o ciclo
create or replace function public.bi_cs_atendimento_ia_humano(p_dias integer default 30)
returns table(desfecho text, so_ia bigint, com_humano bigint, total bigint)
language sql stable set search_path to ''
as $$
  select a.desfecho,
         count(*) filter (where a.atendente_id is null),
         count(*) filter (where a.atendente_id is not null),
         count(*)
  from marts.fact_cs_atendimento a
  where a.abriu_em_brt > (now() at time zone 'America/Sao_Paulo')::date - p_dias
  group by 1 order by 4 desc;
$$;

create or replace function public.bi_cs_atendimento_por_atendente(p_dias integer default 30)
returns table(atendente text, atendimentos bigint, contatos bigint)
language sql stable set search_path to ''
as $$
  select coalesce(a.atendente_nome, '(sem nome)'), count(*), count(distinct a.contato_hash)
  from marts.fact_cs_atendimento a
  where a.atendente_id is not null
    and a.abriu_em_brt > (now() at time zone 'America/Sao_Paulo')::date - p_dias
  group by 1 order by 2 desc;
$$;

create or replace function public.bi_cs_atendimento_por_canal(p_dias integer default 30)
returns table(canal text, atendimentos bigint)
language sql stable set search_path to ''
as $$
  select coalesce(a.canal, '(sem canal)'), count(*)
  from marts.fact_cs_atendimento a
  where a.abriu_em_brt > (now() at time zone 'America/Sao_Paulo')::date - p_dias
  group by 1 order by 2 desc;
$$;

-- A tela PRECISA declarar isto: só 'unica' é atribuível. Sem esta função o card
-- de atendimento por empresa apresentaria 70% da base como se fosse 100%.
create or replace function public.bi_cs_atendimento_cobertura(p_dias integer default 30)
returns table(atribuicao text, atendimentos bigint, pct numeric)
language sql stable set search_path to ''
as $$
  select a.atribuicao_empresa, count(*),
         round(count(*)::numeric / nullif(sum(count(*)) over (), 0), 4)
  from marts.fact_cs_atendimento a
  where a.abriu_em_brt > (now() at time zone 'America/Sao_Paulo')::date - p_dias
  group by 1 order by 2 desc;
$$;

create or replace function public.bi_cs_disparos_mensal()
returns table(mes date, disparos bigint, mensagens bigint, pessoas bigint, falhas bigint)
language sql stable set search_path to ''
as $$
  select m.mes,
         (select count(*) from marts.fact_cs_disparo d
           where date_trunc('month', d.criado_em_brt)::date = m.mes and d.status = 'sent'),
         (select count(*) from marts.fact_cs_envio e
           where date_trunc('month', e.criado_em_brt)::date = m.mes and e.status = 'sent'),
         (select count(distinct e.destinatario_hash) from marts.fact_cs_envio e
           where date_trunc('month', e.criado_em_brt)::date = m.mes and e.status = 'sent'),
         (select count(*) from marts.fact_cs_envio e
           where date_trunc('month', e.criado_em_brt)::date = m.mes and e.status = 'failed')
  from (select distinct date_trunc('month', criado_em_brt)::date as mes
        from marts.fact_cs_envio) m
  order by 1;
$$;

create or replace function public.bi_cs_disparos_por_canal(p_dias integer default 30)
returns table(canal text, enviados bigint, falhas bigint, ignorados bigint, pct_erro numeric)
language sql stable set search_path to ''
as $$
  select e.canal,
         count(*) filter (where e.status = 'sent'),
         count(*) filter (where e.status = 'failed'),
         count(*) filter (where e.status = 'skipped_dedup'),
         round(count(*) filter (where e.status = 'failed')::numeric
               / nullif(count(*) filter (where e.status in ('sent','failed')), 0), 4)
  from marts.fact_cs_envio e
  where e.criado_em_brt > (now() at time zone 'America/Sao_Paulo')::date - p_dias
  group by 1 order by 2 desc;
$$;

create or replace function public.bi_cs_cancelamento_mensal()
returns table(mes date, solicitacoes bigint)
language sql stable set search_path to ''
as $$
  select date_trunc('month', c.solicitado_em_brt)::date, count(*)
  from marts.fact_cs_cancelamento c
  where c.solicitado_em_brt is not null group by 1 order by 1;
$$;

create or replace function public.bi_cs_cancelamento_origem()
returns table(origem text, solicitacoes bigint)
language sql stable set search_path to ''
as $$
  select coalesce(c.origem, '(sem origem)'), count(*)
  from marts.fact_cs_cancelamento c group by 1 order by 2 desc;
$$;

-- tipo_acordo é DESFECHO comercial. O motivo do cancelamento é texto livre com
-- 45% vazio e não sustenta distribuição — não existe função para ele de
-- propósito, e a tela diz por quê.
create or replace function public.bi_cs_cancelamento_desfecho()
returns table(tipo_acordo text, solicitacoes bigint)
language sql stable set search_path to ''
as $$
  select coalesce(c.tipo_acordo, '(ainda sem acordo)'), count(*)
  from marts.fact_cs_cancelamento c group by 1 order by 2 desc;
$$;

create or replace function public.bi_cs_funil(p_quadro text)
returns table(etapa text, etapa_ordem integer, cards bigint)
language sql stable set search_path to ''
as $$
  select c.etapa, c.etapa_ordem, count(*)
  from marts.fact_cs_card c
  where c.quadro = p_quadro
  group by 1, 2 order by 2;
$$;

-- Régua do Product BI: revertido é acordo OU etapa "Revertido". Card no quadro
-- Reversão sozinho é tentativa e sai em coluna separada — nunca somado aqui.
create or replace function public.bi_cs_retencao()
returns table(status text, empresas bigint, em_tentativa_reversao bigint)
language sql stable set search_path to ''
as $$
  select e.status_retencao, count(*), count(*) filter (where e.em_tentativa_reversao)
  from marts.dim_cs_empresa e
  where e.status_retencao is not null
  group by 1 order by 2 desc;
$$;

grant execute on function
  public.bi_cs_frescor(), public.bi_cs_kpis(integer),
  public.bi_cs_atendimento_mensal(), public.bi_cs_atendimento_ia_humano(integer),
  public.bi_cs_atendimento_por_atendente(integer), public.bi_cs_atendimento_por_canal(integer),
  public.bi_cs_atendimento_cobertura(integer), public.bi_cs_disparos_mensal(),
  public.bi_cs_disparos_por_canal(integer), public.bi_cs_cancelamento_mensal(),
  public.bi_cs_cancelamento_origem(), public.bi_cs_cancelamento_desfecho(),
  public.bi_cs_funil(text), public.bi_cs_retencao()
to authenticated;
