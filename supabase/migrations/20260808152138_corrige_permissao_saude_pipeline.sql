-- `bi_saude_pipeline` lia direto de etl.* e quebrava no app com
-- "permission denied for schema etl" (42501) — o schema etl é fechado de
-- propósito e `authenticated` não tem usage nele.
--
-- Correção sem abrir o schema interno e sem voltar para security definer
-- (que reacenderia o advisor 0029): uma view em `marts` faz a ponte. View comum
-- executa com a permissão do OWNER, então `authenticated` lê os metadados
-- através dela sem ganhar acesso a `etl`.

create or replace view marts.v_saude_pipeline as
select
  (select max(ultima_execucao) from etl.sync_state
    where tabela <> 'fact_navegacao') as ultima_sync,
  (select count(*)::integer from etl.sync_state
    where ultima_execucao > now() - interval '90 minutes') as tabelas_ok,
  (select count(*)::integer from etl.sync_runs
    where not sucesso and iniciado_em > now() - interval '6 hours') as falhas_recentes,
  -- só a 1ª linha do erro: detalhe de infraestrutura fica no log interno
  (select split_part(left(erro, 200), E'\n', 1) from etl.sync_runs
    where not sucesso and iniciado_em > now() - interval '6 hours'
    order by iniciado_em desc limit 1) as ultimo_erro;

comment on view marts.v_saude_pipeline is
  'Metadados de sincronização para o app (sem PII). Ponte de permissão: evita expor o schema etl.';

grant select on marts.v_saude_pipeline to authenticated;

create or replace function public.bi_saude_pipeline()
returns table (
  ultima_sync timestamptz,
  horas_desde_sync numeric,
  esta_defasado boolean,
  tabelas_ok integer,
  falhas_recentes integer,
  ultimo_erro text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    v.ultima_sync,
    round(extract(epoch from now() - v.ultima_sync) / 3600.0, 1),
    (now() - v.ultima_sync) > interval '90 minutes',
    v.tabelas_ok,
    v.falhas_recentes,
    v.ultimo_erro
  from marts.v_saude_pipeline v;
$$;

revoke execute on function public.bi_saude_pipeline() from public, anon;
grant execute on function public.bi_saude_pipeline() to authenticated;
