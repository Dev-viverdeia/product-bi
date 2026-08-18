-- O plano de ação atravessa as telas
--
-- Fase 8 da proposta de direcionamento, em modo REPORTA (a decisão entre
-- "reportar" e "gerir" segue aberta com o Mateus; este é o degrau que as duas
-- opções compartilham, e nada aqui precisa ser desfeito se ele escolher gerir).
--
-- O QUE ESTAVA FALTANDO
--
-- O motor de achados é cego entre telas POR CONTRATO: cada calculador lê só as
-- funções da própria tela, e o teste de CI reprova quem cruzar. Isso é certo
-- para o CÁLCULO — é o que garante que o número da frase é o mesmo do card.
--
-- Mas o pedido do Mateus é transversal: "a própria plataforma diz para a área
-- de produto onde estamos acertando e errando". Nenhuma tela responde isso,
-- porque "onde" não é pergunta de um módulo.
--
-- Esta função não quebra a cegueira do cálculo — ela AGREGA o que já foi
-- calculado. Cada achado continua saindo do calculador da sua tela, com a régua
-- da sua tela e o número que o card da sua tela mostra.
--
-- A LISTA DE TELAS SAI DO CATÁLOGO, E ISSO NÃO É PREGUIÇA
--
-- Chumbar as nove telas num array seria repetir a pendência F do roadmap: o
-- piso de rastreamento de bi_churn_modulos vive num VALUES e módulo novo fica
-- invisível até alguém lembrar de atualizar. Aqui o desfecho seria pior — tela
-- nova ganharia regra e simplesmente não apareceria no plano de ação, sem erro
-- nenhum.
--
-- Então a lista vem de insights.regra, que é a fonte da verdade de quem tem
-- regra, e o nome da RPC é derivado do nome da tela. Se a RPC não existir, a
-- função ABORTA com o nome da tela: falha visível em vez de omissão silenciosa.
--
-- A ORDEM É COMPARÁVEL ENTRE TELAS, E ISSO JÁ ESTAVA PAGO
--
-- score é múltiplo do próprio limiar de cada regra, nunca a magnitude bruta —
-- decisão da Fase 1, tomada justamente para que regras de unidades diferentes
-- (pontos percentuais x porcentagem x multiplicador) não competissem numa
-- escala que não existe. É essa normalização que torna legítimo ordenar o
-- catálogo inteiro numa lista só.
--
-- ⚠️ O MOTOR ESTÁ SATURADO, E O PLANO NÃO ESCONDE ISSO
--
-- Medido hoje: 34 das 35 regras dispararam, 1 suprimida. Um motor que quase
-- sempre acha algo rankeia bem e filtra mal — a ORDEM da lista vale mais que a
-- PRESENÇA nela. A tela declara isso, e a recalibração de limiar continua sendo
-- decisão do Mateus (pendência E).

create or replace function public.bi_plano_de_acao(
  p_dias integer default 30,
  p_papel text default null,
  p_plano text default null)
returns table(
  tela text, regra text, familia text, severidade text, titulo text,
  gabarito text, gabarito_leitura text, gabarito_acao text, parametros jsonb,
  score numeric, suprimida boolean, motivo text, ancora_aba text, ancora_id text)
language plpgsql stable set search_path to ''
as $function$
declare
  v_tela    text;
  v_fn      text;
  v_parcial jsonb;
  v_todos   jsonb := '[]'::jsonb;
begin
  for v_tela in select distinct r.tela from insights.regra r order by 1 loop
    v_fn := 'public.bi_achados_' || replace(v_tela, '-', '_');

    if to_regprocedure(v_fn || '(integer,text,text)') is null then
      raise exception
        'A tela "%" tem regra no catálogo e não tem a RPC %. O plano de ação sairia sem ela, em silêncio.',
        v_tela, v_fn;
    end if;

    -- to_jsonb da linha inteira: se a RPC de achados ganhar coluna, ela chega
    -- aqui sozinha, e só o RETURNS desta função precisa acompanhar.
    execute format(
      'select coalesce(jsonb_agg(to_jsonb(a) || jsonb_build_object(''tela'', %L)), ''[]''::jsonb)
       from %s($1, $2, $3) a', v_tela, v_fn)
      into v_parcial
      using p_dias, p_papel, p_plano;

    v_todos := v_todos || v_parcial;
  end loop;

  return query
  select x.tela, x.regra, x.familia, x.severidade, x.titulo, x.gabarito,
         x.gabarito_leitura, x.gabarito_acao, x.parametros, x.score,
         x.suprimida, x.motivo, x.ancora_aba, x.ancora_id
  from jsonb_to_recordset(v_todos) as x(
    tela text, regra text, familia text, severidade text, titulo text,
    gabarito text, gabarito_leitura text, gabarito_acao text, parametros jsonb,
    score numeric, suprimida boolean, motivo text, ancora_aba text, ancora_id text)
  -- a ordem sai do banco, como na análise por tela: quem lê não reordena
  order by x.suprimida, x.score desc, x.tela;
end;
$function$;

comment on function public.bi_plano_de_acao(integer, text, text) is
  'Plano de ação transversal: agrega os achados JÁ CALCULADOS de todas as telas que têm regra, ordenados por score. NÃO quebra a cegueira entre telas do motor — cada achado continua saindo do calculador da própria tela, com a régua e o número que o card daquela tela mostra; esta função só junta e ordena. A lista de telas sai de insights.regra e o nome da RPC é derivado do nome da tela: tela nova com regra entra sozinha, e se a RPC não existir a função aborta em vez de omitir em silêncio. Ordenar telas diferentes na mesma lista só é legítimo porque score é múltiplo do próprio limiar de cada regra, e não magnitude bruta. Herda o cache de cada RPC de achados.';

revoke execute on function public.bi_plano_de_acao(integer, text, text) from public, anon;
grant execute on function public.bi_plano_de_acao(integer, text, text) to authenticated, service_role;
