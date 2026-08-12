-- =====================================================================
-- RPCs de atendimento no vocabulário do contrato pulse
-- =====================================================================
-- bi_cs_atendimento_cobertura media o cruzamento atendimento↔empresa, que saiu
-- do contrato junto com atribuicao_empresa. Manter o nome apontando para outra
-- coisa é pior que trocar: "cobertura" volta a existir com esse sentido no dia
-- em que organization_id chegar do Pulse. O slot na tela passa a declarar a
-- lacuna que existe de fato: 761 tickets fechados sem closed_at e sem
-- resolved_at, que não podem ser contados como resolvidos.
drop function if exists public.bi_cs_atendimento_cobertura(integer);

create or replace function public.bi_cs_atendimento_situacao(p_dias integer default 30)
returns table(situacao text, atendimentos bigint, pct numeric)
language sql stable set search_path to ''
as $function$
  select a.desfecho, count(*),
         round(count(*)::numeric / nullif(sum(count(*)) over (), 0), 4)
  from marts.fact_cs_atendimento a
  where a.abriu_em_brt > (now() at time zone 'America/Sao_Paulo')::date - p_dias
  group by 1 order by 2 desc;
$function$;

comment on function public.bi_cs_atendimento_situacao(integer) is
  'Distribuição dos tickets por desfecho na janela. Substitui bi_cs_atendimento_cobertura: fechado_sem_marcacao é a lacuna que a tela precisa declarar (32,4% dos fechados em 12/08/2026).';

-- Função NOVA: a ACL default do Postgres dá EXECUTE a PUBLIC, e anon é membro.
-- Sem os dois revokes a função nasce aberta e desfaz pontualmente a migration
-- 20260812165144_fecha_rpcs_abertas_ao_anon.
revoke execute on function public.bi_cs_atendimento_situacao(integer) from public;
revoke execute on function public.bi_cs_atendimento_situacao(integer) from anon;
grant  execute on function public.bi_cs_atendimento_situacao(integer) to authenticated;


-- "Só IA" agora é o campo do contrato, não a ausência de atendente_id.
create or replace function public.bi_cs_atendimento_ia_humano(p_dias integer default 30)
returns table(desfecho text, so_ia bigint, com_humano bigint, total bigint)
language sql stable set search_path to ''
as $function$
  select a.desfecho,
         count(*) filter (where not a.tem_atendente_humano),
         count(*) filter (where a.tem_atendente_humano),
         count(*)
  from marts.fact_cs_atendimento a
  where a.abriu_em_brt > (now() at time zone 'America/Sao_Paulo')::date - p_dias
  group by 1 order by 4 desc;
$function$;

revoke execute on function public.bi_cs_atendimento_ia_humano(integer) from public;
revoke execute on function public.bi_cs_atendimento_ia_humano(integer) from anon;
grant  execute on function public.bi_cs_atendimento_ia_humano(integer) to authenticated;


-- O contrato entrega hash, não nome. São 12 atendentes distintos; o rótulo é um
-- pseudônimo estável, e a tela precisa dizer isso — nome de pessoa só volta se o
-- Pulse expuser uma dimensão de atendente.
create or replace function public.bi_cs_atendimento_por_atendente(p_dias integer default 30)
returns table(atendente text, atendimentos bigint, contatos bigint)
language sql stable set search_path to ''
as $function$
  select left(a.atendente_hash, 8), count(*), count(distinct a.contato_hash)
  from marts.fact_cs_atendimento a
  where a.atendente_hash is not null
    and a.abriu_em_brt > (now() at time zone 'America/Sao_Paulo')::date - p_dias
  group by 1 order by 2 desc;
$function$;

comment on function public.bi_cs_atendimento_por_atendente(integer) is
  'Volume por atendente. O rótulo é pseudônimo (8 primeiros caracteres do hash do contrato), não nome de pessoa — a tela precisa declarar isso.';

revoke execute on function public.bi_cs_atendimento_por_atendente(integer) from public;
revoke execute on function public.bi_cs_atendimento_por_atendente(integer) from anon;
grant  execute on function public.bi_cs_atendimento_por_atendente(integer) to authenticated;
