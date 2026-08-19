-- A adoção de IA vira partição, e a interseção deixa de ser categoria irmã
--
-- O DEFEITO
--
-- `bi_ia_adocao` devolvia três linhas desenhadas como categorias irmãs, mesma
-- cor e mesma espessura: 'Consultor IA' 1.227 · 'Builder' 535 · 'Usam os dois'
-- 377. A terceira é um INTERSECT — subconjunto das duas primeiras. Quem soma as
-- barras para dimensionar o alcance chega a 2.139; o alcance real é 1.430. Erro
-- de 49,6% num gráfico ancorado no zero, que é a forma que mais convida a somar.
--
-- E A LINHA QUE NINGUÉM FILTRAVA
--
-- O CTE `ambos` era o ÚNICO da função sem a régua `e_cliente` — as duas
-- primeiras linhas contavam só cliente e a terceira contava todo mundo. São 45
-- não-clientes: 377 vira 332. Não é arredondamento, é régua diferente dentro da
-- mesma função, e nenhum grep por `e_cliente` acusaria, porque a função cita a
-- régua duas vezes antes de deixar de citá-la na terceira.
--
-- O motor de achados JA SABIA DOS DOIS. `insights.calcular_achados_ia` excluía
-- a linha com o comentário "é interseção, não alcance, e é a única linha da RPC
-- calculada sem o filtro de cliente". O defeito estava documentado numa camada
-- e publicado na outra.
--
-- O CONSERTO
--
-- Partição de verdade: 'Só Consultor' · 'Os dois' · 'Só Builder', que somam o
-- alcance por construção. E o denominador para de ser adivinhado: `ativos`,
-- `alcance`, `alcance_consultor` e `alcance_builder` viram colunas de janela
-- (iguais em toda linha, como `bi_entrada_aceite_convite` já fazia). O motor
-- reconstruía `ativos` como `usuarios / pct` e ficava refém do arredondamento
-- de quatro casas do pct — o próprio comentário dele pedia esta coluna.
--
-- `drop` e não `create or replace`: o tipo de retorno muda.

drop function if exists public.bi_ia_adocao(integer);

create function public.bi_ia_adocao(p_dias integer default 30)
returns table(
  ferramenta text,
  ordem integer,
  usuarios bigint,
  pct_dos_ativos numeric,
  ativos bigint,
  alcance bigint,
  alcance_consultor bigint,
  alcance_builder bigint
)
language sql
stable
set search_path to ''
as $function$
  with hoje as (select marts.data_referencia() d),
  cons as (
    select distinct c.user_id
    from marts.fact_consultor_uso_diario c
    join marts.dim_usuario u on u.user_id = c.user_id and u.e_cliente, hoje h
    where c.data_brt > h.d - p_dias
  ),
  buil as (
    select distinct b.user_id
    from marts.fact_builder_solucao b
    join marts.dim_usuario u on u.user_id = b.user_id and u.e_cliente, hoje h
    where (b.criado_em at time zone 'America/Sao_Paulo')::date > h.d - p_dias
  ),
  atv as (
    select count(distinct f.user_id) as n
    from marts.fact_evento f
    join marts.dim_usuario u on u.user_id = f.user_id and u.e_cliente, hoje h
    where f.data_brt > h.d - p_dias
  ),
  base as (
    select (select count(*) from cons) as n_cons,
           (select count(*) from buil) as n_buil,
           (select count(*) from (select * from cons intersect select * from buil) i) as n_ambos,
           (select n from atv) as n_ativos
  )
  select e.ferramenta, e.ordem, e.n,
         round(e.n::numeric / nullif(b.n_ativos, 0), 4),
         b.n_ativos,
         b.n_cons + b.n_buil - b.n_ambos,
         b.n_cons,
         b.n_buil
  from base b
  cross join lateral (values
    ('Só Consultor', 1, b.n_cons - b.n_ambos),
    ('Os dois',      2, b.n_ambos),
    ('Só Builder',   3, b.n_buil - b.n_ambos)
  ) as e(ferramenta, ordem, n)
  order by e.ordem;
$function$;

grant execute on function public.bi_ia_adocao(integer) to authenticated, service_role;

comment on function public.bi_ia_adocao(integer) is
  'Adocao de IA como PARTICAO: as tres linhas se somam e dao o alcance. A versao anterior devolvia alcance por ferramenta mais a intersecao como terceira linha irma, e somar as barras inflava o alcance em 49,6%. O alcance de cada ferramenta continua disponivel como coluna de janela (alcance_consultor / alcance_builder) - e a forma certa para um numero que nao e fatia do grafico. As tres leituras aplicam e_cliente, inclusive a intersecao, que era a unica que nao aplicava.';

-- O motor passa a ler as colunas de janela em vez de casar rótulo de exibição e
-- reconstruir o denominador por divisão.
create or replace function insights.calcular_achados_ia(
  p_dias integer default 30, p_papel text default null, p_plano text default null
)
returns table(
  regra text, familia text, severidade text, titulo text, gabarito text,
  gabarito_leitura text, gabarito_acao text, parametros jsonb, score numeric,
  suprimida boolean, motivo text, ancora_aba text, ancora_id text
)
language sql
stable
set search_path to ''
as $function$
  with
  rec as materialized (select * from public.bi_consultor_recorrencia(p_dias)),
  ado as materialized (select * from public.bi_ia_adocao(p_dias)),
  imp as materialized (select * from public.bi_ia_impacto_retencao()),
  -- 90 fixo de propósito: é o argumento que a página passa (src/features/ia/queries.ts).
  -- Usar p_dias aqui faria a frase contar uma janela que a tabela do card não mostra.
  bst as materialized (select * from public.bi_builder_steps(90)),

  rec_agg as (
    -- ordem > 1 é toda faixa acima de "1 dia" na régua da própria RPC
    select coalesce(sum(r.usuarios), 0) as usuarios,
           coalesce(sum(r.usuarios) filter (where r.ordem > 1), 0) as voltam
    from rec r
  ),
  r_recorrencia as (
    select 'ia_recorrencia'::text as regra,
      -- abaixo do mês quase todo usuário cabe na faixa de um dia: o score dispararia
      -- por mecânica de janela, não por perda de hábito
      case when p_dias < 30 then 'janela menor que a mensal não separa hábito de visita única'
           when a.usuarios < 30 then 'menos de trinta clientes usaram o Consultor no período'
           when a.voltam::numeric / nullif(a.usuarios, 0) >= 0.5
             then 'mais da metade dos usuários voltou em um segundo dia'
      end as motivo,
      jsonb_build_object('voltam', a.voltam, 'usuarios', a.usuarios, 'janela', p_dias,
        'taxa_retorno', round(a.voltam::numeric / nullif(a.usuarios, 0), 4)) as parametros,
      round(0.5 / nullif(a.voltam::numeric / nullif(a.usuarios, 0), 0), 2) as score
    from rec_agg a
  ),

  imp_par as (
    -- Casamento por rótulo de exibição ('Usou IA na 1ª semana' / 'Não usou IA'): a RPC não
    -- devolve chave crua do grupo, então renomear o rótulo suprime a regra em silêncio.
    select
      max(i.pct_retencao) filter (where i.grupo like 'Usou%') as taxa_com,
      max(i.pct_retencao) filter (where i.grupo like 'Não%')  as taxa_sem,
      max(i.clientes)     filter (where i.grupo like 'Usou%') as n_com,
      max(i.clientes)     filter (where i.grupo like 'Não%')  as n_sem,
      count(*) filter (where i.pct_retencao is not null) as grupos
    from imp i
  ),
  r_impacto as (
    -- O gap é associativo, não causal: condicionando a ter tido qualquer ação na primeira
    -- semana ele cai de 15,4 pp para 5,8 pp. Por isso o texto nega o efeito e o score não
    -- ganha nenhum bônus — ele mede só a distância bruta contra o limiar de dez pontos.
    select 'ia_impacto_retencao'::text as regra,
      case when p.grupos < 2 then 'a comparação não tem os dois grupos com taxa apurada'
           when least(p.n_com, p.n_sem) < 30 then 'menos de trinta clientes em um dos grupos'
           when p.taxa_com - p.taxa_sem < 0.10
             then 'diferença abaixo do limiar de dez pontos percentuais'
           when p.taxa_com - p.taxa_sem < 2 * sqrt(p.taxa_com * (1 - p.taxa_com) / nullif(p.n_com, 0)
                                                 + p.taxa_sem * (1 - p.taxa_sem) / nullif(p.n_sem, 0))
             then 'diferença dentro da margem de erro da própria estimativa'
      end as motivo,
      -- janela_ia, dia_ret_min e dia_ret_max espelham a régua chumbada em
      -- public.bi_ia_impacto_retencao (entrada+7 · entrada+30 até entrada+60). Se a RPC
      -- mudar a janela, estes três números mentem sem quebrar nada — atualizar junto.
      jsonb_build_object('taxa_com', p.taxa_com, 'taxa_sem', p.taxa_sem,
        'n_com', p.n_com, 'n_sem', p.n_sem,
        'gap', round((p.taxa_com - p.taxa_sem) * 100, 1),
        'janela_ia', 7, 'dia_ret_min', 30, 'dia_ret_max', 60) as parametros,
      round((p.taxa_com - p.taxa_sem) / 0.10, 2) as score
    from imp_par p
  ),

  ado_par as (
    -- Agregado, e não `where ordem = 1`, de propósito: max() sobre conjunto vazio
    -- devolve UMA linha de nulos, e uma linha vazia mantém a regra viva para ser
    -- SUPRIMIDA com motivo. Filtrar por linha faria a regra sumir do bloco em vez
    -- de se declarar — o resumo tem permissão de dizer que não há nada a dizer,
    -- não de omitir que tentou.
    select max(a.ativos) as ativos,
           max(a.alcance_consultor) as alcance_consultor,
           max(a.alcance_builder) as alcance_builder
    from ado a
  ),
  ado_lider as (
    -- O alcance de cada ferramenta agora chega como coluna. Antes saía de linhas
    -- casadas por rótulo de exibição (renomear a linha zerava a regra em silêncio)
    -- e o denominador era reconstruído por `usuarios / pct`, refém do
    -- arredondamento de quatro casas. greatest/least ignoram nulo e só devolvem
    -- nulo quando os dois faltam, que é exatamente o caso suprimido.
    select p.ativos,
      case when coalesce(p.alcance_consultor, 0) >= coalesce(p.alcance_builder, 0)
           then 'Consultor IA' else 'Builder' end as lider_nome,
      greatest(p.alcance_consultor, p.alcance_builder) as lider_usuarios,
      round(greatest(p.alcance_consultor, p.alcance_builder)::numeric
            / nullif(p.ativos, 0), 4) as lider_pct,
      case when coalesce(p.alcance_consultor, 0) >= coalesce(p.alcance_builder, 0)
           then 'Builder' else 'Consultor IA' end as segundo_nome,
      least(p.alcance_consultor, p.alcance_builder) as segundo_usuarios,
      round(least(p.alcance_consultor, p.alcance_builder)::numeric
            / nullif(p.ativos, 0), 4) as segundo_pct
    from ado_par p
  ),
  r_adocao as (
    select 'ia_adocao'::text as regra,
      -- a penetração cresce com o tamanho da janela e o limiar foi calibrado no mês;
      -- a supressão lê lider_pct, o mesmo conjunto filtrado que o score usa
      case when p_dias < 30
             then 'janela menor que a mensal subestima o alcance de ferramenta de uso ocasional'
           when p.ativos is null or p.ativos < 30 then 'menos de trinta clientes ativos no período'
           when p.lider_pct >= 0.5 then 'a ferramenta líder já alcança mais da metade dos clientes ativos'
      end as motivo,
      jsonb_build_object('lider_nome', p.lider_nome, 'lider_usuarios', p.lider_usuarios,
        'lider_pct', p.lider_pct, 'segundo_nome', p.segundo_nome,
        'segundo_usuarios', p.segundo_usuarios, 'segundo_pct', p.segundo_pct,
        'ativos', p.ativos, 'janela', p_dias) as parametros,
      round(0.5 / nullif(p.lider_pct, 0), 2) as score
    from ado_lider p
  ),

  bst_agg as (
    -- pct_erro já vem em pontos percentuais, igual ao que a tabela desenha
    select max(b.segundos_medio) as segundos_max,
           count(*) filter (where b.segundos_medio >= 60) as etapas_lentas,
           count(*) as etapas,
           count(*) filter (where b.segundos_medio is not null) as etapas_medidas,
           max(b.pct_erro) as erro_max
    from bst b
  ),
  r_builder as (
    select 'ia_builder_espera'::text as regra,
      case when a.etapas_medidas = 0 then 'nenhuma etapa do Builder concluiu geração na janela da tabela'
           -- se o erro sobe, o achado deixa de ser verdadeiro: o assunto vira confiabilidade
           when a.erro_max >= 1 then 'há etapa com erro acima de um por cento: o assunto passa a ser confiabilidade'
           when a.segundos_max < 60 then 'nenhuma etapa passa de um minuto de tempo médio'
      end as motivo,
      jsonb_build_object('segundos_max', a.segundos_max, 'etapas_lentas', a.etapas_lentas,
        'etapas', a.etapas, 'limiar_segundos', 60, 'erro_max', a.erro_max) as parametros,
      round(a.segundos_max / 60, 2) as score
    from bst_agg a
  ),

  todas as (
    select * from r_recorrencia
    union all select * from r_impacto
    union all select * from r_adocao
    union all select * from r_builder
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

-- O conjunto de regras não entra na chave do cache: sem a purga a tela serviria
-- o texto antigo — alcance calculado sobre a interseção não filtrada — sem erro
-- nenhum.
delete from insights.achado_cache where chave like 'ia|%';
