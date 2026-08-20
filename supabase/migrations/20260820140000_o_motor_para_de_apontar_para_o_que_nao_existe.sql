-- Vinte e duas frases do motor param de afirmar o que não se sustenta
--
-- Segunda rodada da auditoria de CONTEÚDO das abas Análise e Plano. A primeira
-- levantou 63 acusações pendentes; esta reverificou as 21 de gravidade alta —
-- cada uma refeita do zero no banco, sem reaproveitar o número da acusação,
-- porque auditor também erra e conserto errado publica afirmação nova e não
-- revisada, que é pior que o defeito original.
--
-- O placar justifica a disciplina: das 21, **18 confirmadas, 1 parcial e 2
-- REFUTADAS**. Somam-se 4 achadas por varredura própria, fora da lista.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- O QUE AS DUAS REFUTAÇÕES ENSINAM
--
-- As duas caíam sobre `sol_conclusao_apos_inicio`, e as duas pelo mesmo erro de
-- leitura: a acusação mediu safras antigas concluindo 13–16% contra os 5,95%
-- publicados e concluiu que a janela de acompanhamento infla o achado. Separando
-- acompanhamento de composição, o que se vê é outra coisa:
--
--   dentro da mesma safra, seguir além de 30 dias rende 0,7 a 2,1 pp
--   (92,1% das conclusões acontecem em até 30 dias do início — mediana 0, p75 3)
--
--   os inícios foram de ~900/semana em mar/2026 para ~2.900/semana em ago/2026,
--   enquanto as conclusões ficaram em ~100/semana o período inteiro
--
-- As safras velhas concluíam mais porque o denominador era metade. A acusação
-- comparava dois REGIMES e chamava de artefato de janela. Corrigir a censura na
-- direção que ela pedia SOBE o score (0,20/0,056 = 3,57 contra 3,36 publicado),
-- não derruba a severidade. Nada mudou nessa regra, de propósito.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- AS FAMÍLIAS QUE APARECERAM
--
-- 1. APONTAR PARA LUGAR QUE NÃO EXISTE (5 frases). Aba aposentada em 18/ago
--    ("Risco & churn", "Funil", "Impacto na retenção"), card renomeado, métrica
--    que a tela não tem ("duração mediana" em /jornada), interação que o
--    componente não oferece ("ordenar o raio-x" — `TabelaLonga` não ordena).
--    Nenhuma dessas quebra nada: o leitor vai procurar e não acha.
--
-- 2. PROMETER ALCANCE QUE A LISTA NÃO TEM (3 frases). `cli_comprador` mandava
--    buscar 2.740 nomes numa lista que alcança 536 deles — `bi_clientes_em_risco`
--    filtra uma JANELA (d−74 a d−14), não um piso, então 4 de cada 5 estão fora
--    por construção, com silêncio médio de 137 dias.
--
-- 3. DECLARAR O CONFUNDIDOR ERRADO, OU NENHUM (6 frases). `cli_mortalidade`
--    dizia que o comparador iguala os grupos; ele só iguala o TAMANHO do
--    público. `org_efeito_master` não dizia que o master é membro da própria
--    conta que ele lidera — a presença dele entra na fração que mede o time.
--    `for_duracao` é o caso mais fino e virou PARCIAL: a taxa é razão contra a
--    aula mais vista do próprio curso, e essa é quase sempre a primeira da
--    grade (45 das 46 aulas com razão no teto estão na posição 1, e 29 delas
--    caem em "Até 5 min"). Excluindo a posição 1, a queda ponta a ponta cai de
--    14,3 pp para 9,97 pp — abaixo do limiar de 10 pp da própria regra. Mas a
--    acusação dizia "sinal invertido", e isso não se sustenta: sem a posição 1 a
--    ordem segue caindo monotonicamente. É omissão de confundidor, não inversão.
--
-- 4. TÍTULO QUE CONTRADIZ O PRÓPRIO FATO (2 frases). "A maioria aparece e some"
--    em cima de 41,6%, com a âncora levando a um card cujo headline é o
--    complemento (58,7%) — quem clica para conferir encontra o contrário. E a
--    régua publica a partir de 33,4%, então o título afirmaria "maioria" em toda
--    a faixa de 33,4% a 50%.
--
-- 5. NOME QUE A TELA ABANDONOU (1 frase). "organizações ativas" é justamente o
--    nome ambíguo que a fileira de KPIs trocou por "ativas com time".
--
-- 6. IMUNE AO PERÍODO, PUBLICADO SOB RÓTULO DE JANELA (1 frase). Ver [+4].
--
-- ─────────────────────────────────────────────────────────────────────────────
-- ⚠️ UM ACHADO FICA EM ABERTO, E É DE PRODUTO — NÃO ENTRA AQUI
--
-- `sol_atencao_por_categoria` publica 3,8% do catálogo, 8,4% dos pageviews e
-- 2,2× — os três CORRETOS (refiz a agregação) e **nenhum deles existe em card
-- algum de /solucoes**. A âncora leva a uma `TabelaLonga` por solução, que não
-- agrega por categoria nem imprime total de pageviews. É exatamente o caso que
-- o CLAUDE.md nomeia ("o número da frase existe num card da tela — sempre") e
-- pelo qual `org_time_morto` foi recusada em 12/ago.
--
-- Não há conserto de TEXTO: os cinco marcadores já existem: o que falta é o
-- número na tela. As duas saídas mudam o que um card mostra — decisão do Mateus,
-- não minha:
--   (a) "Uso por categoria" passa a publicar a fatia de PAGEVIEW por categoria,
--       e a âncora muda para lá; ou
--   (b) a regra passa a liderar pela fatia das INICIADAS, que a tela já tem
--       (Financeiro 7,55% contra 3,80% do catálogo = 1,99×, o vencedor não muda
--       e a regra segue disparando) — exige o parâmetro novo `parte_iniciadas`.
--
-- Enquanto não se decide, a leitura ao menos para de afirmar o que é falso.

-- ==========================================================================
-- OS DEZOITO CONSERTOS REVERIFICADOS
-- ==========================================================================

-- [01] cli_comprador · acao
update insights.regra set gabarito_acao = 'São {convidados_inativos:int} convidados elegíveis sem nenhuma ação recente — o maior bloco que o corte comprador × convidado isola nesta tela. A ativação de hoje é desenhada para quem comprou; o convidado precisa de um primeiro passo próprio. Parte deles aparece em Clientes em risco — lista para ação, na aba Gráficos: aquela lista só alcança quem calou dentro da janela dela, e quem parou antes disso fica de fora.' where id = 'cli_comprador';

-- [02] cli_frequencia · titulo
update insights.regra set titulo = 'Muita gente aparece uma vez e some' where id = 'cli_frequencia';

-- [03] cli_mortalidade · leitura
update insights.regra set gabarito_leitura = 'Módulo de muito alcance sobe nessa conta sem ter culpa: quem para em qualquer lugar passou por ele antes. O comparador só iguala o tamanho do público: não iguala a fatia dele que já saiu do produto, nem separa quem usou os dois módulos. Se {modulo_topo} reúne mais gente que entrou e saiu do que {modulo_par}, a taxa dele sobe por isso, sem que {modulo_topo} afaste ninguém. O que esta tela sustenta é que a jornada de quem passou por {modulo_topo} termina ali com mais frequência; ela não separa falta de passo seguinte da composição de quem chega lá.' where id = 'cli_mortalidade';

-- [04] ent_onboarding_nao_comeca · leitura
update insights.regra set gabarito_leitura = 'Abandono espalhado pelo fluxo apontaria uma etapa cara demais. Concentração na primeira aponta outra coisa: o registro de onboarding nasce junto com a conta, e neste grupo ele nunca saiu da etapa em que nasceu — não há sinal de que alguém tenha chegado a abrir o fluxo, e este dado não separa quem abriu e desistiu de quem nunca chegou lá. O formulário pode não ter nada de errado — o mesmo padrão aparece quando alguém entrou por curiosidade, ou quando o convite foi aceito por quem não era o destinatário. O que o dado descarta é a hipótese de fluxo longo demais.' where id = 'ent_onboarding_nao_comeca';

-- [05] ent_onboarding_nao_comeca · acao
update insights.regra set gabarito_acao = 'Encurtar ou reordenar as etapas do meio mexe na minoria. A alavanca é o que acontece imediatamente depois do cadastro — a segunda etapa só é vista por quem já decidiu ficar. Quem passa dali e mesmo assim não age aparece na faixa “Nunca agiu” do card “Quem comprou age; quem foi convidado, não”, na aba Gráficos desta mesma tela.' where id = 'ent_onboarding_nao_comeca';

-- [06] ent_sem_primeira_acao · fato
update insights.regra set
  gabarito = '{pct_convidado:pct} de quem foi convidado nunca fez nenhuma ação no produto, contra {pct_comprador:pct} de quem comprou — {convidados:int} pessoas de um lado, {compradores:int} do outro, na mesma safra fechada e com a mesma carência mínima antes de a medição fechar.',
  gabarito_leitura = 'Os dois grupos saem da mesma medição e da mesma safra, mas o tempo para agir não é igual pessoa a pessoa: a safra é larga, quem entrou no começo dela teve meses a mais que quem entrou no fim, e a conta não iguala isso. O que ela não separa é intenção de acesso — quem compra escolheu o produto, quem foi convidado foi inscrito por outra pessoa, e este dado não diz se o convidado chegou a saber que a conta existia. E {razao:mult} é a distância entre as duas parcelas, não prova de que o convite cause a inação.'
where id = 'ent_sem_primeira_acao';

-- [07] for_duracao · leitura
update insights.regra set gabarito_leitura = 'A queda é contínua: cada degrau custa alguns pontos e não existe um precipício onde cortar. O último degrau é o mais frágil, apoiado em {aulas_longa:int} aulas contra {aulas_curta:int} da faixa mais curta. Acima de {faixa_longa} o catálogo não tem aula suficiente para afirmar nada — faixa com menos de {min_aulas:int} aulas não vira média. E nada disso prova que o relógio é a causa. A taxa é uma razão contra a aula mais vista do próprio curso, e essa aula é quase sempre a primeira da grade, que se concentra na faixa {faixa_curta} — parte do que se lê como efeito da duração é posição, e o peso da posição está em Onde o aluno para no curso. Aula longa também costuma ser aula densa, e quem para pode estar reagindo ao assunto.' where id = 'for_duracao';

-- [08] for_duracao · acao
update insights.regra set gabarito_acao = 'Para grade nova, o dado não escolhe entre as faixas mais curtas: a vantagem de {faixa_curta} sobre a faixa seguinte vem da primeira aula de cada curso, que costuma ser a aula mais vista do próprio curso e entra na média com a razão no teto. O que sobra é o sentido da curva — aula na faixa {faixa_longa} conclui menos que aula curta. No catálogo que já existe, o teste barato é partir uma aula longa em duas e comparar a conclusão das metades com a da aula original. A curva por faixa está em Duração de aula que maximiza conclusão.' where id = 'for_duracao';

-- [09] ia_builder_espera · leitura
update insights.regra set gabarito_leitura = 'O cabeçalho do card destaca o erro e a tabela ordena por tempo — a leitura sai torta. Mas erro declarado não é a única forma de falhar: parte das gerações da janela não concluiu nem registrou erro, e essas entram na taxa de erro do lado de quem deu certo e ficam de fora do tempo médio, que só soma o que concluiu. Então o número diz que erro declarado é raro, não que o fluxo entrega tudo que promete. O custo medido é a espera somada de quem gera uma solução inteira. E média não é o pior caso: o que faz o cliente fechar a aba é o pior, não o típico.' where id = 'ia_builder_espera';

-- [10] ia_impacto_retencao · acao
update insights.regra set gabarito_acao = 'Usar como sinal de risco, não como prova de efeito: quem passou da primeira semana sem tocar em IA entra na fila de contato. Essa fila não sai pronta de nenhum card. A lista nominal do módulo Clientes seleciona por inatividade recente e por plano vencendo, não por IA: quem nunca chegou a agir não tem linha lá, e quem calou antes da janela dela também fica de fora. Para virar argumento de investimento, falta na tela um terceiro grupo — quem esteve ativo na primeira semana e mesmo assim não usou.' where id = 'ia_impacto_retencao';

-- [11] ia_recorrencia · leitura
update insights.regra set gabarito_leitura = 'Um dia de uso não separa quem achou útil de quem só foi ver o que era, e o total de usuários da ferramenta soma os dois. A ferramenta pode não ter decepcionado ninguém: o que falta é um segundo motivo para abrir. É a diferença entre uma ferramenta que o cliente lembra que existe e uma que ele conheceu uma vez. E a janela corta contra o número: quem aparece pela primeira vez perto do fim dela ainda não teve dias para um segundo uso e entra na conta como quem não voltou. Isto é piso do retorno, não o retorno.' where id = 'ia_recorrencia';

-- [12] jor_espelho_sessao · leitura
update insights.regra
set gabarito_leitura = 'Duas explicações cabem no mesmo número e pedem ações opostas. Uma é intenção: as pessoas chegam de fora direto no conteúdo e desistem nele. A outra é a régua: sessão aqui é navegação com intervalo menor que {intervalo_sessao:int} minutos por usuário, e conteúdo longo atravessa esse intervalo sem clique nenhum — a sessão anterior morre na tela e a seguinte nasce na mesma tela. Esta tela não escolhe entre as duas: Portas de entrada conta em que tela a sessão começa, não de onde o cliente veio antes dela.'
where id = 'jor_espelho_sessao';

-- [13] jor_posicao_inflada · leitura
update insights.regra
set gabarito_leitura = 'Uma tela só chega tão longe na sessão se um punhado de sessões enormes estiver carregando a conta: a posição média dela passa de {limiar_posicao:mult} o tamanho da sessão típica, e navegação humana não tem esse comprimento. O que essas sessões esticam é a posição — que a tela é muito vista não está em dúvida. E a posição alta tem uma segunda explicação que o raio-x não separa: rotas com identificador chegam agrupadas em padrão, então uma linha reúne muitas páginas diferentes, e quem atravessa várias delas na mesma sessão empilha posição sem nada de anormal. O mesmo vale para os {por_usuario:dec} pageviews por usuário aqui, contra {mediana_por_usuario:dec} na tela do meio da fila entre as que passam de {piso_usuarios:int} usuários: esse número não separa quem volta à mesma página de quem percorre muitas.'
where id = 'jor_posicao_inflada';

-- [14] org_efeito_master · fato
update insights.regra
   set gabarito = 'Onde o master — o dono da organização, quem comprou — apareceu nos últimos {janela:int} dias, a fração média do time ativo foi {taxa_com:pct}. Onde ele parou, {taxa_sem:pct}: com o dono presente, essa fração média é {lift:mult} a do outro grupo. São {orgs_com:int} organizações contra {orgs_sem:int}, todas com pelo menos {membros_minimos:int} membros.'
 where id = 'org_efeito_master';

-- [15] org_efeito_master · leitura
update insights.regra
   set gabarito_leitura = 'O sentido da seta não está no dado: o master pode ter parado porque o time parou. E parte da distância é aritmética antes de ser liderança: o master é membro da conta que lidera, então a presença dele entra na própria fração que mede o time — esta conta não separa o dono do resto. As organizações de master parado também são as maiores, {media_sem:dec} membros em média contra {media_com:dec}, e fração de time ativo cai mais fácil em time grande.'
 where id = 'org_efeito_master';

-- [16] rec_falha_cobranca · titulo
update insights.regra
   set titulo = 'Quando a cobrança falha, é na fatura cara'
 where id = 'rec_falha_cobranca';

-- [17] rec_falha_cobranca · acao
update insights.regra set gabarito_acao = 'Esta fonte não registra motivo de recusa nem meio de pagamento, então a causa da falha não sai daqui — o que sai é o peso: a fatura que falha é maior que a fatura aprovada média. Priorizar a recuperação pelo valor, não pela quantidade, e buscar o motivo na origem da cobrança. A contagem e o valor por evento estão em Saúde da cobrança.' where id = 'rec_falha_cobranca';

-- [18] rec_reembolso · leitura
update insights.regra set gabarito_leitura = 'Reembolso mede decisão do cliente, e não do meio de pagamento: quem pediu de volta tinha comprado. O percentual não é uma fatia do que entrou — parte do valor devolvido está em fatura que esta fonte nunca registrou como aprovada, então numerador e denominador não descrevem o mesmo conjunto de vendas, e um reembolso ainda pode devolver uma compra de meses antes. Pelo mesmo motivo o peso da fatura devolvida sobre a aprovada média é frágil: ele encolhe quase até empatar quando se comparam só as faturas que têm os dois eventos, então esta linha diz o tamanho do vazamento, não em que faixa de ticket a desistência acontece. E a conta está fechada: com a fonte parada, ela soma o que voltou enquanto houve registro, não o que volta hoje.' where id = 'rec_reembolso';

-- ==========================================================================
-- OS QUATRO DE VARREDURA PROPRIA
-- ==========================================================================

-- [+1] ia_adocao · leitura — aba extinta e superlativo que a tela não sustenta
--
-- "na aba Impacto na retenção" não existe: as abas de todo módulo são Gráficos,
-- Análise e Plano desde 18/ago. O card certo é "Usar IA na 1ª semana muda a
-- retenção?", em Gráficos.
--
-- E "o sinal mais forte de quem continua ativo" é falso. Medido hoje, na mesma
-- pergunta ("continua ativo"):
--
--   amplitude, 3 módulos × 1     46,7% × 19,4%   2,41×
--   comprador × convidado        37,5% × 19,7%   1,91×
--   IA na 1ª semana              39,3% × 23,3%   1,69×
--
-- IA é o mais FRACO dos três. E as três populações são diferentes — a de IA são
-- clientes que entraram depois de 11/mai/2026 com 60+ dias de casa —, então o
-- superlativo pressupõe uma comparação que o produto não faz em lugar nenhum.
-- A saída não é trocar por outro superlativo: é dizer por que ele não cabe.
update insights.regra set
  gabarito_leitura = 'A conta é sobre quem abriu o produto no período, não sobre a base contratada: isto não mede quem sumiu, mede quem estava dentro e passou ao lado. A maior parte de quem aparece não toca em IA. Quem tocou na primeira semana aparece retido em proporção maior — é o que mede o card de impacto da IA na retenção, que declara ser correlação, não causa. Chamar isso de o sinal mais forte exigiria comparar os cortes desta tela sobre a mesma população, e nenhuma tela do produto faz essa comparação. O que o número não separa é quem não quis de quem não achou.'
where id = 'ia_adocao';

-- [+2] jor_posicao_inflada · ação — métrica fantasma e interação que não existe
--
-- Duas afirmações mandavam o leitor fazer o que a tela não permite:
--
-- 1. "a duração mediana" NÃO EXISTE em /jornada. Os KPIs são Sessões, Telas por
--    sessão (média), Telas por sessão (mediana) e Sessões de tela única. Não há
--    métrica de duração em card nenhum — a frase lista como contaminada uma
--    medida que ninguém pode conferir.
-- 2. "Ordenar o raio-x por usuários" — o card usa `TabelaLonga`, que tem busca e
--    paginação e NÃO tem ordenação. O leitor não consegue executar a ação.
--
-- A correção mantém a ideia (usuários é a coluna que não infla com repetição) e
-- passa a descrever o que dá para fazer de fato.
update insights.regra set
  gabarito_acao = 'Ler a coluna Usuários do raio-x antes de decidir qualquer redesenho — é a que não infla com repetição, e a tabela não ordena, então a comparação é linha a linha. E levar a posição média para quem cuida da instrumentação: sessão de centenas de telas é aba esquecida aberta ou robô, não hábito de uso, e ela contamina de uma vez o ranking de pageview e as telas por sessão.'
where id = 'jor_posicao_inflada';

-- [+3] org_time_ocioso · fato — o nome que a tela abandonou de propósito
--
-- A frase diz "{orgs:int} organizações ativas". A fileira de KPIs da tela chama
-- exatamente esse número de "Organizações ativas com time", e o "com time" foi
-- posto ali de propósito: o card "Onde estão as contas" logo abaixo usa TODAS as
-- ativas, e o mesmo nome cobria duas populações na mesma tela. O comentário em
-- organizacoes-page.tsx registra o par medido na época (1.925 contra 1.957); a
-- diferença são as contas sem ninguém dentro, que não têm fração de time ativo.
--
-- O achado ficou com o nome antigo — o ambíguo — enquanto a tela usava o novo.
update insights.regra set
  gabarito = 'Na organização média, {pct_time_ativo:pct} dos membros teve alguma ação nos últimos {janela:int} dias. A média cobre {orgs:int} organizações ativas com time, {membros:int} pessoas ao todo.'
where id = 'org_time_ocioso';

-- [+4] sol_atencao_por_categoria · leitura — a regra é imune ao período, e diz o
--      contrário sobre a idade do catálogo
--
-- 1. IMUNE AO SELETOR. `bi_solucoes_ranking(200)` lê `marts.v_metricas_solucao`,
--    cujo CTE de pageview NÃO TEM FILTRO DE DATA. O achado é o arquivo inteiro,
--    publicado numa tela cujo topo oferece 7/30/90 dias e cuja linha de escopo
--    declara a janela. Escolher 7 dias não muda um dígito da frase.
--    (O card irmão "Uso por categoria" tem o mesmo desenho:
--    `bi_solucoes_por_categoria()` também não recebe período.)
--
-- 2. "NENHUMA SOLUÇÃO É MAIS NOVA QUE ELA" é falso, e o mart CONSEGUE conferir —
--    `dim_solucao.criada_em` existe. Medido: o arquivo de pageview vai de
--    03/07 a 20/08/2026 (49 dias, o que a purga dominical da plataforma deixou),
--    e 2 das 158 soluções publicadas nasceram depois do início dele. São 1,3% —
--    a afirmação vale em substância e não vale como absoluto, e as duas exceções
--    estão em Vendas e RH, não na categoria líder.
--
-- Vale registrar o que NÃO é defeito, porque a auditoria acusou e a medição
-- inocentou: a liderança de Financeiro (índice 2,22) não vem de um acerto
-- isolado. As seis soluções repartem 24% / 20% / 19% / 15% / 14% / 7% dos
-- pageviews da categoria — é a categoria inteira, e a ressalva da ação continua
-- valendo como ressalva, não como explicação do caso de hoje.
update insights.regra set
  gabarito_leitura = 'O seletor de período no topo não muda este número: os pageviews aqui são todo o arquivo que o BI guarda, não a janela escolhida. Dentro desse arquivo a comparação entre categorias é justa — a janela é a mesma para todas, e quase todo o catálogo já existia antes dela, com poucas soluções recentes demais para pesar. O que ela não diz é por quê. Uma categoria pode atrair porque resolve dor cara, porque o título é claro ou porque aparece mais acima na lista — demanda e posição não se separam aqui. Sobra o fato estreito: a fatia do catálogo e a fatia da atenção não batem.'
where id = 'sol_atencao_por_categoria';

-- O cache guarda o achado SERIALIZADO — texto, ancora e parametros. Sem a purga
-- as oito telas serviriam a frase antiga, sem erro nenhum.
delete from insights.achado_cache
where chave like 'clientes|%' or chave like 'entrada|%' or chave like 'formacoes|%'
   or chave like 'ia|%' or chave like 'jornada|%' or chave like 'organizacoes|%'
   or chave like 'receita|%' or chave like 'solucoes|%';
