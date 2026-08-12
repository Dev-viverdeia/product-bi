-- As tabelas de CS nasceram com RLS ligada e nenhuma policy, o que é deny-all.
-- As RPCs do projeto são SECURITY INVOKER: sem policy, elas devolveriam zero
-- linha para o app sem levantar erro nenhum. Falha silenciosa é o pior modo de
-- falhar num BI, e é o mesmo padrão (grant + leitura_bi) que todas as outras
-- tabelas de marts já usam.
do $$
declare t text;
begin
  foreach t in array array[
    'dim_cs_empresa','fact_cs_atendimento','fact_cs_disparo','fact_cs_envio',
    'fact_cs_cancelamento','fact_cs_card','fact_cs_movimento','fact_cs_clique'
  ] loop
    execute format('grant select on marts.%I to authenticated', t);
    execute format(
      'create policy leitura_bi on marts.%I for select to authenticated using (true)', t);
  end loop;
end $$;

grant select on marts.v_cs_frescor to authenticated;
