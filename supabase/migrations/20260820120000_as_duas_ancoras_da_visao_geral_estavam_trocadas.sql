-- As duas âncoras da Visão Geral apontavam para o card errado
--
-- Achado ao auditar o CONTEÚDO das abas Análise e Plano — a camada que nenhuma
-- auditoria anterior tinha olhado, porque todas cobriram só a aba Gráficos.
--
-- ⚠️ E ELE ESCAPOU DE UMA CHECAGEM MINHA DE ONTEM. Eu havia conferido que os 33
-- `ancora_id` EXISTEM na página de cada tela, e concluí que nenhum link estava
-- quebrado. Existir não é apontar para o card certo: o link "Ver o gráfico que
-- sustenta" pode resolver, rolar, e levar a um card que não contém o número da
-- frase. A checagem necessária não era suficiente.
--
-- 1. `vg_tendencia` LEVAVA A UM GRÁFICO QUE NÃO CABE O NÚMERO
--
-- A frase é "os ativos variaram +9,1% — 3.664 contra 3.359", e a âncora era
-- `card-atividade`, o gráfico "Usuários ativos por dia". Medido: essa série vai
-- de 109 a 518 em trinta pontos. **3.664 é sete vezes o pico do gráfico** — o
-- número não está lá e não teria como estar, porque um é diário e o outro é o
-- distinto do período.
--
-- Os três números da frase estão, os três, na fileira de KPIs: o tile "Usuários
-- ativos" imprime 3.664 e o delta imprime "+9,1% vs período anterior". A âncora
-- passa a ser `card-kpis`.
--
-- É a classe que a migration 20260818110000 já tinha nomeado: "o pior caso
-- desta classe é quem clica para conferir encontrar o contrário do que leu".
--
-- 2. `vg_penetracao` APONTAVA PARA A FILEIRA DE KPIs, QUE NÃO TEM A FRASE
--
-- A frase é "3.664 de 15.125 clientes tiveram ao menos uma ação — 24,2% da
-- base". A fileira de KPIs publica 3.664 e NÃO publica nem 15.125 nem 24,2%.
-- Quem tem a frase inteira é o card "Quem apareceu, e quem não" — headline
-- 24,2%, e as duas barras 3.664 / 11.461 que somam 15.125.
--
-- Esse card **não tinha `id`**, então não podia ser âncora. Ganhou
-- `card-penetracao` no mesmo commit.
--
-- 3. A LEITURA DE `vg_tendencia` OMITIA O ÚNICO CONFUNDIDOR QUE INVERTE O SINAL
--
-- Ela listava três componentes do NUMERADOR (entrada nova, reativação,
-- retenção) e não mencionava o denominador. Medido na mesma carga:
--
--   ativos      3.359 → 3.664   (+9,08%)
--   base       13.280 → 15.125  (+13,89%)
--   penetração  25,29% → 24,22%  (−1,07 pp)
--
-- A base cresceu MAIS que os ativos, então a fatia da base que aparece
-- ENCOLHEU. A tela publicava "+9,1%" em verde no topo e um achado de alcance de
-- 24,2% na aba ao lado, sem que nenhum dos dois dissesse isso. A leitura passa
-- a declarar o denominador e a apontar para o achado de alcance.
--
-- 4. A AÇÃO DE `vg_penetracao` CHAMAVA DE "PAGANTE" QUEM NÃO PAGOU, E MANDAVA
--    PARA UM MÓDULO QUE NÃO EXISTE
--
-- "É gente pagando sem usar. A lista nominal está em Clientes & Retenção."
--
-- - `base` filtra só `e_cliente`, que é régua de EXCLUSÃO (tira admin, interno
--   e teste) e nunca de compra: 13.026 dos 15.125 (86,1%) entraram por convite
--   e não compraram nada.
-- - "Clientes & Retenção" não existe em lugar nenhum do fonte; o módulo se
--   chama "Clientes".
-- - E a lista de lá não alcança essa população: `bi_clientes_em_risco` junta
--   com a última ação registrada, então quem nunca agiu não tem linha e fica
--   fora por construção.
--
-- O mesmo "base pagante" saiu do headline, da descrição e da prosa da seção na
-- página, no mesmo commit — senão a tela se contradiria.
--
-- 5. A AÇÃO DE `vg_tendencia` ERA A LEITURA REESCRITA
--
-- As duas abriam com "Variação de base inteira raramente..." e listavam os
-- mesmos componentes. Na aba Plano isso fica adjacente: a ação é a linha
-- sempre visível e a leitura abre logo abaixo, então o leitor que veio atrás do
-- que fazer lia duas vezes a mesma ressalva. A ação nova nomeia o card que
-- decompõe os ativos e diz por que a decomposição muda a leitura.

update insights.regra set
  ancora_id = 'card-kpis',
  gabarito_leitura = 'Variação de base inteira raramente tem causa única: entrada nova, reativação e retenção empurram o mesmo número em direções diferentes, e podem se anular sem que nada tenha melhorado. E o denominador se move junto — a base de clientes cresce a cada janela, então ativos subindo não quer dizer que a fatia da base que aparece subiu. Quem responde isso é o achado de alcance, nesta mesma tela.',
  gabarito_acao = 'Separe a variação antes de tratá-la como crescimento: o card de origem dos ativos, nesta tela, diz quanto veio de quem foi retido, quanto de quem voltou e quanto de quem entrou agora. Aquisição e reativação têm donos diferentes, e a leitura muda conforme qual das três carregou o número.'
where id = 'vg_tendencia';

update insights.regra set
  ancora_id = 'card-penetracao',
  pergunta = 'Que fatia da base de clientes usou o produto no período?',
  limiar_descricao = 'Penetração abaixo de metade da base de clientes.',
  gabarito_acao = 'O restante não é churn ainda: é gente com acesso e sem uso. A lista nominal de Clientes alcança só quem já agiu alguma vez e ficou em silêncio dentro da janela dela — quem nunca abriu o produto não aparece lá.'
where id = 'vg_penetracao';

-- A âncora vai SERIALIZADA no cache, então sem a purga o link continuaria
-- levando ao card errado, sem erro nenhum.
delete from insights.achado_cache where chave like 'visao-geral|%';
