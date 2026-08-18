-- Vinte RPCs de produto saem do relógio e ancoram no dado
--
-- Fase 2 da proposta de direcionamento ("parar de publicar número quebrado"),
-- item do lote das RPCs com now(). Fecha a dívida declarada no CLAUDE.md.
--
-- O DEFEITO, QUE JÁ CUSTOU CARO UMA VEZ
--
-- Janela ancorada em now() conta dias de CALENDÁRIO sobre dias de DADO. Com o
-- pipeline saudável os dois coincidem e nada muda. Com o pipeline atrasado,
-- "últimos 30 dias" passa a somar 30 dias de calendário sobre 27 de dado: a
-- série encurta pela ponta cheia e o delta passa a medir a parada, não o
-- cliente. Foi o defeito "Pageviews +313,3%" da Fase 0, e ele volta em qualquer
-- função que ancore no relógio.
--
-- marts.data_referencia() devolve o último dia com dado carregado. É a mesma
-- pergunta que o FrescorDoDado responde na tela.
--
-- POR QUE ESTA MIGRATION É UMA TRANSFORMAÇÃO DECLARADA, E NÃO VINTE CORPOS
-- COLADOS
--
-- A mudança é UMA em cada função, e é sempre a mesma. Colar vinte corpos
-- inteiros enterraria essa linha em ~24 mil caracteres de SQL idêntico ao que
-- já está no banco, e quem revisasse não conseguiria ver o que mudou. Aqui a
-- lista é explícita, a substituição é explícita, e as asserções garantem que
-- nada ALÉM dela aconteceu: a função tem de conter o padrão antes, e não pode
-- sobrar now() depois.
--
-- Duas formas aparecem no parque, e cada uma tem a sua substituição:
--
--   with hoje as (select (now() at time zone 'America/Sao_Paulo')::date d)
--     -> with hoje as (select marts.data_referencia() d)
--        (CTE já é avaliada uma vez; o wrapper de subconsulta seria ruído)
--
--   > (now() at time zone 'America/Sao_Paulo')::date - p_dias
--     -> > (select marts.data_referencia()) - p_dias
--        (o (select ...) vira InitPlan e é avaliado UMA vez, que é o padrão
--         já usado em bi_acoes_por_modulo)
--
-- ⚠️ bi_saude_pipeline FICA DE FORA, E NÃO É ESQUECIMENTO
--
-- O CLAUDE.md a listava entre as funções a migrar. Migrá-la QUEBRARIA a
-- função: ela calcula "horas desde a última sync" e "está defasado", ou seja,
-- ela existe justamente para comparar o relógio do dado com o relógio de
-- parede. Ancorada em data_referencia() ela responderia "0 hora desde a
-- sincronização" para sempre — inclusive com o pipeline parado, que é o único
-- momento em que alguém a lê. O relógio ali é a régua certa.
--
-- As 6 bi_cs_* seguem fora por decisão anterior: a fonte delas é o Pulse e tem
-- frescor próprio.
--
-- NENHUM NÚMERO MUDA HOJE, E ISSO É A VERIFICAÇÃO
--
-- Com o pipeline saudável, marts.data_referencia() = a data de hoje, então as
-- vinte funções devem devolver EXATAMENTE o mesmo resultado. Tirei o md5 do
-- resultado de cada uma antes de aplicar e conferi depois. Divergência aqui
-- não seria melhoria: seria sinal de que a substituição pegou algo além da
-- âncora.

do $migration$
declare
  -- A lista é explícita de propósito: um `like '%now()%'` varreria também as
  -- bi_cs_* e a bi_saude_pipeline, que ficam de fora por motivo declarado.
  v_alvos text[] := array[
    'bi_assuntos', 'bi_builder_steps', 'bi_consultor_recorrencia',
    'bi_entrada_kpis', 'bi_erros_login', 'bi_erros_por_tela',
    'bi_fluxo_da_tela', 'bi_formacoes_uso', 'bi_funil_entrada',
    'bi_ia_adocao', 'bi_ia_impacto_retencao', 'bi_ia_kpis',
    'bi_pontos_saida', 'bi_portas_entrada', 'bi_profundidade_sessao',
    'bi_raio_x_telas', 'bi_solucoes_conversao_tela', 'bi_solucoes_kpis',
    'bi_tempo_primeiro_valor', 'bi_uso_vs_receita'
  ];
  v_nome  text;
  v_oid   oid;
  v_antes text;
  v_novo  text;
  v_feitas integer := 0;
begin
  foreach v_nome in array v_alvos loop
    select p.oid into v_oid
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = v_nome;

    if v_oid is null then
      raise exception 'RPC % não existe — a lista do lote está desatualizada', v_nome;
    end if;

    v_antes := pg_get_functiondef(v_oid);

    if position('now() at time zone ''America/Sao_Paulo''' in v_antes) = 0 then
      raise exception 'RPC % não ancora no relógio no formato esperado; conferir à mão', v_nome;
    end if;

    -- Forma 1: a CTE `hoje`. Fica sem o wrapper, que ali seria ruído.
    v_novo := replace(
      v_antes,
      'select (now() at time zone ''America/Sao_Paulo'')::date d',
      'select marts.data_referencia() d');

    -- Forma 2: o resto, inline no filtro. Vira InitPlan.
    v_novo := replace(
      v_novo,
      '(now() at time zone ''America/Sao_Paulo'')::date',
      '(select marts.data_referencia())');

    if position('now()' in v_novo) > 0 then
      raise exception 'RPC % ainda tem now() depois da troca — há uma âncora fora do padrão', v_nome;
    end if;

    if v_novo = v_antes then
      raise exception 'RPC % não mudou — a substituição não pegou', v_nome;
    end if;

    execute v_novo;
    v_feitas := v_feitas + 1;
  end loop;

  if v_feitas <> array_length(v_alvos, 1) then
    raise exception 'esperava % funções, apliquei %', array_length(v_alvos, 1), v_feitas;
  end if;

  raise notice 'RPCs reancoradas em marts.data_referencia(): %', v_feitas;
end;
$migration$;

-- A dívida fica registrada onde ela vive, e não só no CLAUDE.md: quem abrir a
-- função no banco vê por que o relógio é a régua certa ali.
comment on function public.bi_saude_pipeline() is
  'Saúde do pipeline de carga. ANCORA NO RELÓGIO DE PAREDE DE PROPÓSITO, e isto não é a dívida de now() que o resto do parque tem: a função existe para comparar o relógio do dado com o de parede ("horas desde a última sync", "está defasado"). Ancorada em marts.data_referencia() ela responderia zero hora para sempre, inclusive com o pipeline parado — que é o único momento em que alguém a lê. Não "corrigir".';
