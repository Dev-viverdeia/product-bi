-- Cache dos achados.
--
-- O motor lê cinco funções pesadas para avaliar cinco regras: 2,5s isolado, e
-- a tela de Clientes dispara outras treze consultas ao mesmo tempo. Sob essa
-- concorrência o bloco estourava o timeout de 8s e aparecia em erro — o pior
-- desfecho possível para a peça que existe para explicar a tela. Com cache:
-- 5ms.
--
-- A chave inclui a data de referência do dado. Quando o sync avança, a chave
-- muda e o achado é recalculado sozinho — não há invalidação manual para
-- alguém esquecer de chamar.
--
-- Aquecimento: hoje é sob demanda (o primeiro a abrir a combinação paga o
-- cálculo). Quando o pipeline voltar, o aquecimento das combinações comuns
-- entra no fim do sync, em bloco com EXCEPTION próprio — nunca acoplado ao
-- sucesso dele, porque o FDW falha e o resumo não pode falhar junto.

-- As funções bi_* são SECURITY INVOKER (regra do projeto), então quem executa
-- precisa alcançar o schema que elas leem. Sem o USAGE, a tela recebia
-- "permission denied for schema insights" e o bloco aparecia em erro.
--
-- Alcançar o schema não é ler as tabelas: `insights.regra` continua com RLS
-- ligada e sem policy, então a leitura só acontece pelas funções bi_*, que
-- devolvem exatamente as colunas que a tela mostra.
grant usage on schema insights to authenticated;
grant select on insights.regra to authenticated;

create table if not exists insights.achado_cache (
  chave            text primary key,
  payload          jsonb not null,
  data_referencia  date not null,
  calculado_em     timestamptz not null default now()
);

comment on table insights.achado_cache is
  'Achados já calculados, por (tela, período, recorte, data do dado). Cache derivado: nada aqui é fonte, e apagar a tabela só custa um recálculo.';

alter table insights.achado_cache enable row level security;

-- Escrita liberada para authenticated de propósito: o payload é exatamente o
-- que o próprio usuário obteria chamando as funções bi_* que ele já pode
-- chamar, sem dado pessoal, e a chave é derivada do conteúdo. Deixar a escrita
-- aqui evita SECURITY DEFINER no caminho de leitura da tela.
drop policy if exists leitura_bi on insights.achado_cache;
create policy leitura_bi on insights.achado_cache
  for all to authenticated using (true) with check (true);

grant select, insert, update on insights.achado_cache to authenticated;

-- ---- a conta sai do public e vira o calculador ----

alter function public.bi_achados_clientes(integer, text, text)
  rename to calcular_achados_clientes;
alter function public.calcular_achados_clientes(integer, text, text)
  set schema insights;

alter function public.bi_achados_visao_geral(integer, text, text)
  rename to calcular_achados_visao_geral;
alter function public.calcular_achados_visao_geral(integer, text, text)
  set schema insights;

grant execute on function insights.calcular_achados_clientes(integer, text, text) to authenticated;
grant execute on function insights.calcular_achados_visao_geral(integer, text, text) to authenticated;

-- ---- e o public vira a porta com cache ----

create or replace function public.bi_achados_clientes(
  p_dias integer default 30, p_papel text default null, p_plano text default null)
returns table(
  regra text, familia text, severidade text, titulo text,
  gabarito text, gabarito_acao text, parametros jsonb,
  score numeric, suprimida boolean, motivo text,
  ancora_aba text, ancora_id text)
language plpgsql volatile security invoker set search_path to ''
as $$
declare
  v_ref date;
  v_chave text;
  v_payload jsonb;
begin
  v_ref := marts.data_referencia();
  v_chave := format('clientes|%s|%s|%s|%s', p_dias, coalesce(p_papel, ''), coalesce(p_plano, ''), v_ref);

  select c.payload into v_payload from insights.achado_cache c where c.chave = v_chave;

  if v_payload is null then
    select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) into v_payload
    from insights.calcular_achados_clientes(p_dias, p_papel, p_plano) a;

    insert into insights.achado_cache (chave, payload, data_referencia)
    values (v_chave, v_payload, v_ref)
    on conflict (chave) do update
      set payload = excluded.payload, calculado_em = now();
  end if;

  return query
  select x.regra, x.familia, x.severidade, x.titulo, x.gabarito, x.gabarito_acao,
         x.parametros, x.score, x.suprimida, x.motivo, x.ancora_aba, x.ancora_id
  from jsonb_to_recordset(v_payload) as x(
    regra text, familia text, severidade text, titulo text,
    gabarito text, gabarito_acao text, parametros jsonb,
    score numeric, suprimida boolean, motivo text,
    ancora_aba text, ancora_id text);
end $$;

create or replace function public.bi_achados_visao_geral(
  p_dias integer default 30, p_papel text default null, p_plano text default null)
returns table(
  regra text, familia text, severidade text, titulo text,
  gabarito text, gabarito_acao text, parametros jsonb,
  score numeric, suprimida boolean, motivo text,
  ancora_aba text, ancora_id text)
language plpgsql volatile security invoker set search_path to ''
as $$
declare
  v_ref date;
  v_chave text;
  v_payload jsonb;
begin
  v_ref := marts.data_referencia();
  v_chave := format('visao-geral|%s|%s|%s|%s', p_dias, coalesce(p_papel, ''), coalesce(p_plano, ''), v_ref);

  select c.payload into v_payload from insights.achado_cache c where c.chave = v_chave;

  if v_payload is null then
    select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) into v_payload
    from insights.calcular_achados_visao_geral(p_dias, p_papel, p_plano) a;

    insert into insights.achado_cache (chave, payload, data_referencia)
    values (v_chave, v_payload, v_ref)
    on conflict (chave) do update
      set payload = excluded.payload, calculado_em = now();
  end if;

  return query
  select x.regra, x.familia, x.severidade, x.titulo, x.gabarito, x.gabarito_acao,
         x.parametros, x.score, x.suprimida, x.motivo, x.ancora_aba, x.ancora_id
  from jsonb_to_recordset(v_payload) as x(
    regra text, familia text, severidade text, titulo text,
    gabarito text, gabarito_acao text, parametros jsonb,
    score numeric, suprimida boolean, motivo text,
    ancora_aba text, ancora_id text);
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.bi_achados_clientes(integer, text, text)',
    'public.bi_achados_visao_geral(integer, text, text)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
