-- Auditoria 08/ago/2026, pendência 4: a dim nunca removia.
--
-- `sync_dim_usuario` é `insert ... on conflict do update` — quem é apagado na
-- plataforma fica no mart para sempre. Medido após o pipeline voltar: 2 contas
-- fantasmas, AMBAS com e_cliente = true, ou seja, entrando em toda métrica de
-- cliente. Hoje é 0,01%, mas cresce a cada conta apagada.
--
-- Trava de segurança: o delete só roda se a origem devolver ao menos 90% do
-- que o mart tem. Sem isso, uma leitura parcial da origem (FDW instável, tabela
-- truncada do outro lado) esvaziaria a dimensão em silêncio — e o BI inteiro
-- depende dela.

create or replace function etl.sync_dim_usuario()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inicio timestamptz := now();
  v_n integer;
  v_origem bigint;
  v_mart bigint;
  v_removidos integer := 0;
begin
  insert into marts.dim_usuario as d (
    user_id, nome, email, papel, status, is_ativo, is_master, organization_id,
    organizacao, plano, plano_display, plan_version, onboarding_concluido,
    criado_em, ultimo_acesso, e_cliente, cohort_mes, sincronizado_em
  )
  select
    p.id, p.name, p.email, p.role, p.status,
    coalesce(p.is_active, true),
    coalesce(p.is_master_user, false),
    p.organization_id, o.name,
    sp.name, sp.display_name, p.plan_version,
    coalesce(p.onboarding_completed, false),
    p.created_at, p.last_active,
    coalesce(
      coalesce(p.role, '') not in ('admin','sales_team','convidado','freemium')
        and p.email not ilike '%viverdeia.ai%'
        and p.email not ilike '%teste%',
      false
    ),
    (date_trunc('month', p.created_at at time zone 'America/Sao_Paulo'))::date,
    now()
  from plataforma.profiles p
  left join plataforma.subscription_plans sp on sp.id = p.subscription_plan_id
  left join plataforma.organizations o on o.id = p.organization_id
  on conflict (user_id) do update set
    nome = excluded.nome,
    email = excluded.email,
    papel = excluded.papel,
    status = excluded.status,
    is_ativo = excluded.is_ativo,
    is_master = excluded.is_master,
    organization_id = excluded.organization_id,
    organizacao = excluded.organizacao,
    plano = excluded.plano,
    plano_display = excluded.plano_display,
    plan_version = excluded.plan_version,
    onboarding_concluido = excluded.onboarding_concluido,
    criado_em = excluded.criado_em,
    ultimo_acesso = excluded.ultimo_acesso,
    e_cliente = excluded.e_cliente,
    cohort_mes = excluded.cohort_mes,
    sincronizado_em = excluded.sincronizado_em;

  get diagnostics v_n = row_count;

  -- espelha as remoções, mas só com a origem visivelmente íntegra
  select count(*) into v_origem from plataforma.profiles;
  select count(*) into v_mart from marts.dim_usuario;

  if v_origem >= v_mart * 0.9 then
    delete from marts.dim_usuario d
    where not exists (
      select 1 from plataforma.profiles p where p.id = d.user_id
    );
    get diagnostics v_removidos = row_count;
  else
    insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, sucesso, erro)
    values ('dim_usuario', v_inicio, now(), false,
            format('delete abortado: origem %s < 90%% do mart %s', v_origem, v_mart));
  end if;

  insert into etl.sync_state (tabela, watermark, ultima_execucao, ultimas_linhas)
  values ('dim_usuario', now(), now(), v_n)
  on conflict (tabela) do update
    set watermark = excluded.watermark,
        ultima_execucao = excluded.ultima_execucao,
        ultimas_linhas = excluded.ultimas_linhas;

  insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, linhas, sucesso)
  values ('dim_usuario', v_inicio, now(), v_n - v_removidos, true);

  return v_n;
exception when others then
  insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, sucesso, erro)
  values ('dim_usuario', v_inicio, now(), false, sqlerrm);
  raise;
end;
$$;

comment on function etl.sync_dim_usuario() is
  'Espelha profiles na dim, incluindo remoções. O delete tem trava: aborta se a origem devolver menos de 90% do tamanho do mart.';
