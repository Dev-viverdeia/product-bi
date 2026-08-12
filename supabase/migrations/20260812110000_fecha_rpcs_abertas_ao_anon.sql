-- 15 RPCs estavam executaveis por `anon` -- as 14 de CS e uma de Solucoes --
-- contra 92 que ja seguiam a regra da casa. `anon` e o papel de quem NAO fez
-- login: nenhuma leitura de BI deve passar por ele.
--
-- Hoje nao vaza nada de CS porque os marts estao vazios; e exatamente por isso
-- que precisa ser fechado ANTES da primeira carga, e nao depois.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as assinatura
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname like 'bi\_%'
      and has_function_privilege('anon', p.oid, 'execute')
  loop
    execute format('revoke execute on function %s from anon', f.assinatura);
    -- `public` tambem: sem isto, anon herda o privilegio por PUBLIC e o revoke
    -- direto nao surte efeito.
    execute format('revoke execute on function %s from public', f.assinatura);
    execute format('grant execute on function %s to authenticated', f.assinatura);
  end loop;
end $$;
