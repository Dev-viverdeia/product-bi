-- Nona view do contrato bi_pulse: o retrato diario de cada empresa cliente.
--
-- E a unica serie historica de saude de cliente que existe. As outras tabelas de
-- CS dizem o que aconteceu (ticket, cancelamento, movimento); esta diz o ESTADO,
-- dia a dia. E o que permite responder "esta melhorando ou piorando, e desde
-- quando" em vez de so "como esta agora".
--
-- A tabela de origem nasceu em 10/08/2026 e ACUMULA -- confirmado pelo time do
-- Pulse: a funcao que escreve nela nao tem delete e nenhum job purga. A hipotese
-- de janela deslizante que motivou o pedido estava errada, e nada se perdeu.
create table marts.fact_cs_status_diario (
  dia date not null,
  company_id uuid not null,
  organization_id uuid,
  is_active boolean,
  current_plan text,
  plan_started_at timestamptz,
  carregado_em timestamptz not null default now(),
  primary key (dia, company_id)
);

comment on table marts.fact_cs_status_diario is
  'Retrato diario de cada empresa cliente no Pulse: ativa ou nao, e qual plano. Grao (dia, company_id). organization_id casa com marts.dim_organizacao.id em ~82% das linhas -- o resto e empresa do Pulse sem correspondencia no produto, e null e legitimo.';

create index fact_cs_status_diario_org_dia on marts.fact_cs_status_diario (organization_id, dia)
  where organization_id is not null;

alter table marts.fact_cs_status_diario enable row level security;

create policy leitura_bi on marts.fact_cs_status_diario
  for select to authenticated using (true);

-- Sync incremental por dia, como o time do Pulse recomendou: `organization_id` na
-- origem e funcao por linha, entao full scan cresce com a tabela -- ~1s hoje,
-- ~100s em um ano, contra um statement_timeout de 60s. Incremental nao sente.
--
-- Releitura dos DOIS ultimos dias, nao so dos novos: a origem escreve o retrato
-- do dia as 05:10 UTC, e uma correcao posterior no mesmo dia passaria batida se
-- a janela fosse estritamente `dia > watermark`. Sao ~5 mil linhas -- barato.
create or replace function etl.sync_cs_status_diario()
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_inicio timestamptz := now(); v_wm date; v_ate date; v_n integer;
begin
  select watermark::date into v_wm from etl.sync_state where tabela = 'cs_status_diario';
  -- Piso: a tabela de origem nasceu em 10/08/2026; nada antes disso existe.
  if v_wm is null then v_wm := date '2026-08-10'; end if;

  insert into marts.fact_cs_status_diario
    (dia, company_id, organization_id, is_active, current_plan, plan_started_at, carregado_em)
  select s.dia, s.company_id, s.organization_id, s.is_active, s.current_plan,
         s.plan_started_at, now()
  from pulse.cliente_status_diario s
  where s.dia >= v_wm
  on conflict (dia, company_id) do update set
    organization_id = excluded.organization_id,
    is_active       = excluded.is_active,
    current_plan    = excluded.current_plan,
    plan_started_at = excluded.plan_started_at,
    carregado_em    = excluded.carregado_em
  -- Guarda de mudanca: sem ela, os dois dias do retoque seriam regravados a cada
  -- ciclo e `ultimas_linhas` nunca chegaria a zero -- ninguem distinguiria
  -- "chegou dia novo" de "o retoque tocou os mesmos de sempre".
  where (marts.fact_cs_status_diario.organization_id, marts.fact_cs_status_diario.is_active,
         marts.fact_cs_status_diario.current_plan, marts.fact_cs_status_diario.plan_started_at)
        is distinct from
        (excluded.organization_id, excluded.is_active,
         excluded.current_plan, excluded.plan_started_at);

  get diagnostics v_n = row_count;

  -- O watermark recua um dia de proposito: e o que mantem o retoque na proxima
  -- execucao. Guardar o max(dia) fecharia a janela e a correcao do dia corrente
  -- nunca entraria.
  select coalesce(max(dia), v_wm) - 1 into v_ate from marts.fact_cs_status_diario;

  insert into etl.sync_state (tabela, watermark, ultima_execucao, ultimas_linhas)
  values ('cs_status_diario', v_ate::timestamptz, now(), v_n)
  on conflict (tabela) do update set watermark = excluded.watermark,
    ultima_execucao = excluded.ultima_execucao, ultimas_linhas = excluded.ultimas_linhas;
  insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, linhas, sucesso)
  values ('cs_status_diario', v_inicio, now(), v_n, true);
  return v_n;
exception when others then
  insert into etl.sync_runs (tabela, iniciado_em, finalizado_em, sucesso, erro)
  values ('cs_status_diario', v_inicio, now(), false, sqlerrm);
  raise;
end; $function$;

comment on function etl.sync_cs_status_diario() is
  'Carrega marts.fact_cs_status_diario de pulse.cliente_status_diario, incremental por dia com releitura dos dois ultimos. Incremental por recomendacao do time do Pulse: organization_id e funcao por linha na origem e o full scan cresce ate estourar o statement_timeout.';
