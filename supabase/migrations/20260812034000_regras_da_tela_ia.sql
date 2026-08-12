-- /ia — Consultor & Builder: catálogo de regras + calculador de achados.
-- Régua nunca aparece escrita no texto: viaja como parâmetro, para o teste de CI
-- que proíbe dígito nos quatro campos de gabarito continuar valendo.

insert into insights.regra
  (id, tela, familia, titulo, pergunta, gabarito, gabarito_leitura, gabarito_acao,
   limiar_descricao, ancora_aba, ancora_id, ordem)
values
  ('ia_recorrencia', 'ia', 'habito',
   'O Consultor ainda não virou hábito',
   'Quem abriu o Consultor no período voltou em algum outro dia?',
   '{voltam:int} dos {usuarios:int} clientes que usaram o Consultor nos últimos {janela:int} dias voltaram em um segundo dia — {taxa_retorno:pct} de quem experimentou.',
   'Um dia de uso não separa quem achou útil de quem só foi ver o que era, e o total de usuários da ferramenta soma os dois. A ferramenta pode não ter decepcionado ninguém: o que falta é um segundo motivo para abrir. É a diferença entre uma ferramenta que o cliente lembra que existe e uma que ele conheceu uma vez.',
   'Antes de comprar alcance, resolver o retorno: o gargalo está entre a primeira e a segunda visita, não na porta de entrada. O teste mais barato é dar um motivo datado para voltar — retomar o que ficou aberto na conversa anterior — e acompanhar a faixa de dois dias ou mais em Recorrência do Consultor.',
   'Menos da metade dos clientes que usaram o Consultor no período voltando em um segundo dia, avaliado apenas na janela mensal ou maior.',
   'adocao', 'card-recorrencia-consultor', 1),

  ('ia_impacto_retencao', 'ia', 'retencao',
   'Quem toca IA na primeira semana segue ativo mais',
   'Clientes que usaram Consultor ou Builder na primeira semana continuam ativos mais que os demais?',
   'Entre quem entrou depois do lançamento do Consultor, quem tocou em IA nos primeiros {janela_ia:int} dias segue ativo em {taxa_com:pct} dos casos. Quem não tocou, {taxa_sem:pct} — {gap:pp} de diferença, sobre {n_com:int} e {n_sem:int} clientes.',
   'Ativo aqui é comportamento, não contrato: teve ao menos uma ação entre o {dia_ret_min:int}º e o {dia_ret_max:int}º dia de casa. A comparação também não isola a IA — o grupo que não usou inclui quem nunca voltou depois do cadastro, então boa parte da distância é ter estado ativo, qualquer que fosse a ação. Serve para prever quem fica. Não serve para dizer que a ferramenta faz ficar.',
   'Usar como sinal de risco, não como prova de efeito: quem passou da primeira semana sem tocar em IA entra na fila de contato, e os nomes estão em Clientes em risco — lista para ação, em Clientes & Retenção. Para virar argumento de investimento, falta na tela um terceiro grupo — quem esteve ativo na primeira semana e mesmo assim não usou.',
   'Diferença de pelo menos dez pontos percentuais na retenção entre os dois grupos, maior que dois erros padrão da própria estimativa e com pelo menos trinta clientes de cada lado.',
   'impacto', 'card-impacto-ia', 2),

  ('ia_adocao', 'ia', 'alcance',
   'A IA alcança uma minoria de quem aparece',
   'Que fatia dos clientes que aparecem no produto chega às ferramentas de IA?',
   '{lider_usuarios:int} dos {ativos:int} clientes com alguma ação nos últimos {janela:int} dias usaram o {lider_nome} — {lider_pct:pct} de quem apareceu. O {segundo_nome} chega a {segundo_usuarios:int} deles, {segundo_pct:pct}.',
   'A conta é sobre quem abriu o produto no período, não sobre a base contratada: isto não mede quem sumiu, mede quem estava dentro e passou ao lado. A maior parte de quem aparece não toca em IA — e tocar em IA é, na aba Impacto na retenção, o sinal mais forte de quem continua ativo. O que o número não separa é quem não quis de quem não achou.',
   'Alcance é o teto de qualquer ganho de retenção por esse caminho: melhorar a ferramenta para quem já usa não move a maioria, que não chega nela. O caminho mais curto é colocar a entrada onde o cliente já está — a repartição por ferramenta está em Adoção entre clientes ativos.',
   'A ferramenta de IA mais usada alcançando menos da metade dos clientes ativos no período, avaliado apenas na janela mensal ou maior.',
   'adocao', 'card-adocao-ia', 3),

  -- A ação nomeia o card "Builder — confiabilidade por etapa". A revisão de texto pede
  -- renomear o card para "Builder — tempo e erro por etapa", já que o achado conclui que
  -- confiabilidade não é o problema. Quando o card for renomeado, esta linha acompanha.
  ('ia_builder_espera', 'ia', 'atrito',
   'No Builder, o atrito é espera, não erro',
   'O que trava a experiência do Builder hoje — falha ou tempo?',
   'A etapa mais lenta do Builder leva {segundos_max:dec} segundos em média, e {etapas_lentas:int} das {etapas:int} etapas passam de {limiar_segundos:int} segundos. A etapa que mais falha fica em {erro_max:dec}% de erro.',
   'O cabeçalho do card destaca o erro e a tabela ordena por tempo — a leitura sai torta. Confiabilidade não é o problema aqui: o fluxo entrega quase tudo que promete. O custo é a espera somada de quem gera uma solução inteira. E média não é o pior caso: o que faz o cliente fechar a aba é o pior, não o típico.',
   'A alavanca é a percepção da espera, não correção de bug: progresso por etapa, resultado parcial e aviso quando terminar. A ordem por tempo médio está em Builder — confiabilidade por etapa; atacar de cima para baixo.',
   'Ao menos uma etapa acima de um minuto de tempo médio, com a etapa de maior erro abaixo de um por cento — se o erro passar disso, a leitura muda de assunto.',
   'uso', 'card-builder-etapas', 4)
on conflict (id) do update set
  tela = excluded.tela,
  familia = excluded.familia,
  titulo = excluded.titulo,
  pergunta = excluded.pergunta,
  gabarito = excluded.gabarito,
  gabarito_leitura = excluded.gabarito_leitura,
  gabarito_acao = excluded.gabarito_acao,
  limiar_descricao = excluded.limiar_descricao,
  ancora_aba = excluded.ancora_aba,
  ancora_id = excluded.ancora_id,
  ordem = excluded.ordem;

-- p_papel e p_plano entram sem uso: nenhuma RPC de /ia aceita segmento hoje. A assinatura
-- existe para casar com argsSegmento do hook useAchados — filtrar aqui faria a frase
-- divergir do card, que continuaria mostrando a base inteira.
create or replace function insights.calcular_achados_ia(
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

  ado_duas as (
    -- 'Usam os dois' fica fora: é interseção, não alcance, e é a única linha da RPC
    -- calculada sem o filtro de cliente — entra com régua diferente do próprio denominador.
    -- Casamento por rótulo de exibição: renomear 'Consultor IA'/'Builder' zera esta CTE.
    select a.ferramenta, a.usuarios, a.pct_dos_ativos,
           row_number() over (order by a.usuarios desc) as posicao
    from ado a
    where a.ferramenta in ('Consultor IA', 'Builder')
  ),
  ado_par as (
    -- ativos é reconstruído (usuarios / pct), porque a RPC não devolve o denominador. Bate
    -- com a contagem direta nos três períodos, mas depende do arredondamento de quatro
    -- casas do pct: se bi_ia_adocao ganhar uma coluna de ativos, trocar por ela.
    select
      max(d.ferramenta)     filter (where d.posicao = 1) as lider_nome,
      max(d.usuarios)       filter (where d.posicao = 1) as lider_usuarios,
      max(d.pct_dos_ativos) filter (where d.posicao = 1) as lider_pct,
      max(d.ferramenta)     filter (where d.posicao = 2) as segundo_nome,
      max(d.usuarios)       filter (where d.posicao = 2) as segundo_usuarios,
      max(d.pct_dos_ativos) filter (where d.posicao = 2) as segundo_pct,
      round(max(d.usuarios) filter (where d.posicao = 1)
            / nullif(max(d.pct_dos_ativos) filter (where d.posicao = 1), 0)) as ativos
    from ado_duas d
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
    from ado_par p
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

grant execute on function insights.calcular_achados_ia(integer, text, text) to authenticated;
delete from insights.achado_cache where chave like 'ia|%';
