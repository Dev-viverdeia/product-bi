-- Regras de análise da tela /entrada — catálogo + calculador.
-- Cinco regras: funil (perda antes da conta), instrumento (erro sem causa),
-- onboarding (não começa), expansão (comprador que não convida) e ativação (nunca agiu).

insert into insights.regra
  (id, tela, familia, titulo, pergunta,
   gabarito, gabarito_leitura, gabarito_acao, limiar_descricao,
   ancora_aba, ancora_id, ordem)
values
  (
    'ent_perda_antes_da_conta',
    'entrada',
    'funil',
    'A perda acontece antes de existir conta',
    'Em que ponto do funil de entrada as pessoas se perdem?',
    'Dos {criados:int} convites criados no período, {perdidos_antes:int} nunca viraram cadastro. É {parte:pct} de toda a perda que o funil registra entre o convite criado e a primeira ação no produto — {perdidos_total:int} no total.',
    'O gargalo está fora do produto: quem se perde aqui nunca teve conta, nunca abriu uma tela, nunca chegou a abandonar nada. O número não diz por quê. O rastreamento de envio da plataforma parou e a etapa de entrega não aparece no funil, então convite que não chegou e convite ignorado caem no mesmo balde. E parte dessa perda ainda pode virar cadastro: quem foi convidado nos últimos dias continua no prazo.',
    'Mexer no onboarding ou na primeira ação corrige a menor parte da perda. O que decide este número acontece entre criar o convite e a pessoa clicar — e hoje não há como separar "não chegou" de "não quis". Restaurar o rastreamento de envio é pré-requisito de qualquer teste aqui.',
    'A passagem entre convite criado e cadastro respondendo por pelo menos metade de toda a perda do funil, em janela de trinta dias ou mais.',
    'funil',
    'card-funil-entrada',
    1
  ),
  (
    'ent_erro_sem_categoria',
    'entrada',
    'instrumento',
    'Erro de login sem causa conhecida',
    'Dá para confiar na distribuição de causas do erro de login?',
    '{sem_categoria:int} das {total:int} ocorrências de erro de login do período ficaram sem causa identificada — {parte:pct} do total caiu na categoria de sobra, a que recebe o que o classificador não soube nomear.',
    'Credencial inválida é a maior barra entre as ocorrências que têm nome, não entre todas. Se o bloco sem causa tiver composição diferente do resto, a ordem das prioridades muda — e enquanto ele for grande, o gráfico mede o classificador tanto quanto o problema. Ocorrência também não é pessoa: a mesma tentativa repetida conta várias vezes, então isto não diz quantos clientes ficaram do lado de fora.',
    'Antes de priorizar qualquer causa, abrir a categoria de sobra na telemetria de autenticação e ver o que ela engole — o card mostra ela como FALLBACK. Priorizar pela distribuição de hoje é priorizar dentro da parte do problema que já tem nome.',
    'A categoria de sobra respondendo por pelo menos um quinto das ocorrências de erro de login do período, com pelo menos trinta ocorrências na janela.',
    'porta',
    'card-erros-login',
    2
  ),
  (
    'ent_onboarding_nao_comeca',
    'entrada',
    'onboarding',
    'Não é abandono no meio, é não começar',
    'Em que etapa do onboarding as pessoas param?',
    '{na_primeira:int} dos {incompletos:int} clientes com onboarding em aberto estão parados na primeira etapa — {parte:pct} deles. Todas as etapas seguintes, somadas, ficam com {resto:int}.',
    'Abandono espalhado pelo fluxo apontaria uma etapa cara demais. Concentração na primeira aponta outra coisa: a pessoa abriu o onboarding e não deu o primeiro passo. O formulário pode não ter nada de errado — o mesmo padrão aparece quando alguém entrou por curiosidade, ou quando o convite foi aceito por quem não era o destinatário. O que o dado descarta é a hipótese de fluxo longo demais.',
    'Encurtar ou reordenar as etapas do meio mexe na minoria. A alavanca é o que acontece imediatamente depois do cadastro — a segunda etapa só é vista por quem já decidiu ficar. Quem passa dali e mesmo assim não age aparece em Tempo até a 1ª ação, na aba Funil.',
    'A primeira etapa concentrando pelo menos metade de todos os onboardings em aberto, com pelo menos trinta pessoas em aberto.',
    'onboarding',
    'card-onboarding-abandono',
    3
  ),
  (
    'ent_master_nao_convida',
    'entrada',
    'expansao',
    'Compradores que nunca convidaram ninguém',
    'Quem compra o produto chega a usar a organização que comprou?',
    '{sem_convite:int} dos {masters:int} compradores nunca criaram um convite — {parte:pct} deles. Dos convites que os outros criaram, {conversao:pct} viraram cadastro.',
    'As duas metades do número discordam: o convite pessoal converte bem, e mesmo assim boa parte de quem comprou nunca mandou o primeiro. Antes de agir, duas coisas seguram a conclusão. A conta é histórica, sem janela, então quem comprou nesta semana aparece aqui sem ter tido tempo. E não ter criado convite não é o mesmo que ter organização vazia: outro membro pode ter convidado no lugar do dono.',
    'O topo deste funil é alimentado por convite, e a torneira está fechada em boa parte dos compradores. Antes de mexer na conversão, subir a emissão: Masters × convites lista quem mais convida — o grupo que interessa é o que não aparece lá.',
    'Pelo menos um terço dos compradores sem nenhum convite criado, com pelo menos trinta compradores na base.',
    'onboarding',
    'card-masters-convites',
    4
  ),
  (
    'ent_sem_primeira_acao',
    'entrada',
    'ativacao',
    'A resposta mais comum é nunca',
    'Quanto tempo o cliente demora para fazer a primeira ação no produto?',
    '{nunca:int} dos {coorte:int} clientes que entraram entre {janela_min:int} e {janela_max:int} dias atrás nunca fizeram nenhuma ação — {parte:pct} do grupo. Não existe prazo mais comum que esse: a maior barra do gráfico é a de quem não agiu.',
    'Entre quem agiu, a ação é quase sempre imediata: {ate_uma_semana:int} dos {agiram:int} fizeram isso na primeira semana. Não há meio-termo lento — ou a pessoa age logo, ou não age. Por isso a barra da ponta direita engana: ela está no fim do gráfico porque a ordem é de tempo, não porque seja sobra. Esperar amadurecimento é esperar por um comportamento que este dado não mostra.',
    'A decisão acontece nos primeiros dias, não no primeiro mês. Quem passou da primeira semana sem agir já está no grupo que quase nunca age: tratar como risco, não como cliente novo se ambientando. Os nomes estão em Clientes em risco — lista para ação, em Clientes & Retenção.',
    'A faixa sem nenhuma ação ser a mais numerosa do grupo medido e responder por pelo menos um quarto dele, com o grupo acima do piso de trinta clientes.',
    'funil',
    'card-tempo-primeira-acao',
    5
  );

-- p_papel e p_plano entram na assinatura por contrato do motor e são ignorados de propósito:
-- nenhuma RPC de /entrada aceita recorte, e fingir filtro aqui produziria o mesmo achado com
-- rótulo de recorte diferente. Enquanto a chave do cache incluir papel/plano, esta tela grava
-- linhas redundantes — é o preço de manter a assinatura única.
create or replace function insights.calcular_achados_entrada(
  p_dias integer default 30,
  p_papel text default null,
  p_plano text default null
)
returns table(
  regra text, familia text, severidade text, titulo text,
  gabarito text, gabarito_leitura text, gabarito_acao text, parametros jsonb,
  score numeric, suprimida boolean, motivo text, ancora_aba text, ancora_id text
)
language sql
stable
set search_path to ''
as $function$
  with
  funil as materialized (select * from public.bi_funil_entrada(p_dias)),
  erros as materialized (select * from public.bi_erros_login(p_dias)),
  -- As três RPCs abaixo não recebem janela: as regras que dependem delas devolvem o mesmo
  -- achado em qualquer período. Os cards de origem se comportam igual, então o motor não
  -- mente mais que a tela — mas o bloco vai parecer surdo ao filtro de período.
  onb as materialized (select * from public.bi_onboarding_abandono()),
  mst as materialized (select * from public.bi_masters_convites_resumo()),
  tpv as materialized (select * from public.bi_tempo_primeiro_valor()),

  funil_n as (
    select
      max(f.quantidade) filter (where f.ordem = 1) as criados,
      max(f.quantidade) filter (where f.ordem = 2) as cadastros,
      max(f.quantidade) filter (where f.ordem = 4) as primeira_acao
    from funil f
  ),
  r_perda_antes_da_conta as (
    -- O funil é por safra e tem censura à direita: abaixo de trinta dias a perda medida é
    -- em boa parte prazo que ainda não venceu, não perda de verdade. Por isso a janela curta
    -- suprime antes de qualquer conta.
    select 'ent_perda_antes_da_conta'::text as regra,
      case when p_dias < 30
             then 'janela curta demais: convite recente ainda tem prazo para virar cadastro'
           when n.criados is null or n.criados = 0
             then 'nenhum convite criado no período'
           when n.criados - n.primeira_acao <= 0
             then 'o funil não perdeu ninguém no período'
           when (n.criados - n.cadastros)::numeric / nullif(n.criados - n.primeira_acao, 0) < 0.50
             then 'a maior parte da perda acontece dentro do produto, e não antes do cadastro'
      end as motivo,
      -- As etapas de convite contam convites e a etapa final conta pessoas. A diferença é de
      -- uma unidade hoje, e o gabarito usa "perda" como substantivo neutro justamente para
      -- não afirmar unidade que o funil não garante.
      jsonb_build_object(
        'criados', n.criados,
        'perdidos_antes', n.criados - n.cadastros,
        'perdidos_total', n.criados - n.primeira_acao,
        'parte', round((n.criados - n.cadastros)::numeric
                       / nullif(n.criados - n.primeira_acao, 0), 4)) as parametros,
      round((n.criados - n.cadastros)::numeric
            / nullif(n.criados - n.primeira_acao, 0) / 0.50, 2) as score
    from funil_n n
  ),

  erros_n as (
    -- 'FALLBACK' é o rótulo que o card exibe e que a telemetria grava. Se a categoria de sobra
    -- for renomeada na origem, esta regra passa a medir zero e some sem erro nenhum.
    select
      coalesce(sum(e.ocorrencias) filter (where e.categoria = 'FALLBACK'), 0) as sem_categoria,
      sum(e.ocorrencias) as total
    from erros e
  ),
  r_erro_sem_categoria as (
    select 'ent_erro_sem_categoria'::text as regra,
      case when n.total is null or n.total = 0
             then 'nenhum erro de login registrado no período'
           when n.total < 30
             then 'menos de trinta ocorrências no período: amostra pequena demais para falar de distribuição'
           when n.sem_categoria = 0
             then 'toda ocorrência do período tem causa classificada'
           when n.sem_categoria::numeric / nullif(n.total, 0) < 0.20
             then 'menos de um quinto das ocorrências ficou sem causa'
      end as motivo,
      jsonb_build_object(
        'sem_categoria', n.sem_categoria,
        'total', n.total,
        'parte', round(n.sem_categoria::numeric / nullif(n.total, 0), 4)) as parametros,
      round(n.sem_categoria::numeric / nullif(n.total, 0) / 0.20, 2) as score
    from erros_n n
  ),

  onb_n as (
    -- A primeira etapa vem de min(step_atual), e não de zero chumbado: se o fluxo passar a
    -- numerar a partir de outro ponto, a regra continua falando da etapa de entrada.
    select
      sum(o.clientes) as incompletos,
      sum(o.clientes) filter (
        where o.step_atual = (select min(o2.step_atual) from onb o2)) as na_primeira
    from onb o
  ),
  r_onboarding_nao_comeca as (
    -- bi_onboarding_abandono não aplica a régua e_cliente, ao contrário do resto da tela.
    -- Numerador e denominador carregam a mesma contaminação, então a fatia se sustenta;
    -- o número absoluto de incompletos é maior que o da base de clientes.
    select 'ent_onboarding_nao_comeca'::text as regra,
      case when n.incompletos is null or n.incompletos = 0
             then 'nenhum onboarding em aberto'
           when n.incompletos < 30
             then 'menos de trinta onboardings em aberto: abaixo do piso de amostra da casa'
           when n.na_primeira is null or n.na_primeira = 0
             then 'ninguém parado na primeira etapa'
           when n.na_primeira::numeric / nullif(n.incompletos, 0) < 0.50
             then 'o abandono está distribuído pelo fluxo, e não concentrado na entrada'
      end as motivo,
      jsonb_build_object(
        'incompletos', n.incompletos,
        'na_primeira', n.na_primeira,
        'resto', n.incompletos - n.na_primeira,
        'parte', round(n.na_primeira::numeric / nullif(n.incompletos, 0), 4)) as parametros,
      round(n.na_primeira::numeric / nullif(n.incompletos, 0) / 0.50, 2) as score
    from onb_n n
  ),

  r_master_nao_convida as (
    select 'ent_master_nao_convida'::text as regra,
      case when m.masters_total is null or m.masters_total = 0
             then 'nenhum comprador na base'
           when m.masters_total < 30
             then 'menos de trinta compradores: abaixo do piso de amostra da casa'
           when m.pct_convidam is null
             then 'a régua não devolveu a fatia de compradores que convidam'
           when 1 - m.pct_convidam < 1.0 / 3.0
             then 'menos de um terço dos compradores está sem convite criado'
      end as motivo,
      jsonb_build_object(
        'masters', m.masters_total,
        'sem_convite', m.masters_total - m.masters_convidaram,
        'parte', round(1 - m.pct_convidam, 4),
        'conversao', m.conversao_convites) as parametros,
      round((1 - m.pct_convidam) / (1.0 / 3.0), 2) as score
    from mst m
  ),

  tpv_n as (
    -- Casamento por rótulo em dois lugares: 'Nunca agiu' separa a faixa sem ação, e o conjunto
    -- da primeira semana é listado nome a nome em vez de por número de linha — assim uma faixa
    -- nova no meio da régua não muda o sentido da frase em silêncio. Renomear qualquer rótulo
    -- em bi_tempo_primeiro_valor quebra a regra sem erro.
    select
      sum(t.clientes) as coorte,
      sum(t.clientes) filter (where t.faixa = 'Nunca agiu') as nunca,
      sum(t.clientes) filter (where t.faixa <> 'Nunca agiu') as agiram,
      sum(t.clientes) filter (
        where t.faixa in ('No mesmo dia', '1 dia', '2–3 dias', '4–7 dias')) as ate_uma_semana,
      max(t.clientes) filter (where t.faixa <> 'Nunca agiu') as maior_prazo
    from tpv t
  ),
  r_sem_primeira_acao as (
    -- O achado é "a ausência de ação é a faixa mais numerosa": se algum prazo passar a maior
    -- que ela, o gráfico já se lê sozinho e a regra sai de cena.
    select 'ent_sem_primeira_acao'::text as regra,
      case when n.coorte is null or n.coorte < 30
             then 'grupo medido abaixo do piso de amostra da casa'
           when n.nunca is null or n.nunca < n.maior_prazo
             then 'a faixa mais numerosa é um prazo, e não a ausência de ação'
           when n.nunca::numeric / nullif(n.coorte, 0) < 0.25
             then 'menos de um quarto do grupo ficou sem nenhuma ação'
      end as motivo,
      -- janela_min e janela_max espelham a régua de bi_tempo_primeiro_valor, que recorta quem
      -- entrou entre trinta e cento e oitenta dias atrás. Viajam como parâmetro para a frase
      -- não guardar a régua por extenso e apodrecer se o SQL da RPC mudar.
      jsonb_build_object(
        'nunca', n.nunca,
        'coorte', n.coorte,
        'agiram', n.agiram,
        'ate_uma_semana', n.ate_uma_semana,
        'parte', round(n.nunca::numeric / nullif(n.coorte, 0), 4),
        'janela_min', 30,
        'janela_max', 180) as parametros,
      round(n.nunca::numeric / nullif(n.coorte, 0) / 0.25, 2) as score
    from tpv_n n
  ),

  todas as (
    select * from r_perda_antes_da_conta
    union all select * from r_erro_sem_categoria
    union all select * from r_onboarding_nao_comeca
    union all select * from r_master_nao_convida
    union all select * from r_sem_primeira_acao
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

grant execute on function insights.calcular_achados_entrada(integer, text, text) to authenticated;

delete from insights.achado_cache where chave like 'entrada|%';
