-- Motor de achados — tela Organizações
-- A tela não tem abas temáticas hoje; estas regras assumem a divisão Análise | Gráficos
-- que entra junto, por isso ancora_aba = 'graficos' nas três.
-- org_time_morto ficou fora do lote: ela dimensionava a fila chamando bi_orgs_risco com
-- limite maior que o do card (25), publicando números que não existem em card nenhum.

insert into insights.regra
  (id, tela, familia, titulo, pergunta, gabarito, gabarito_leitura, gabarito_acao,
   limiar_descricao, ancora_aba, ancora_id, ordem)
values
  ('org_efeito_master', 'organizacoes', 'lideranca',
   'Onde o master para, o time para junto',
   'O time usa mais quando o master da organização está ativo?',
   'Onde o master — o dono da organização, quem comprou — apareceu nos últimos {janela:int} dias, {taxa_com:pct} do time também apareceu. Onde ele parou, {taxa_sem:pct}: o time ativo é {lift:mult} maior com o dono presente. São {orgs_com:int} organizações contra {orgs_sem:int}, todas com pelo menos {membros_minimos:int} membros.',
   'O sentido da seta não está no dado: o master pode ter parado porque o time parou. E há uma explicação mais chata, medida aqui mesmo — as organizações de master parado são as maiores, {media_sem:dec} membros em média contra {media_com:dec}, e fração de time ativo cai mais fácil em time grande. Parte da distância é tamanho, não liderança.',
   'Master parado é o sinal mais barato de risco de conta inteira — {orgs_sem:int} organizações, {membros_sem:int} pessoas. Uma ligação por conta cobre a fila toda. A coluna Master está em Organizações em risco — time parado.',
   'Diferença de pelo menos quinze pontos percentuais no time ativo médio entre o grupo de master ativo e o de master parado, com pelo menos trinta organizações em cada grupo.',
   'graficos', 'card-efeito-master', 1),

  ('org_time_ocioso', 'organizacoes', 'adocao',
   'A maior parte do time não aparece',
   'Que fatia do time de uma organização usa o produto no mês?',
   'Na organização média, {pct_time_ativo:pct} dos membros teve alguma ação nos últimos {janela:int} dias. A média cobre {orgs:int} organizações ativas, {membros:int} pessoas ao todo.',
   'A média é por organização, não por pessoa: uma dupla em que um dos dois apareceu pesa igual a uma organização inteira parada, e a maior parte da base é pequena. Time ocioso também não é cliente insatisfeito — parte dessas contas comprou para uma pessoa e convidou o resto por inércia, e ali o time nunca foi o usuário pretendido.',
   'Antes de tratar membro parado como falha de adoção, separar quem comprou para o time de quem comprou para si: num caso a alavanca é onboarding de time, no outro é não vender assento que ninguém vai ocupar. Nenhum card desta tela faz essa separação hoje — é a pergunta que falta, e é ela que decide qual das duas alavancas vale.',
   'Time ativo médio abaixo de metade dos membros da organização, com pelo menos trinta organizações ativas no recorte.',
   'graficos', 'card-kpis', 2),

  ('org_comprador_parado', 'organizacoes', 'lideranca',
   'Na maioria das contas, quem comprou não aparece',
   'Em quantas organizações o comprador ainda abre o produto?',
   'Das {orgs:int} organizações ativas, o master apareceu nos últimos {janela:int} dias em {pct_master_ativo:pct}. Nas outras {pct_master_parado:pct}, quem comprou não abriu o produto.',
   'Master é o dono da organização e quem pagou; o time entrou pelo convite dele. Quando ele some, some o fio entre a conta e a decisão de renovar. Não é churn — a assinatura segue de pé e o time pode continuar usando. É a situação em que a renovação passa a depender de quem não está olhando. E parado aqui é ausência de evento, não ausência de valor: quem aplica fora do produto o que aprendeu não deixa rastro.',
   'Reativar comprador é a campanha mais barata da carteira: uma pessoa por conta, e é a que assina. O recorte por organização está na coluna Master da lista Organizações em risco — time parado.',
   'Comprador sem nenhuma ação na janela em mais da metade das organizações ativas, com pelo menos trinta organizações ativas no recorte.',
   'graficos', 'card-kpis', 3);

-- org_efeito_master e org_comprador_parado dividem a família 'lideranca' de propósito:
-- contam a mesma história e o motor só publica a de maior score por família. A segunda é a
-- reserva, para a tela não ficar muda se os grupos de master perderem amostra.

create or replace function insights.calcular_achados_organizacoes(
  p_dias integer default 30,
  p_papel text default null,
  p_plano text default null
)
returns table(
  regra text, familia text, severidade text, titulo text,
  gabarito text, gabarito_leitura text, gabarito_acao text,
  parametros jsonb, score numeric, suprimida boolean, motivo text,
  ancora_aba text, ancora_id text
)
language sql
stable
set search_path to ''
as $function$
  -- p_dias, p_papel e p_plano entram porque o contrato do cache exige a assinatura, mas
  -- nenhuma bi_orgs_* aceita recorte: a janela de trinta dias é fixa dentro da view de saúde
  -- e a tela não tem filtro de período nem SegmentoFiltro. O mesmo achado sai em qualquer
  -- recorte da URL — igual aos cards, então o motor não mente mais do que a tela.
  with
  kpi as materialized (select * from public.bi_orgs_kpis()),
  em  as materialized (select * from public.bi_orgs_efeito_master()),
  -- Casamento por rótulo de exibição: 'Master ativo nos últimos 30d' e 'Master parado' são a
  -- cópia que o card imprime, não uma chave. Se alguém reescrever o rótulo na RPC, as duas
  -- metades viram null e a regra se suprime em silêncio, sem erro em lugar nenhum.
  em_piv as (
    select
      max(e.pct_time_ativo) filter (where e.grupo like 'Master ativo%') as taxa_com,
      max(e.pct_time_ativo) filter (where e.grupo = 'Master parado')    as taxa_sem,
      max(e.orgs)           filter (where e.grupo like 'Master ativo%') as orgs_com,
      max(e.orgs)           filter (where e.grupo = 'Master parado')    as orgs_sem,
      max(e.membros)        filter (where e.grupo like 'Master ativo%') as membros_com,
      max(e.membros)        filter (where e.grupo = 'Master parado')    as membros_sem
    from em e
  ),
  r_efeito_master as (
    select 'org_efeito_master'::text as regra,
      case when p.taxa_com is null or p.taxa_sem is null
             then 'sem os dois grupos de master apurados no recorte'
           when least(p.orgs_com, p.orgs_sem) < 30
             then 'menos de trinta organizações em um dos dois grupos de master'
           when p.taxa_com - p.taxa_sem < 0.15
             then 'diferença abaixo do limiar de quinze pontos percentuais'
      end as motivo,
      -- media_com/media_sem existem para a leitura poder desmontar a própria manchete: o
      -- grupo de master parado é o de organizações maiores, e fração cai mais fácil em time
      -- grande. Sem os dois números a negação da leitura não teria como se sustentar.
      jsonb_build_object(
        'taxa_com', p.taxa_com,
        'taxa_sem', p.taxa_sem,
        'lift', round(p.taxa_com / nullif(p.taxa_sem, 0), 2),
        'orgs_com', p.orgs_com,
        'orgs_sem', p.orgs_sem,
        'membros_sem', p.membros_sem,
        'media_com', round(p.membros_com::numeric / nullif(p.orgs_com, 0), 2),
        'media_sem', round(p.membros_sem::numeric / nullif(p.orgs_sem, 0), 2),
        'janela', 30,
        'membros_minimos', 2) as parametros,
      round((p.taxa_com - p.taxa_sem) / 0.15, 2) as score
    from em_piv p
  ),
  r_time_ocioso as (
    select 'org_time_ocioso'::text as regra,
      case when k.pct_time_ativo_medio is null or k.orgs_ativas is null or k.orgs_ativas < 30
             then 'média de time ativo não apurada no recorte'
           when k.pct_time_ativo_medio >= 0.5
             then 'time ativo médio em metade ou mais dos membros'
      end as motivo,
      jsonb_build_object(
        'pct_time_ativo', k.pct_time_ativo_medio,
        'orgs', k.orgs_ativas,
        'membros', k.membros_total,
        'janela', 30) as parametros,
      round(0.5 / nullif(k.pct_time_ativo_medio, 0), 2) as score
    from kpi k
  ),
  r_comprador_parado as (
    select 'org_comprador_parado'::text as regra,
      case when k.orgs_ativas is null or k.orgs_ativas < 30
             then 'menos de trinta organizações ativas no recorte'
           when k.orgs_master_ativo is null
             then 'fração de master ativo não apurada no recorte'
           when 1 - k.orgs_master_ativo <= 0.5
             then 'comprador parado em metade ou menos das organizações'
      end as motivo,
      -- O complemento de orgs_master_ativo mistura master sem evento com organização que não
      -- tem master_user_id definido (dezesseis das ativas hoje, menos de um por cento). Se
      -- essa fatia crescer, a frase passa a afirmar mais do que a RPC mediu.
      jsonb_build_object(
        'orgs', k.orgs_ativas,
        'pct_master_ativo', k.orgs_master_ativo,
        'pct_master_parado', round(1 - k.orgs_master_ativo, 4),
        'janela', 30) as parametros,
      round((1 - k.orgs_master_ativo) / 0.5, 2) as score
    from kpi k
  ),
  todas as (
    select * from r_efeito_master
    union all select * from r_time_ocioso
    union all select * from r_comprador_parado
  )
  select t.regra, g.familia,
    case when t.motivo is not null then 'neutro'
         when t.score >= 2.0 then 'critico'
         when t.score >= 1.5 then 'atencao'
         else 'neutro' end,
    g.titulo, g.gabarito, g.gabarito_leitura, g.gabarito_acao, t.parametros,
    t.score, (t.motivo is not null), t.motivo, g.ancora_aba, g.ancora_id
  from todas t
  join insights.regra g on g.id = t.regra
  order by (t.motivo is not null), t.score desc;
$function$;

comment on function insights.calcular_achados_organizacoes(integer, text, text) is
  'Achados da tela Organizações.';

delete from insights.achado_cache where chave like 'organizacoes|%';
