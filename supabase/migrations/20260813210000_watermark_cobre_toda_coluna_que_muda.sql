-- O watermark não via toda mudança
--
-- Medido em 13/08/2026: 31 conclusões de solução e 3 usos de convite existiam na
-- origem e não no espelho. Não era defasagem — as 31 tinham `completed_at`
-- POSTERIOR a `last_activity`, e todas com `last_activity` atrás do watermark.
--
-- A plataforma grava `is_completed`/`completed_at` sem tocar em `last_activity`,
-- e grava `used_at` sem tocar em `updated_at`. Como o sync lê incremental por
-- essas colunas, a mudança fica invisível PARA SEMPRE — o watermark já passou
-- daquele ponto e nunca mais volta.
--
-- É a mesma família do defeito de exclusão: o incremental só enxerga o que a
-- origem se lembra de carimbar.
--
-- Duas frentes de propósito: fechar a chave resolve o que foi descoberto; o
-- passo de reconciliação pega o que não foi, e o que a plataforma inventar
-- depois.

-- 1) Fechar a chave incremental onde sabemos que ela falha.
create or replace function etl.sync_fact_progresso_solucao(p_max_dias integer default 45)
returns integer language plpgsql security definer set search_path to ''
as $function$
declare
  v_inicio timestamptz := now(); v_wm timestamptz; v_ate timestamptz; v_n integer;
begin
  select watermark into v_wm from etl.sync_state where tabela = 'fact_progresso_solucao';
  if v_wm is null then v_wm := timestamptz '2025-07-01 00:00:00-03'; end if;
  v_ate := least(v_wm + make_interval(days => p_max_dias), now() - interval '1 minute');
  if v_ate <= v_wm then
    insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, linhas, sucesso)
    values ('fact_progresso_solucao', v_inicio, now(), 0, true);
    return 0;
  end if;

  insert into marts.fact_progresso_solucao as d
    (id, user_id, solution_id, iniciado_em, concluido, concluido_em, pct_conclusao, ultima_atividade, sincronizado_em)
  select p.id, p.user_id, p.solution_id, p.created_at,
         coalesce(p.is_completed, false), p.completed_at, p.completion_percentage,
         p.last_activity, now()
  from plataforma.progress p
  -- `greatest` com completed_at: a conclusão é gravada sem tocar last_activity,
  -- então sem isto ela nunca entra na janela incremental.
  where greatest(coalesce(p.last_activity, p.created_at), coalesce(p.completed_at, p.created_at)) > v_wm
    and greatest(coalesce(p.last_activity, p.created_at), coalesce(p.completed_at, p.created_at)) <= v_ate
  on conflict (id) do update set
    concluido = excluded.concluido,
    concluido_em = excluded.concluido_em,
    pct_conclusao = excluded.pct_conclusao,
    ultima_atividade = excluded.ultima_atividade,
    sincronizado_em = excluded.sincronizado_em;

  get diagnostics v_n = row_count;
  insert into etl.sync_state (tabela, watermark, ultima_execucao, ultimas_linhas)
  values ('fact_progresso_solucao', v_ate, now(), v_n)
  on conflict (tabela) do update set watermark = excluded.watermark,
    ultima_execucao = excluded.ultima_execucao, ultimas_linhas = excluded.ultimas_linhas;
  insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, linhas, sucesso)
  values ('fact_progresso_solucao', v_inicio, now(), v_n, true);
  return v_n;
exception when others then
  insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, sucesso, erro)
  values ('fact_progresso_solucao', v_inicio, now(), false, sqlerrm);
  raise;
end;
$function$;

create or replace function etl.sync_fact_convite(p_max_dias integer default 45)
returns integer language plpgsql security definer set search_path to ''
as $function$
declare
  v_inicio timestamptz := now(); v_wm timestamptz; v_ate timestamptz; v_n integer;
begin
  select watermark into v_wm from etl.sync_state where tabela = 'fact_convite';
  if v_wm is null then v_wm := timestamptz '2025-07-01 00:00:00-03'; end if;
  v_ate := least(v_wm + make_interval(days => p_max_dias), now() - interval '1 minute');
  if v_ate <= v_wm then
    insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, linhas, sucesso)
    values ('fact_convite', v_inicio, now(), 0, true);
    return 0;
  end if;

  insert into marts.fact_convite as d
    (id, criado_em, criado_por, organization_id, usado_em, usado_por, deletado_em, canal_preferido, sincronizado_em)
  select i.id, i.created_at, i.created_by, i.organization_id, i.used_at,
         i.used_by_user_id, i.deleted_at, i.preferred_channel, now()
  from plataforma.invites i
  -- `used_at` e `deleted_at` são gravados sem tocar updated_at
  where greatest(coalesce(i.updated_at, i.created_at),
                 coalesce(i.used_at, i.created_at),
                 coalesce(i.deleted_at, i.created_at)) > v_wm
    and greatest(coalesce(i.updated_at, i.created_at),
                 coalesce(i.used_at, i.created_at),
                 coalesce(i.deleted_at, i.created_at)) <= v_ate
  on conflict (id) do update set
    usado_em = excluded.usado_em,
    usado_por = excluded.usado_por,
    deletado_em = excluded.deletado_em,
    sincronizado_em = excluded.sincronizado_em;

  get diagnostics v_n = row_count;
  insert into etl.sync_state (tabela, watermark, ultima_execucao, ultimas_linhas)
  values ('fact_convite', v_ate, now(), v_n)
  on conflict (tabela) do update set watermark = excluded.watermark,
    ultima_execucao = excluded.ultima_execucao, ultimas_linhas = excluded.ultimas_linhas;
  insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, linhas, sucesso)
  values ('fact_convite', v_inicio, now(), v_n, true);
  return v_n;
exception when others then
  insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, sucesso, erro)
  values ('fact_convite', v_inicio, now(), false, sqlerrm);
  raise;
end;
$function$;

-- 2) A rede: reconciliar valor mutável sem depender de watermark nenhum.
--
-- Não apaga nada — só atualiza linha que já existe nos dois lados, então uma
-- origem vazia produz zero atualizações em vez de estrago. É por isso que este
-- passo não precisa da guarda de sanidade que `propagar_exclusoes` exige.
create or replace function etl.reconciliar_valores()
returns table (tabela text, linhas_corrigidas bigint)
language plpgsql security definer set search_path to ''
as $function$
declare v_n bigint;
begin
  update marts.fact_progresso_solucao f
     set concluido = coalesce(o.is_completed, false),
         concluido_em = o.completed_at,
         pct_conclusao = o.completion_percentage,
         ultima_atividade = o.last_activity,
         sincronizado_em = now()
    from plataforma.progress o
   where o.id = f.id
     and (f.concluido, f.concluido_em, f.pct_conclusao, f.ultima_atividade)
         is distinct from
         (coalesce(o.is_completed, false), o.completed_at, o.completion_percentage, o.last_activity);
  get diagnostics v_n = row_count;
  tabela := 'fact_progresso_solucao'; linhas_corrigidas := v_n; return next;

  update marts.fact_convite f
     set usado_em = o.used_at, usado_por = o.used_by_user_id,
         deletado_em = o.deleted_at, sincronizado_em = now()
    from plataforma.invites o
   where o.id = f.id
     and (f.usado_em, f.usado_por, f.deletado_em)
         is distinct from (o.used_at, o.used_by_user_id, o.deleted_at);
  get diagnostics v_n = row_count;
  tabela := 'fact_convite'; linhas_corrigidas := v_n; return next;

  update marts.fact_progresso_aula f
     set concluido_em = o.completed_at, pct = o.progress_percentage, sincronizado_em = now()
    from plataforma.learning_progress o
   where o.id = f.id
     and (f.concluido_em, f.pct) is distinct from (o.completed_at, o.progress_percentage);
  get diagnostics v_n = row_count;
  tabela := 'fact_progresso_aula'; linhas_corrigidas := v_n; return next;

  return;
end;
$function$;

comment on function etl.reconciliar_valores() is
  'Corrige no espelho o valor de colunas mutáveis que o sync incremental não viu, porque a origem as grava sem carimbar a coluna que serve de watermark. Só atualiza linha existente nos dois lados — nunca apaga.';

revoke all on function etl.reconciliar_valores() from public, anon, authenticated;

select cron.schedule(
  'bi_reconciliar_valores',
  '20 7 * * *',
  $$select etl.executar_passo('etl.reconciliar_valores()')$$
);
