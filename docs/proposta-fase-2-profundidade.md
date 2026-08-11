# Proposta — Fase 2: profundidade e direcionamento

Documento de decisão. Consolida o mapeamento dos três bancos, o inventário
crítico dos 48 cards das 10 telas, a auditoria do kit de gráficos e a escolha da
arquitetura do resumo. **Nada vira código antes do OK do Mateus**, fase a fase.

Mapa completo das origens: `mapa-dados-plataforma.md` (211 tabelas, 138
perguntas de decisão, 192 achados de qualidade).

## Convenção de verificação

Este documento nasceu de um levantamento em paralelo, e levantamento em massa
erra. Tudo que sustenta decisão de fase foi **reconferido consultando o banco**,
e está marcado **[conferido]** com o número que eu mesmo medi. O que não tem a
marca é material do levantamento e vale como pista, não como fato — confira
antes de virar tela, exatamente como a régua da casa manda.

Duas afirmações do levantamento **não passaram** na conferência e estão
corrigidas abaixo (§5.3). Registrar o erro é parte do método.

---

## 1. O diagnóstico, em número

O pedido foi: *"as análises estão rasas, quero algo que direcione"*. A tradução
numérica disso é a escada de profundidade, e ela mostra que o problema é
estrutural, não de gosto.

| Nível | Responde | Como se verifica |
| --- | --- | --- |
| 1 · Descritivo | quanto | uma medida, uma janela, um grupo |
| 2 · Comparativo | quanto comparado a quê | dois grupos nomeados **ou** duas janelas, com margem declarada |
| 3 · Diagnóstico | onde / por quê | taxa com denominador correto **+** pelo menos um confundidor declarado |
| 4 · Prescritivo | o que fazer, sobre quem | lista nominal acionável **ou** ação + o número que a justifica |

Placar do parque atual, card a card:

| Tela | Descritivos | Comparativos | Diagnósticos | Prescritivos | Passa? |
| --- | ---: | ---: | ---: | ---: | :---: |
| Visão Geral | 8 | 0 | 0 | 0 | não |
| Clientes & Retenção | 9 | 3 | 3 | 1 | quase |
| Entrada | 8 | 1 | 0 | 0 | não |
| Formações | 5 | 2 | 0 | 0 | não |
| Soluções | 5 | 2 | 0 | 0 | não |
| Consultor & Builder | 5 | 0 | 1 | 0 | não |
| Organizações | 6 | 1 | 0 | 0 | não |
| Jornada & Telas | 9 | 0 | 0 | 0 | não |
| Receita | 8 | 2 | 0 | 0 | não |
| CS | 15 | 1 | 0 | 0 | não (sem carga) |

**Nove das dez reprovam.** O BI hoje é um relatório de contagens com um módulo
de análise dentro (Clientes) e um card exemplar (duração ideal de aula).

### Régua de composição proposta

Uma tela só é dada por pronta com: **no máximo 3 cards descritivos** nas abas,
**mínimo 2 comparativos**, **mínimo 2 diagnósticos** e **1 saída prescritiva**.
Cada card declara seu nível num metadado e um teste no `npm test` reprova o CI
se a tela violar a composição — "profundo" vira condição de merge, não opinião.

---

## 2. Anatomia padrão da tela

Ordem de leitura de cima para baixo, deliberadamente inversa à profundidade:
quem tem 15 segundos lê o topo, quem tem 15 minutos desce.

```
FAIXA 0 · Cabeçalho          título · período · persona/plano      já existe
FAIXA 1 · Limitação do dado  só quando há limitação real           já existe
FAIXA 2 · RESUMO E DIRECIONAMENTO                                  NOVO
FAIXA 3 · KPIs               4 tiles com delta e supressão         já existe
FAIXA 4 · Abas com gráficos  onde a prova mora                     já existe
```

**O resumo mora no topo, largura total, fora das abas.** É o elemento mais lido
e fala da tela inteira; um resumo por aba multiplicaria o catálogo de regras por
quatro e produziria três blocos disputando a mesma atenção. Carrega em consulta
própria, com esqueleto próprio: **nunca atrasa um gráfico**.

### Cada achado tem quatro partes

| Parte | Regra |
| --- | --- |
| Selo de severidade | `StatusPill`, com ícone e rótulo — nunca só cor. O limiar vive em migration, com justificativa |
| Frase executiva | número + régua + denominador, sem jargão. **Percentual sem denominador não sai da fábrica** |
| Linha de ação | separada em `acao_agora` (o que já é válido fazer) e `acao_para_provar` (o experimento, quando o achado é correlacional) |
| Âncora | "ver o card que prova" → rola até o card e aplica o mesmo recorte. **Achado cujo card está em erro não é renderizado** |

Fecham o bloco: a seção **"não dá para afirmar"** (o que foi suprimido e por
quê), o **rodapé de contabilidade** ("11 regras avaliadas · 3 achados · 4
suprimidas") e o **carimbo do dado** ("dados de 8 de ago, 15:30"). Com o
pipeline parado, o carimbo não é enfeite.

A procedência — regra, versão, limiar, margem, função de origem — não entra na
frase: vai para o disclosure "como isso foi apurado", mesma gramática do botão
de informação do `CardCabecalho`.

### Os dois públicos, um texto

A frase executiva é escrita para o CEO: fato, tamanho, régua junto, sem jargão.
A linha de ação é escrita para o time de produto: alavanca, sobre quem, onde
está a lista. **Um achado, dois níveis de leitura** — nunca dois textos, que
divergem na primeira mudança de régua.

### O caso mais importante: quando não há achado

Três estados, todos computados:

**A. Nada fora do padrão.** *"Nada fora do padrão no período. As 11 regras desta
tela foram avaliadas na carga das 15:30 e nenhuma cruzou o limiar. Este bloco
não certifica ausência de problema — ele cobre as 11 perguntas listadas em
/regras."* A segunda frase é obrigatória: o silêncio é uma afirmação, e um motor
de catálogo só sabe o que alguém previu.

**B. Recorte sem sustentação.** *"Sem leitura para Membro do Club × Starter: 47
clientes na janela, abaixo do mínimo de 30. As contagens seguem nos cards. Para
comparar retenção deste papel, tire o filtro de plano: em todos os planos,
Membro do Club tem 418 clientes e a comparação sai."* A segunda linha transforma
beco sem saída em caminho.

**C. Dado defasado.** O bloco não some, mas nenhum achado de tendência é
emitido, e o cabeçalho carrega a data de congelamento.

### Cinco travas anti-ruído

1. **Máximo 3 achados por tela, 1 por família** — senão a tela diz "retenção"
   três vezes com palavras diferentes.
2. **Limiar de dois componentes**: piso de negócio (importa para alguém) **e**
   piso estatístico em erros padrão da própria estimativa. É o que faz o mesmo
   limiar valer nos 60 recortes sem recalibrar em 600 lugares.
3. **Ranking exige margem de 2 erros padrão sobre o segundo.** Exemplo real:
   Master 34,9% (n=749) e Membro do Club 33,5% (n=418) diferem 1,4 pp com margem
   de 2,9 pp — a tela **declara o empate** em vez de ordenar. Sem isso, o BI
   afirma "Master é quem mais retém" e o ranking vira a cada sync.
4. **Limiar em migration**, nunca em tabela editável em runtime — é a porta por
   onde a régua afrouxa na semana em que o bloco ficou vazio.
5. **Zero literal numérico nos gabaritos.** A régua viaja como parâmetro,
   emitida pela mesma função que calcula o número. Teste reprova gabarito que
   contenha dígito.

### Decisão de design que preciso confirmar

O CLAUDE.md fixa `.brand-card` (navy) em **um por tela**. Proponho que o resumo
passe a ser esse um, e os `ChartCard tone="brand"` percam o navy. Motivo: o
lugar mais nobre da tela deve ser o que direciona, não o gráfico que alguém
achou bonito — hoje o destaque navy de Soluções gasta esse lugar para dizer
"37,9% em Vendas", que é tamanho de catálogo, não demanda.

---

## 3. Arquitetura do resumo — motor determinístico, sem LLM no caminho

Três desenhos foram avaliados por um painel de três lentes (veracidade,
utilidade de direcionamento, operação e custo). **Recomendo o motor
determinístico em SQL, sem modelo de linguagem no caminho de renderização.**

Razões, em ordem de peso:

- É o único desenho em que **nenhuma frase não revisada por humano chega ao
  leitor**. Blindar o dígito e deixar a afirmação livre não cumpre a régua da
  casa: *"hands-on retém menos **porque** não tem acompanhamento"* passa por
  qualquer validador de número, é mecanismo inventado, e chega com autoridade
  tipográfica de BI.
- Zero fornecedor externo, zero chave, zero custo, **zero domínio novo de
  falha** — num projeto cujo pipeline já morreu duas vezes por allow list de IP.
- Custo marginal de recorte novo é **zero**. Os ~60 recortes por tela × 10 telas
  não custam nada porque nada é pré-computado (pré-computar os ~800 combos ×
  48 syncs/dia é o que mata qualquer desenho de "gerar resumo no cron").
- O texto é **testável**: instantâneo por recorte no CI barra regressão de
  redação como barra regressão de código.

O que ele não faz, e digo agora em vez de ser desmascarado no primeiro mês:
**não costura achados entre si nem cruza telas**, e o texto tem cara de
gabarito. Se depois de algumas semanas isso incomodar, existe um caminho
desenhado (fase 6, opcional): modelo **offline**, rodado por script do
repositório, redigindo por **forma** do achado — sem acesso a dígito, com portão
que reprova qualquer numeral, e com o gabarito determinístico como piso. Não é
pré-requisito de nada.

**Descartado explicitamente:** modelo no caminho de renderização; limiar
editável em runtime; Edge Function na fase 1 (`supabase/functions/` não existe
no repositório, e uma função lá ficaria fora de `lint`, `test` e `build` — a
peça mais nova seria a única que nenhum dos três comandos cobre).

---

## 4. O que o `via_hub` revela — e por que ele ainda não é fonte

> **Decisão do Mateus (11/08/2026):** o universo de análise do BI continua sendo
> **o cliente da plataforma** — quem está em `profiles` sob a régua `e_cliente`.
> O `via_hub` está **em construção**, sendo populado para virar o identificador
> único de cliente entre os produtos da casa. **Não é fonte publicável hoje**, e
> a Entrega 9 não será reconstruída sobre ele agora.
>
> A régua não muda para nenhum dos outros módulos: eles já contam clientes da
> plataforma, e continuam assim.

Por que a decisão está certa, em número **[conferido]**: dos 15.002 perfis da
plataforma, **apenas 6.956 (46,4%) têm `id_via`**. Do lado do hub, 1.235 dos
1.613 identificadores (76,6%) encontram um perfil, e 1.465 das 1.856 compras
pagas (78,9%) têm cliente correspondente.

Construir LTV por safra sobre isso seria construir sobre fundação em movimento:
**cada número histórico mudaria sozinho conforme o hub é populado** — a mesma
armadilha do `e_cliente` calculado sobre o papel atual (§9.3), que faz as safras
se reescreverem a cada migração administrativa. Repetir o erro numa tela de
receita seria pior, porque é o número que o CEO leva para fora.

### Critério objetivo de quando o hub vira fonte

Para não virar decisão de sensação, proponho três condições verificáveis, todas
mensuráveis por consulta:

1. Cobertura de `id_via` em `profiles` estável acima de um piso que você definir
   (hoje 46,4%) — o piso é decisão sua, porque depende de até onde o hub
   pretende chegar.
2. Casamento compra → perfil acima de 90% (hoje 78,9%), ou a lacuna explicada
   (compras de quem nunca entrou na plataforma são um grupo legítimo, não erro).
3. Propagação de exclusão resolvida: o pipeline do hub registra hoje que
   **exclusões na origem não são propagadas**, o que infla receita em qualquer
   espelho.

Enquanto isso não fecha, o hub entra no BI como **dependência registrada com
data de checagem**, não como fonte.

## 4-bis. O que o levantamento mediu no hub (contexto, não número de tela)

**[conferido]** Existe no banco da plataforma um schema `via_hub` que ninguém
tinha aberto. `via_hub.shared_purchases` guarda **1.958 compras, R$ 32,48
milhões pagos, de 09/12/2025 até hoje (11/08/2026)**, em 6 gateways, com 1.613
identificadores de cliente distintos.

**[conferido]** Não é receita do grupo: `product_slug = 'plataforma-vdi'`
responde por **R$ 32,2 milhões** dos R$ 32,48 mi. É a nossa plataforma.

**[conferido]** Receita paga do nosso produto, mês a mês:

| Mês | Compras pagas | Pago (R$) | Reembolsado (R$) |
| --- | ---: | ---: | ---: |
| dez/25 | 218 | 2.279.186 | 31.524 |
| jan/26 | 147 | 4.076.735 | — |
| fev/26 | 204 | 5.118.540 | 117.420 |
| mar/26 | 369 | 9.506.453 | 149.550 |
| abr/26 | 215 | 2.561.654 | 306.318 |
| mai/26 | 194 | 2.174.439 | 164.837 |
| jun/26 | 177 | 2.147.017 | 54.579 |
| jul/26 | 235 | 3.321.093 | **1.146.624** |
| ago/26 (11 dias) | 53 | 1.013.453 | — |

Três leituras, nenhuma delas para publicar em tela ainda:

**4.1 — A tela de Receita não pode continuar como está.** Ela mostra R$ 626.535
e chama de receita. Sabemos agora que isso é **um gateway entre seis, e um
gateway morto** — na janela em que as fontes se sobrepõem, o hub registra outra
ordem de grandeza. Não dá para trocar o número (o hub não está pronto), mas
também não dá para deixar como está: a tela precisa **declarar a limitação**,
no mesmo padrão que /cs já usa. É a régua da casa — onde o dado não sustenta, a
tela declara.

**4.2 — O webhook não "quebrou": a empresa trocou de gateway.** **[conferido]**
hubla vai até 01/07/2026 (R$ 16,2 mi em 800 compras) e para; appmax segue vivo
até 10/08 (R$ 10,9 mi) e hotmart até 11/08 (R$ 1,9 mi). O `docs/reporte-
rastreamentos-quebrados.md` classificou isso como rastreamento morto. Era
migração comercial, e a série continua — em outro lugar.

**4.3 — Um sinal que vale uma pergunta, não um card.** **[conferido]** Das
compras de julho, **R$ 1,15 milhão consta como reembolsado — 34,5% do mês**,
contra 2,5% em junho. Duas ressalvas antes de qualquer conclusão: o corte é por
mês da compra, não do estorno; e com o hub em construção, comparação entre meses
pode refletir grau de preenchimento, não comportamento. **Não vira card** —
vira pergunta para quem opera o hub. Se se confirmar, é assunto de diretoria.

---

## 5. Fase 0 — ✅ entregue em 11/ago (commit `5add993`)

Executada com OK do Mateus. O que segue é o diagnóstico original, mantido como
registro, com o resultado de cada item. Três coisas apareceram durante a
execução e entraram junto:

| Achado durante a execução | O que era |
| --- | --- |
| **Dois cards em erro, em produção** | `bi_aha_moment` e `bi_churn_modulos` estouravam o timeout de 8s e devolviam 500 na tela de Clientes. Causa: CTE inline reavaliada dentro de cross join num caso, e função imutável rodando por evento (330.847) em vez de por par distinto (25.231) no outro. 4.470ms → 203ms e 4.337ms → 946ms |
| **`?? 0` era sistêmico, não pontual** | 36 KPIs em 9 telas, não só no CS. Todos corrigidos, mais 3 headlines de CS que publicavam "0 pessoas atenderam" sem carga |
| **A âncora barata custou caro** | `data_referencia()` num `WHERE` é avaliada por linha — 14.848 chamadas para descobrir uma data. Resolvido com `hoje as materialized`, e a armadilha está registrada no CLAUDE.md |

O diagnóstico original:

Não dá para construir camada de leitura sobre número errado: o resumo amplifica
o que estiver embaixo dele. **Nenhuma destas correções depende do FDW.**

### 5.1 — Erro de 20 pontos percentuais em tela **[conferido]**

O card "Frequência de uso" em `/clientes` mostra **37,2%** com o rótulo *"ativos
em mais de um dia"*. Medi a distribuição: de 3.347 clientes ativos em 30 dias,
**1.437 têm exatamente 1 dia** e 665 têm exatamente 2. A resposta correta para
esse rótulo é **57,1%**.

Causa em `src/features/clientes/clientes-page.tsx:107`: `faixa.startsWith('1')`
casa com a faixa `'1–2 dias'` inteira (2.102 clientes) e subtrai os 665 que
foram ativos em dois dias. O que está na tela é "mais de dois dias" com o rótulo
de "mais de um dia". Agrava: `'11–20 dias'` também começa com "1" — hoje só
funciona porque a RPC devolve ordenado. Correção: mover o corte para o banco.

### 5.2 — Percentual calculado no front sobre denominador não suprimido

`alemDeUmDia`, `multiModulo` e `ultimoModulo` derivam de contagens, e contagem
nunca é suprimida. Num recorte estreito a tela imprime percentual sobre
denominador abaixo de 30 — contornando a régua que acabamos de construir.
Migram para o banco.

### 5.3 — Janelas ancoradas em `now()` em vez do watermark

Com o dado congelado em 08/08 e `now()` em 11/08, os KPIs da Visão Geral
comparam 27 dias contra 30 e a lista de risco engorda sozinha a cada dia parado.
É o defeito "Pageviews +313,3%" em outra roupa. As RPCs passam a ancorar no
watermark, e o delta some quando o dado está defasado.

### 5.4 — Texto que contradiz o próprio gráfico

A descrição do card de duração ideal afirma que "a barra de 60+ min sobe" quando
ela é a menor da série; o "89,5% da base concluem" está escrito à mão no código
da página, calculado sem a régua `e_cliente`; os KPIs de CS usam `?? 0` e
mostram "0 atendimentos" onde a verdade é "sem carga" — o `KpiCard` já tem
`motivoSemValor` para isso.

### 5.5 — Duas correções ao próprio levantamento

**A régua de pageview está CERTA e o levantamento errou. [conferido]** Ele
afirmou que pageviews começam em 10/07, não 03/07. `marts.fact_pageview` tem
**10.867 pageviews de 777 usuários já em 03/07**, com volume contínuo. O que o
levantamento mediu foi a origem: `public.analytics` hoje só tem `view` a partir
de 10/07 — **porque a plataforma apagou o resto**.

Isso vira o achado mais importante sobre o pipeline: **[conferido]** o cron
`cleanup-analytics-views` (`DELETE ... WHERE event_type='view' AND created_at <
now() - 30 days`, domingos às 03:00) já rodou e levou 03–09/07 embora. **Nosso
mart é hoje a única cópia sobrevivente desses sete dias.** O BI deixou de ser
consumidor e virou arquivo.

Estado atual dos crons de purga na plataforma **[conferido]**:

| Job | Agenda | Ativo | O que apaga |
| --- | --- | :---: | --- |
| `cleanup-analytics-views` | dom 03:00 | **não** | navegação com mais de 30 dias |
| `cleanup-notifications-weekly` | dom 03:00 | **sim** | notificações |
| `cleanup-old-notifications-weekly` | dom 03:00 | **sim** | notificações |
| `cleanup-data-retention-weekly` | dom 04:00 | não | `audit_logs` com mais de 30 dias |

Leitura: a purga de navegação está desligada **hoje** — não há relógio correndo
esta semana, mas está a um clique de alguém de voltar, e aí some tudo que não
tivermos espelhado. A purga de **notificações está ativa e roda todo domingo**:
esse histórico está sendo perdido agora, o que torna o espelho de `notifications`
urgente e não desejável.

---

## 6. Plano por módulo

Ordenado por valor de decisão. Formato: o que **sai**, o que **fica com
correção**, o que **entra**.

### 6.1 Clientes & Retenção — prioridade 1

**Sai:** "Dias ativos por cliente" (média sobre distribuição em que 1.437 de
3.347 têm exatamente 1 dia — descreve ninguém) · "Power users" (devolve os 3.347
ativos ordenados, sem critério de corte: é a base reordenada) · "Onde a jornada
termina" na forma atual (59% em Formações mede popularidade do módulo, não
mortalidade — vira taxa ou não vira nada).

**Fica com correção:** Frequência de uso (§5.1) · Retenção por cohort (a melhor
engenharia do produto, mas a diagonal está contaminada por evento novo:
`solution_viewed` desde abr/26, `consultor_ia_message` desde mai/26 — aviso em
texto não conserta número) · Momento aha (a descrição promete filtro de
cobertura de rastreio que **não existe no SQL**) · Autópsia de churn (o headline
de 34,9 pp no Consultor é artefato de calendário; o achado sustentado é Soluções,
14,0 pp) · Lista de risco (ancorada em `now()`).

**Entra:** cohort em **duas réguas** (comparável × com tudo), para separar
cliente melhor de instrumentação nova · **"entrou e não usou"** (quem logou sem
gerar evento — hoje somado a quem nunca apareceu, populações opostas) ·
**silêncio antes da desativação** · lista de risco com **score de
recuperabilidade** (quem dá para salvar, não quem já morreu) · retenção por
amplitude **controlada por volume de uso** (amplitude é causa ou é a mesma
variável medida duas vezes?).

**Retenção por papel ganha o recorte que faltava.** O card entregue na Fase A
mostra Master 34,9% · Membro do Club 33,5% · Hands-on 18,3%, e os números estão
certos — mas a leitura natural ("três personas") erra o alvo. **[conferido]**
Com o modelo de domínio correto (o master user é quem comprou e é dono da org;
os demais entram por convite dele), o corte estrutural é outro:

| Grupo | Clientes | Retenção |
| --- | ---: | ---: |
| Comprador (dono de organização) | 909 | **36,9%** |
| Convidado / membro | 2.925 | **18,9%** |

Uma diferença de 18 pontos, com uma história só: **o produto retém quem paga e
perde quem foi convidado.** Papel isolado embaralha os dois grupos —
445 `membro_club` são donos de organização e 223 `master_user` não são.

O card passa a liderar por esse corte, com papel como segunda camada. E ele
deixa de ser um card de Clientes para virar **a leitura central do produto**:
casa com o efeito master de Organizações (52,5% × 14,1% de time ativo) e com o
funil de assentos (só 37,6% dos convidados entram). São três telas medindo a
mesma coisa sem saber.

### 6.2 Visão Geral — prioridade 2

**Sai:** "Ações na plataforma" na forma atual (soma `solution_viewed`, 21.820
visualizações, com `mentorship_booked`, 11 agendamentos de custo real — ordenar
por contagem garante que o evento mais barato sempre vence) · "Telas mais
acessadas" por volume (empate técnico nas três primeiras).

**Entra:** janela ancorada no watermark · **penetração** no lugar de contagem
(3.347 ativos são 23,3% dos 14.373 — três em cada quatro clientes pagos não
apareceram no mês) · **composição do crescimento** (novos × reativados ×
retidos: crescer 1,6% comprando 1.564 clientes novos é o oposto de crescer 1,6%
retendo) · **saúde do rastreio** · ações por módulo separando consumo de
compromisso · heatmap em small multiples por papel (fecha o item 8 da auditoria,
que nunca teve trava).

**Achado de topo que ninguém está vendo:** o consumo de Soluções superou o de
Formações (21.820 × 20.883 em 30 dias) e a tela ainda trata "aulas concluídas"
como o KPI da casa.

### 6.3 Soluções — prioridade 3

**Sai:** "Candidatas a remoção" (o corte é o quartil inferior, então sempre
devolve ~40 nomes e **não consegue dizer "nada a remover"**; os outros motivos
do CASE nunca disparam) · "A tela de Soluções está boa?" como funil (etapas 3 e
4 não são subconjunto de 1 e 2) · "Uso por categoria" como destaque (mede tamanho
de catálogo).

**Entra:** conversão **por safra de abertura** (caiu de 9,4% em maio para 1,4%
em agosto enquanto as aberturas subiram de 7,6k para 13,8k/mês — a tela nova
traz mais gente e converte 3,7× menos) · **qualidade da conclusão** (mediana de
42 min, p25 de 5 min, `completion_percentage` binário: concluir é implementar ou
clicar?) · **ajuste ao cliente** (setor declarado no onboarding × categoria) ·
**concentração de fornecedor** (Lovable é pré-requisito de 134 de 161 soluções)
· **intenção parada** (3.393 favoritos, 2,9% com conclusão — a fila de
reativação mais barata do produto).

**Contexto obrigatório:** quatro rastreios do miolo da implementação morreram na
mesma janela (23/06–03/07). Hoje não existe **nenhuma** observação do que
acontece dentro de uma solução — só as pontas.

### 6.4 Organizações — prioridade 4

**Sai:** "Ocupação de assentos" (o card de destaque anuncia "75% em Sem limite
definido" — a maior fatia é a categoria "não sei": `team_limit` é nulo em 76%
das orgs) · **"Créditos de mentoria parados"** — está sobre areia: o campo é
**contador mensal zerado por cron todo dia 1**, não estoque vitalício. O card
publica um número que não significa o que diz.

**Fica com correção:** Efeito master (52,5% × 14,1%, o melhor card comparativo
do produto — mas as orgs com master parado são as maiores, então precisa quebrar
por faixa de tamanho antes de virar programa de CS) · KPI "time ativo" (média
simples por org dá 33%; ponderado por pessoa é 24,6% — o CEO lê "1 em 3" quando
é 1 em 4).

**Entra:** funil de assentos completo (550 masters pediram 4.874 assentos, 93,5%
aprovados em mediana de 8,9h, e **só 37,6% entraram** — o gargalo não é a
operação, é o convidado) · **implantação de contrato grande** (um lote de 2.047
convites em 4 orgs ativou 35 pessoas, 1,7%: uma implantação enterprise inteira
que não desceu, invisível em toda tela) · churn contratual · efeito co-master
antes×depois.

**Enquadramento que falta:** 91% dos clientes estão dentro de uma organização.
**B2B não é um segmento do BI, é o produto.**

### 6.5 Entrada & Crescimento — prioridade 5

**Sai:** KPI "conversão convite → cadastro 36,0%" (número errado por censura à
direita: convites de 60–90 dias atrás fecharam em 66,4%, e a mesma tela mostra
"conversão dos convites de masters: 65,9%" duas abas adiante — dois números de
conversão de convite na mesma tela, sem uma palavra) · "89,5% da base concluem"
(escrito à mão no código; o correto sob a régua é 92,5%).

**Entra:** **"nunca agiu"** com lista nominal (2.850 de 8.911 clientes que
entraram entre 30 e 180 dias atrás — 32% — nunca geraram um evento; hoje é a
maior barra do gráfico, desenhada na última posição como se fosse cauda) ·
anatomia do convite (papel `trial` converte 22,2%, `membro_club` 86,1%) ·
cadência de reenvio (mediana de 1,9h entre criar e usar; o follow-up de 6 dias
chega depois da festa) · **erro por taxa, não por volume** (/convite tem 9,5
erros de JS por 100 pageviews, 5× a média, exatamente onde aterrissam os
convites) · sinal do dia zero (quem declarou prazo "intensive" iniciou solução
em 67,3% contra 25,3% de "slow" — 42 pontos, e o campo parou de ser coletado).

**Correção de rótulo:** 74% dos onboardings incompletos estão na etapa 0 — eles
**não abandonaram, nunca começaram**. É problema de ativação, não de desenho de
etapas.

### 6.6 Formações — prioridade 6

**Sai:** KPI de NPS (instrumento morto desde 29/07, substituído por estrelas — o
KPI vai zerar sozinho quando a janela passar, sem explicar por quê) · "Assuntos
mais assistidos" (3 categorias, uma com 95,1%).

**Fica com correção:** **duração ideal de aula** — as RPCs filtram aula
publicada mas nunca o **curso** publicado: 172 aulas publicadas vivem em 11
cursos não publicados, e são elas que formam as faixas longas. Recalculando
sobre aberturas reais, a queda é 75,5% → 60,4%, não 74,7% → 36,3%. **São
decisões editoriais opostas** — e este é o card que mais influenciou decisão de
conteúdo até hoje.

**Entra:** **abriu × concluiu** (27,4% das aulas abertas são abandonadas e o BI
conta zero delas) · **denominador elegível** (hands_on vê 52 dos 59 cursos,
`formacao` vê 17 — hoje toda taxa divide pela base inteira, e "só 8% fizeram"
pode ser "80% de quem podia") · certificado plausível (25,9% emitidos em menos
tempo que a duração do vídeo) · **formação → implementação** (15,2% de quem tem
certificado concluiu uma solução contra 6,4% de quem não tem — o cruzamento mais
forte do banco, em nenhuma tela).

### 6.7 Consultor & Builder — prioridade 7

**Sai:** "Modos do Consultor" como destaque (duas barras em 8 colunas) ·
"confiabilidade por etapa" na forma atual (erro máximo de 0,25%: o card gasta
seu número principal para dizer que nada acontece).

**Entra:** **custo real** — `llm_input_tokens` não é o prompt (mediana de 43
tokens); o custo está no jsonb, com **1,64 bilhão de tokens de criação de cache**
contra 392 milhões de leitura. Erro de ordem de grandeza em qualquer KPI de
custo, e ~95% em cache que quase não é lido · **custo por solução do Builder**
(6,5 mil tokens em março → 192,6 mil em agosto: ~29× em cinco meses, e o mart
jogou as colunas de token fora) · **recomendação e conversão** (`consultor_journey`
tem 17,6 mil recomendações; **33% começam a solução indicada em 7 dias**, altíssimo
para qualquer canal) · **ponte Consultor→Builder** (149 clientes receberam o
handoff, 79% geraram solução, 105 em 24h — a maior conversão medida no domínio).

**Achado operacional:** 81,3% das threads de planejamento morrem na primeira
mensagem, contra 1,8% no chat. Não é volume, é a primeira resposta.

### 6.8 Jornada & Telas — prioridade 8

**Sai:** KPI "duração mediana 0,5 min" (32% das sessões têm uma tela só e valem
0 por construção; o leitor conclui que o produto não prende ninguém, e a
conclusão é sobre a instrumentação) · "telas por sessão 7,0" (mediana é 3, p95 é
22) · "onde a sessão morre" por contagem — **a RPC já calcula a taxa e a UI
descarta**.

**Entra:** **tela de saída** (onde a pessoa parou antes de sumir — /dashboard é
a última tela de 1.535 clientes, 78,6% sumidos; /implement/{id}/0 é terminal de
405 com 97% sumidos) · **de onde vem** (`fact_pageview.referrer` existe e
**nenhuma RPC lê** — a pergunta literal da Entrega 8 nunca foi respondida) ·
erro × tela × abandono (hoje tela que trava e tela que entedia são
indistinguíveis) · rotina por perfil.

**Ressalva:** o ranking mistura rota viva com rota extinta (`/solutions`,
`/learning` aparecem com 91–97% de abandono porque a rota morreu). Sem filtrar,
a tela acusa a página errada.

### 6.9 Receita & Renovação — congelada e declarada, aguardando o hub

**Continua em prioridade baixa, e agora por um motivo escrito** (§4): a fonte
consolidada está em construção e o BI não constrói tela sobre fundação em
movimento.

O trabalho desta fase é pequeno e é de honestidade, não de análise:

- **Declarar a limitação na própria tela** — que a série cobre um gateway que
  parou em jul/2026, que não é a receita do produto, e que a consolidação está
  sendo construída. Bloco no padrão de /cs, acima dos cards.
- **Encerrar a série em 02/04/2026** (último pagamento aprovado na fonte atual),
  no mesmo padrão já usado para os pageviews — em vez de deixar a curva morrer
  sozinha e parecer queda de vendas.
- **Não construir LTV por safra agora.** Com 46% dos perfis sem `id_via`, cada
  safra mudaria conforme o hub é populado.

**Fechar com "não dá" fundamentado:** engajamento pré-renovação exige data de
renovação, que existe para 6% das empresas. Não sustenta — encerrar em vez de
esperar o FDW.

**Gatilho de retomada:** os três critérios de §4. Quando fecharem, a Entrega 9 é
refeita inteira sobre o hub — e aí ela vira prioridade alta, porque destrava
LTV, funil pagamento→entrada e margem por cliente de uma vez.

### 6.10 CS (Pulse) — bloqueado, com uma correção que não depende da carga

Os quatro KPIs usam `?? 0` e exibem "0 atendimentos" onde a verdade é "sem
carga". Quando a carga entrar, o primeiro número a publicar é a **taxa de
reversão e o R$ recuperado**: `fact_cs_cancelamento` já carrega valor
contratado, pago, reembolso e multa, e **nenhuma das 14 RPCs lê qualquer um dos
quatro** — estamos contando churn em cartões numa tela que tem os reais ao lado.

---

## 7. Módulos novos

### 7.1 Mentoria — prioridade alta

**É o único organismo vivo do produto sem nenhuma tela.** 10.361 inscrições de
2.361 clientes, ~1.900/mês, dado fresco, e as rotas de mentoria somam 12.084
pageviews — a 2ª área mais navegada da plataforma. O BI toca no assunto por um
card lateral em Organizações, e esse card está errado (§6.4).

O gradiente é o mais forte e mais limpo do banco, com todas as faixas acima de
30: **40,4%** de retenção para quem só se inscreveu (n=250) · 50,6% com 1
presença (n=619) · 60,9% com 2–3 (n=233) · 68,8% com 4–6 (n=93) · **89,3% com 7+
(n=84)**.

Responde ainda: por que 1.090 clientes foram a exatamente uma mentoria e
pararam; onde vazam as 1.892 pessoas que fizeram check-in e nunca entraram na
sala; e por que quem se inscreve com antecedência falta mais (44,6% de presença)
do que quem decide na hora (73,1%).

**Achado operacional que não precisa de análise para virar decisão:** o WhatsApp
de mentoria falha **100% das vezes há 8 meses** — 21.152 tentativas, zero
entregues. (Do levantamento; conferir antes de reportar ao time.)

### 7.2 Comunicação & Notificação — prioridade média-alta

547 mil notificações, 14.873 usuários, nenhuma tela — **e a purga roda todo
domingo [conferido]**, então este histórico está sendo perdido agora.

Responde: **disparo em massa acorda dormente?** Medido: não — a reativação nos 7
dias após três disparos (3,63% · 3,78% · 4,16%) foi **menor** que em três dias
sem disparo (3,92% · 4,03% · 4,52%). E qual notificação merece existir:
"certificado disponível" tem 31,7% de leitura em mediana de 2,1h; "curso novo"
tem **3,1% em 329 mil disparos**. Notificação que reage ao cliente é lida 10×
mais que notificação que anuncia a empresa — dá para cortar 91% do volume sem
perder engajamento.

### 7.3 Planos & Pacotes — prioridade média

`plan_features` revela que o produto **só passou a ter plano de verdade agora**:
na v1 os três planos têm acesso total às 5 features (starter, pro e enterprise
são indistinguíveis); na v2 aparece a primeira trava, e já há 881 clientes nela.
A pergunta — **a trava do v2 converte ou expulsa?** — é a decisão comercial mais
cara que este mapeamento permite responder, e ninguém está olhando.
Confundidor obrigatório: as orgs v2 são mais novas, então só comparação pareada
por safra.

### 7.4 Destaques executivos — cai de graça da arquitetura

Se o achado é objeto calculado, ele ordena; se ordena por tela, ordena entre
telas. Uma página que reúne os achados mais fortes das 10 telas dá ao CEO uma
tela em vez de dez. Custo marginal próximo de zero depois da fase 1.

### 7.5 Saúde do rastreio — bloco, não tela

Tipo de evento × última data com registro, watermark do ETL, cobertura por
fonte. Existem hoje **pelo menos 12 rastreios mortos** e nenhuma tela reporta.
É pré-requisito da régua: sem ele, uma série que atravessa uma data de morte de
instrumentação vira "queda de comportamento".

### Fora de escopo, com motivo declarado

Comunidade (105 tópicos em 14 meses, morta desde mai/26, 10 pageviews em 32
dias) · Networking (6.018 matches com campos de interação 100% nulos e **zero
pageviews** na rota) · Indicação (rastreio morto desde mar/26 e o laço nunca
fechou) · Campanhas de lead (o desfecho comercial mora no Pipedrive) ·
Traduções (não há como saber quem usa outro idioma). Cada um vira **uma linha no
bloco de saúde do rastreio**, com data de óbito — registrar por que não existe é
parte da entrega.

---

## 8. Sequência de fases

| Fase | Entrega | Depende do FDW? |
| --- | --- | :---: |
| ~~**0**~~ | ~~Correções de veracidade (§5)~~ — **✅ entregue 11/ago** | não |
| ~~**1**~~ | ~~Motor de achados + anatomia, em 2 telas piloto~~ — **✅ entregue 11/ago** (`39455f8`) | não |
| **2** | Escada aplicada + formas novas de gráfico, nas 8 telas com dado local | não |
| **3** | Novos marts, na ordem: `notifications` → `auth.users` → mentoria → `audit_logs` → elegibilidade → IA | **sim** |
| **4** | Módulos novos: Mentoria → Comunicação → Planos & Pacotes | parte |
| **5** | CS (Pulse) | credencial |
| **6** | Redação por forma, com modelo offline — **opcional** | não |
| **último** | Saúde do projeto de código (fonte externa) | não |

Ordem das formas novas de gráfico, por retorno sobre esforço: **faixa de
referência** (muda a leitura de "quanto" para "quanto comparado a quê", esforço
baixo) → **distribuição com mediana e p90** → **micro-gráfico em célula** →
**ênfase** (destacar um, recuar o resto — bloqueado por token: não existe cinza
de de-ênfase que funcione nos dois temas) → matriz, empilhada 100%, funil.

**Dependência técnica que atravessa três formas:** o `TimeSeriesChart` usa eixo
x categórico, o que impede ancorar anotação numa data e desenhar trecho parcial.
Migrar para eixo temporal **uma vez, cedo**.

**Decisão de arquitetura a tomar cedo:** `marts.master_snapshot` faz upsert por
master, então nem a plataforma nem o BI guardam ontem. Trocar para **append
diário** é a única forma de existir série de estado de direito — e o histórico
começa do zero no dia em que ligar. Quanto mais tarde, mais tarde ele serve.

---

## 9. Riscos que precisam de dono

1. ~~**Privacidade.**~~ **Resolvido em 11/ago** — o Mateus autorizou espelhar
   tudo que sirva a análise registrada, e o contrato está no CLAUDE.md com as
   quatro disciplinas (chave no lugar do valor onde basta distinguir; conteúdo
   livre só sob demanda de análise; exclusão propaga; lista nominal atrás de
   `private.is_admin()`). **Duas obrigações concretas que nascem daí:** o
   expurgo propagado precisa de teste em todo mart novo — hoje só `dim_usuario`
   tem o mecanismo, e ele não roda desde 08/08 — e o papel de administrador
   precisa existir antes de o time ganhar conta, porque hoje as 2 contas do BI
   são iguais e veem tudo.
2. **O pipeline falha em silêncio.** ~150 falhas por tabela desde 08/08 e o cron
   segue rodando. `fact_pedido_implementacao` tem **53 execuções e 0 sucessos
   desde que foi criado** — nunca sincronizou, e o levantamento tratou "0 linhas"
   como característica do dado. Precisa de alerta de frescor por tabela.
3. **Régua de negócio ambígua.** Três definições de inativo, duas de master,
   churn 60 vs 90 dias. E o mais grave: **`e_cliente` é calculado sobre o papel
   atual**, e a plataforma migrou 5.222 pessoas de freemium→hands_on em lote —
   ou seja, **as safras históricas se reescrevem sozinhas a cada migração
   administrativa**. Precisa de decisão explícita: papel na época ou papel atual.
4. **Não existe experimentação na plataforma.** Nenhuma tabela de flag, variante
   ou bucket. Todo achado diagnóstico vai permanecer associação — ou o BI para
   de prometer causa, ou entra no plano a capacidade de experimentar, que é
   trabalho de plataforma.
5. **Comparações múltiplas.** 138 perguntas × 60 recortes garantem achados
   falsos. A régua de amostra mínima cobre denominador pequeno, não intervalo de
   confiança nem confundidor. Precisa de régua de inferência escrita.
6. **Existe uma esteira de dados que o BI não conhece.** Nove crons
   `bi_pull_club_*` rodam dentro da plataforma a cada 10 minutos empurrando
   tabelas para fora, com 100% de sucesso, enquanto o nosso FDW está parado há
   três dias. Vale mapear a topologia antes de insistir no caminho atual.

---

## 10. Decisões que preciso do Mateus

| # | Decisão | Recomendação |
| --- | --- | --- |
| 1 | Arquitetura do resumo | Motor determinístico em SQL, sem modelo no caminho. Fase 6 opcional |
| 2 | Posição do bloco | Topo, largura total, fora das abas — e ele passa a ser o `.brand-card` da tela |
| 3 | Régua de composição da escada | ≥2 comparativos, ≥2 diagnósticos, ≥1 prescritivo, ≤3 descritivos, verificado no CI |
| 4 | Fase 0 antes de tudo | Sim — corrigir os números errados antes de construir a camada que os amplifica |
| 5 | Receita sobre `via_hub` | **Não agora** — hub em construção (46% dos perfis sem `id_via`). Nesta fase, só declarar a limitação e encerrar a série. Retomar pelos critérios de §4 |
| 6 | Módulos novos | Mentoria · Comunicação & Notificação · Planos & Pacotes · Destaques executivos |
| 7 | Encerrar 4 itens da auditoria como "sem lastro" | Sim — funil de entrega de convite, tempo por etapa do onboarding, teto de tokens e limite do Builder nunca tiveram dado |
| 8 | ~~Contrato de PII e papel-na-época~~ | **Decididos em 11/ago.** Espelhar tudo que sirva a análise registrada, com as quatro disciplinas do CLAUDE.md · recorte usa o papel atual · e entra a dimensão comprador × convidado |

Aguardo OK por fase. Nada começa antes.
