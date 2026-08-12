create or replace function public.bi_achados_entrada(
  p_dias integer default 30, p_papel text default null, p_plano text default null)
returns table(
  regra text, familia text, severidade text, titulo text,
  gabarito text, gabarito_leitura text, gabarito_acao text, parametros jsonb,
  score numeric, suprimida boolean, motivo text, ancora_aba text, ancora_id text)
language plpgsql volatile security invoker set search_path to ''
as $$
declare v_ref date; v_chave text; v_payload jsonb;
begin
  v_ref := marts.data_referencia();
  v_chave := format('entrada|%s|%s|%s|%s', p_dias, coalesce(p_papel, ''), coalesce(p_plano, ''), v_ref);
  select c.payload into v_payload from insights.achado_cache c where c.chave = v_chave;
  if v_payload is null then
    select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) into v_payload
    from insights.calcular_achados_entrada(p_dias, p_papel, p_plano) a;
    insert into insights.achado_cache (chave, payload, data_referencia)
    values (v_chave, v_payload, v_ref)
    on conflict (chave) do update set payload = excluded.payload, calculado_em = now();
  end if;
  return query
  select x.regra, x.familia, x.severidade, x.titulo, x.gabarito, x.gabarito_leitura,
         x.gabarito_acao, x.parametros, x.score, x.suprimida, x.motivo, x.ancora_aba, x.ancora_id
  from jsonb_to_recordset(v_payload) as x(
    regra text, familia text, severidade text, titulo text,
    gabarito text, gabarito_leitura text, gabarito_acao text, parametros jsonb,
    score numeric, suprimida boolean, motivo text, ancora_aba text, ancora_id text);
end $$;

revoke execute on function public.bi_achados_entrada(integer, text, text) from public, anon;
grant execute on function public.bi_achados_entrada(integer, text, text) to authenticated;

create or replace function public.bi_achados_formacoes(
  p_dias integer default 30, p_papel text default null, p_plano text default null)
returns table(
  regra text, familia text, severidade text, titulo text,
  gabarito text, gabarito_leitura text, gabarito_acao text, parametros jsonb,
  score numeric, suprimida boolean, motivo text, ancora_aba text, ancora_id text)
language plpgsql volatile security invoker set search_path to ''
as $$
declare v_ref date; v_chave text; v_payload jsonb;
begin
  v_ref := marts.data_referencia();
  v_chave := format('formacoes|%s|%s|%s|%s', p_dias, coalesce(p_papel, ''), coalesce(p_plano, ''), v_ref);
  select c.payload into v_payload from insights.achado_cache c where c.chave = v_chave;
  if v_payload is null then
    select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) into v_payload
    from insights.calcular_achados_formacoes(p_dias, p_papel, p_plano) a;
    insert into insights.achado_cache (chave, payload, data_referencia)
    values (v_chave, v_payload, v_ref)
    on conflict (chave) do update set payload = excluded.payload, calculado_em = now();
  end if;
  return query
  select x.regra, x.familia, x.severidade, x.titulo, x.gabarito, x.gabarito_leitura,
         x.gabarito_acao, x.parametros, x.score, x.suprimida, x.motivo, x.ancora_aba, x.ancora_id
  from jsonb_to_recordset(v_payload) as x(
    regra text, familia text, severidade text, titulo text,
    gabarito text, gabarito_leitura text, gabarito_acao text, parametros jsonb,
    score numeric, suprimida boolean, motivo text, ancora_aba text, ancora_id text);
end $$;

revoke execute on function public.bi_achados_formacoes(integer, text, text) from public, anon;
grant execute on function public.bi_achados_formacoes(integer, text, text) to authenticated;

create or replace function public.bi_achados_solucoes(
  p_dias integer default 30, p_papel text default null, p_plano text default null)
returns table(
  regra text, familia text, severidade text, titulo text,
  gabarito text, gabarito_leitura text, gabarito_acao text, parametros jsonb,
  score numeric, suprimida boolean, motivo text, ancora_aba text, ancora_id text)
language plpgsql volatile security invoker set search_path to ''
as $$
declare v_ref date; v_chave text; v_payload jsonb;
begin
  v_ref := marts.data_referencia();
  v_chave := format('solucoes|%s|%s|%s|%s', p_dias, coalesce(p_papel, ''), coalesce(p_plano, ''), v_ref);
  select c.payload into v_payload from insights.achado_cache c where c.chave = v_chave;
  if v_payload is null then
    select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) into v_payload
    from insights.calcular_achados_solucoes(p_dias, p_papel, p_plano) a;
    insert into insights.achado_cache (chave, payload, data_referencia)
    values (v_chave, v_payload, v_ref)
    on conflict (chave) do update set payload = excluded.payload, calculado_em = now();
  end if;
  return query
  select x.regra, x.familia, x.severidade, x.titulo, x.gabarito, x.gabarito_leitura,
         x.gabarito_acao, x.parametros, x.score, x.suprimida, x.motivo, x.ancora_aba, x.ancora_id
  from jsonb_to_recordset(v_payload) as x(
    regra text, familia text, severidade text, titulo text,
    gabarito text, gabarito_leitura text, gabarito_acao text, parametros jsonb,
    score numeric, suprimida boolean, motivo text, ancora_aba text, ancora_id text);
end $$;

revoke execute on function public.bi_achados_solucoes(integer, text, text) from public, anon;
grant execute on function public.bi_achados_solucoes(integer, text, text) to authenticated;

create or replace function public.bi_achados_ia(
  p_dias integer default 30, p_papel text default null, p_plano text default null)
returns table(
  regra text, familia text, severidade text, titulo text,
  gabarito text, gabarito_leitura text, gabarito_acao text, parametros jsonb,
  score numeric, suprimida boolean, motivo text, ancora_aba text, ancora_id text)
language plpgsql volatile security invoker set search_path to ''
as $$
declare v_ref date; v_chave text; v_payload jsonb;
begin
  v_ref := marts.data_referencia();
  v_chave := format('ia|%s|%s|%s|%s', p_dias, coalesce(p_papel, ''), coalesce(p_plano, ''), v_ref);
  select c.payload into v_payload from insights.achado_cache c where c.chave = v_chave;
  if v_payload is null then
    select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) into v_payload
    from insights.calcular_achados_ia(p_dias, p_papel, p_plano) a;
    insert into insights.achado_cache (chave, payload, data_referencia)
    values (v_chave, v_payload, v_ref)
    on conflict (chave) do update set payload = excluded.payload, calculado_em = now();
  end if;
  return query
  select x.regra, x.familia, x.severidade, x.titulo, x.gabarito, x.gabarito_leitura,
         x.gabarito_acao, x.parametros, x.score, x.suprimida, x.motivo, x.ancora_aba, x.ancora_id
  from jsonb_to_recordset(v_payload) as x(
    regra text, familia text, severidade text, titulo text,
    gabarito text, gabarito_leitura text, gabarito_acao text, parametros jsonb,
    score numeric, suprimida boolean, motivo text, ancora_aba text, ancora_id text);
end $$;

revoke execute on function public.bi_achados_ia(integer, text, text) from public, anon;
grant execute on function public.bi_achados_ia(integer, text, text) to authenticated;

create or replace function public.bi_achados_organizacoes(
  p_dias integer default 30, p_papel text default null, p_plano text default null)
returns table(
  regra text, familia text, severidade text, titulo text,
  gabarito text, gabarito_leitura text, gabarito_acao text, parametros jsonb,
  score numeric, suprimida boolean, motivo text, ancora_aba text, ancora_id text)
language plpgsql volatile security invoker set search_path to ''
as $$
declare v_ref date; v_chave text; v_payload jsonb;
begin
  v_ref := marts.data_referencia();
  v_chave := format('organizacoes|%s|%s|%s|%s', p_dias, coalesce(p_papel, ''), coalesce(p_plano, ''), v_ref);
  select c.payload into v_payload from insights.achado_cache c where c.chave = v_chave;
  if v_payload is null then
    select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) into v_payload
    from insights.calcular_achados_organizacoes(p_dias, p_papel, p_plano) a;
    insert into insights.achado_cache (chave, payload, data_referencia)
    values (v_chave, v_payload, v_ref)
    on conflict (chave) do update set payload = excluded.payload, calculado_em = now();
  end if;
  return query
  select x.regra, x.familia, x.severidade, x.titulo, x.gabarito, x.gabarito_leitura,
         x.gabarito_acao, x.parametros, x.score, x.suprimida, x.motivo, x.ancora_aba, x.ancora_id
  from jsonb_to_recordset(v_payload) as x(
    regra text, familia text, severidade text, titulo text,
    gabarito text, gabarito_leitura text, gabarito_acao text, parametros jsonb,
    score numeric, suprimida boolean, motivo text, ancora_aba text, ancora_id text);
end $$;

revoke execute on function public.bi_achados_organizacoes(integer, text, text) from public, anon;
grant execute on function public.bi_achados_organizacoes(integer, text, text) to authenticated;

create or replace function public.bi_achados_jornada(
  p_dias integer default 30, p_papel text default null, p_plano text default null)
returns table(
  regra text, familia text, severidade text, titulo text,
  gabarito text, gabarito_leitura text, gabarito_acao text, parametros jsonb,
  score numeric, suprimida boolean, motivo text, ancora_aba text, ancora_id text)
language plpgsql volatile security invoker set search_path to ''
as $$
declare v_ref date; v_chave text; v_payload jsonb;
begin
  v_ref := marts.data_referencia();
  v_chave := format('jornada|%s|%s|%s|%s', p_dias, coalesce(p_papel, ''), coalesce(p_plano, ''), v_ref);
  select c.payload into v_payload from insights.achado_cache c where c.chave = v_chave;
  if v_payload is null then
    select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) into v_payload
    from insights.calcular_achados_jornada(p_dias, p_papel, p_plano) a;
    insert into insights.achado_cache (chave, payload, data_referencia)
    values (v_chave, v_payload, v_ref)
    on conflict (chave) do update set payload = excluded.payload, calculado_em = now();
  end if;
  return query
  select x.regra, x.familia, x.severidade, x.titulo, x.gabarito, x.gabarito_leitura,
         x.gabarito_acao, x.parametros, x.score, x.suprimida, x.motivo, x.ancora_aba, x.ancora_id
  from jsonb_to_recordset(v_payload) as x(
    regra text, familia text, severidade text, titulo text,
    gabarito text, gabarito_leitura text, gabarito_acao text, parametros jsonb,
    score numeric, suprimida boolean, motivo text, ancora_aba text, ancora_id text);
end $$;

revoke execute on function public.bi_achados_jornada(integer, text, text) from public, anon;
grant execute on function public.bi_achados_jornada(integer, text, text) to authenticated;

create or replace function public.bi_achados_receita(
  p_dias integer default 30, p_papel text default null, p_plano text default null)
returns table(
  regra text, familia text, severidade text, titulo text,
  gabarito text, gabarito_leitura text, gabarito_acao text, parametros jsonb,
  score numeric, suprimida boolean, motivo text, ancora_aba text, ancora_id text)
language plpgsql volatile security invoker set search_path to ''
as $$
declare v_ref date; v_chave text; v_payload jsonb;
begin
  v_ref := marts.data_referencia();
  v_chave := format('receita|%s|%s|%s|%s', p_dias, coalesce(p_papel, ''), coalesce(p_plano, ''), v_ref);
  select c.payload into v_payload from insights.achado_cache c where c.chave = v_chave;
  if v_payload is null then
    select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) into v_payload
    from insights.calcular_achados_receita(p_dias, p_papel, p_plano) a;
    insert into insights.achado_cache (chave, payload, data_referencia)
    values (v_chave, v_payload, v_ref)
    on conflict (chave) do update set payload = excluded.payload, calculado_em = now();
  end if;
  return query
  select x.regra, x.familia, x.severidade, x.titulo, x.gabarito, x.gabarito_leitura,
         x.gabarito_acao, x.parametros, x.score, x.suprimida, x.motivo, x.ancora_aba, x.ancora_id
  from jsonb_to_recordset(v_payload) as x(
    regra text, familia text, severidade text, titulo text,
    gabarito text, gabarito_leitura text, gabarito_acao text, parametros jsonb,
    score numeric, suprimida boolean, motivo text, ancora_aba text, ancora_id text);
end $$;

revoke execute on function public.bi_achados_receita(integer, text, text) from public, anon;
grant execute on function public.bi_achados_receita(integer, text, text) to authenticated;
