# Densidade e hierarquia das telas — diagnóstico e plano

**Origem:** queixa do CEO em 19/ago/2026, em duas partes.

> "Está muito poluído. Em todas as telas, todos os dados exibidos são realmente o necessário?
> Além disso, está na ordem de mais importante em cima e menos importante embaixo?"

**Estado (19/ago, 15h):** a **Parte II inteira, a Fase A e o `ErrorBoundary` estão implementados** —
escopo confirmado com o Mateus. Cinco commits, `lint`/`test` (285)/`build` limpos.

| bloco | estado |
| --- | --- |
| Os 4 defeitos de exatidão (+1 achado no caminho) | ✅ feito |
| Os 3 "defeitos de dado achados de passagem" | ✅ feito |
| Fase A — `AbaDeDados` fechada, sem `nivel` | ✅ feito |
| Pacote "uma tarde" (7 itens) | ✅ feito |
| `ErrorBoundary` de rota | ✅ feito |
| Fase B — `densidade.ts`, régua de ordem e catraca | ✅ feito |
| Fase C — 7 das 10 telas na régua | 🟡 parcial |
| **Verificação de navegador** | ⛔ **bloqueada** — ver abaixo |
| Rail rotulado (208px) | ⏸ segurado, por decisão: sobe junto com a faxina |

**Placar da Fase C:** prosa de seção de **12.430 para 9.773 caracteres** (média 289 → 257),
seções de **43 para 38**, e sete telas cumprindo os cinco limites e as duas regras de ordem —
seis por medição e duas por exceção declarada com motivo escrito. **Nenhum card foi cortado e
nenhum número mudou nesta fase**: o que caiu foi peso de leitura.

**As três que faltam precisam de DECISÃO, não de edição:**

- `clientes` — 10 cards (teto 9) e 6 seções (teto 5). Entrar exige CORTAR um card, e a auditoria
  original provou 6 cortes no produto inteiro sem deixar a lista de quais. É decisão de produto.
- `cs` — 12 cards, 6 seções e **zero `nivel=` declarado**: está fora da escada, então nem a régua
  de ordem nem o piso de descritivo podem ser avaliados nela.
- `receita` — mesmo caso de CS quanto ao `nivel`, mais três seções de um card.

⛔ **A verificação de navegador continua sem ser feita, e ela é a régua que fecha a queixa
original.** O `npm run dev` sobe e responde 200, mas a extensão do Chrome não está conectada nesta
sessão e o projeto não tem Playwright nem Puppeteer. É a mesma fraqueza declarada no topo deste
documento, agora com mais superfície para cobrir. O que precisa de olho está listado em
"O que falta olhar", no fim.

---

## A resposta curta

**Quase nada precisa sair da tela. O que precisa é parar de ser desenhado com o mesmo peso.**

Dez auditores independentes leram uma tela cada, todos com mandato explícito de cortar e com o
ônus da prova sobre quem corta. Somados, recomendaram cortar **6 blocos de 208** — 3 KPIs e 3
cards. Quatro telas não acharam um único card para cortar. Seis auditores escreveram, com
palavras próprias, alguma variação de "a camada de análise desta tela está limpa".

O CEO está certo sobre o sintoma e a causa não são os cards.

---

## O que foi medido, e o que não foi

Medido: as dez telas de produto, bloco a bloco, no fonte e no banco — 12 agentes na auditoria de
densidade e ordem, mais conferência manual em SQL dos números citados.

⚠️ **Não medido: a tela renderizada.** Nenhuma linha deste documento saiu de olhar o produto no
navegador. O que se verifica estaticamente é contagem, duplicata de número, ordem no DOM e regra
de composição. Equilíbrio visual, respiro e peso — que é literalmente o que "poluído" descreve —
só se julga vendo. **Esta é a maior fraqueza do documento e ela é conhecida.**

⚠️ **O rail rotulado NÃO é a causa da queixa.** Os commits `6425599` e `457b964` (19/ago) levaram
o rail de 68px para 208px, mas **não foram empurrados** — a Vercel serve `ee9d5f9`, com o rail só
de ícone. O CEO reclamou do que está no ar. Isso não absolve a mudança: quando ela subir, os
gráficos perdem 140px de largura (−8,7% a 1720px), o que **piora** a densidade percebida. Decidir
as duas coisas juntas.

---

## O diagnóstico

### 1. O produto tem uma catraca de mão única

Contagem de cards de conteúdo em cada commit de cada página, desde o primeiro:

```
visão geral    4 4 4 4 4 4 4 4 4 4 4 7 7 7 7 7 7 7 7 7
clientes       3 4 4 4 4 9 9 9 10 10 10 10 10 10 10 10 10 10
entrada        3 3 3 6 6 6 6 6 8 8 8 8
organizações   1 1 1 1 4 4 4 4 7 7 7
formações      3 3 3 6 6 6 6 6 8 8 8 8 8
soluções       1 1 1 1 1 1 1 5 5 5 5 5 5 7 7 7 7
IA             3 3 3 5 5 5 5 5 8 8 8 8
jornada        3 3 3 3 5 5 5 5 5 8 8 8 8 8
receita        2 2 2 5 5 5 5 5 5
CS            13 13 13 13 12 12 12 12 12   ← a única queda do projeto
```

**Em 130 commits, a contagem caiu uma vez.** Nove das dez telas nunca perderam um card. Cada fase
somou; nenhuma fase teve a pergunta "o que sai?".

E a régua existente empurra no mesmo sentido: `escada.ts` exige **no mínimo** 2 comparativos, 2
diagnósticos e 1 prescritivo, e limita descritivos a 3 — mínimos que sobem, teto que só vale para
um dos quatro degraus, e **nenhum teto de total**. Um produto que só acumula fica poluído por
construção, não por descuido.

> Consequência para o plano: uma faxina única não resolve. Sem um passo que remove, seis meses
> depois estamos aqui de novo.

### 2. A camada de dados é 42% do produto e nunca entrou em nenhuma conta

| | blocos |
| --- | ---: |
| KPIs (4 × 10 telas) | 40 |
| Cards de conteúdo | 80 |
| **Tabelas da `AbaDeDados`** | **88** |
| **Total renderizado** | **208** |

`AbaDeDados` desenha **cada fonte como um `TabelaCard` completo** — ícone, headline, descrição,
busca, paginação — e **nenhuma página a envolve em `Collapsible`** (zero ocorrências em
`src/features/`). São 5 a 12 tabelas sempre abertas no fim de toda aba `Gráficos`.

Por tela: visão geral 6 · clientes 12 · entrada 10 · organizações 8 · formações 9 · soluções 8 ·
IA 9 · jornada 9 · receita 5 · CS 12.

**Em clientes e CS a camada de auditoria tem mais blocos que a análise inteira** (12 contra 10, e
12 contra 12).

⚠️ **E ela declara `nivel="descritivo"` fixo dentro de `aba-de-dados.tsx:63`**, enquanto
`escada.test.ts` só varre `../features/**/*-page.tsx`. As páginas declaram 19 descritivos; o DOM
entrega **107**. O teto da régua é 3 por tela; o renderizado é 10,7 em média. **As oito telas que
passam na régua a violam de 2,7× a 4,7× naquilo que o navegador desenha.** A régua não está
errada — está lendo o arquivo errado.

### 3. A fileira de KPI é uma segunda consulta sobre o mesmo fato

Nove das dez telas têm RPC dedicada `bi_*_kpis`, separada das RPCs dos cards. Em nove delas, ao
menos um KPI republica número que um card abaixo também publica. Onde as duas contas divergem, a
tela se contradiz sozinha.

O motor de achados tem contrato de CI exatamente contra isso — *"o calculador só lê `public.bi_*`
… é o que garante que o número da frase é O MESMO do card, e não uma segunda conta que pode
divergir"*. **A fileira de KPI é o único lugar onde essa regra nunca foi aplicada.**

### 4. Doze de 43 seções não agrupam nada

`SecaoDeAnalise` existe para dizer "estes três respondem a mesma coisa". Doze seções têm **um card
só** — um card com um segundo título e mais um parágrafo cinza por cima.

E a prosa é grande: **43 descrições de seção, 12.430 caracteres, média 289** (~3,6 linhas a 80ch),
máxima 460 — sempre visíveis, acima dos cards. O mesmo projeto já decidiu que régua de card sai do
caminho da leitura (`CardCabecalho` manda a `description` para dentro do botão de informação);
`SecaoDeAnalise` nasceu sem essa disciplina.

**Causa de segunda ordem:** as seções agrupam por **assunto**, e o que de fato separa os cards é a
**janela**. O seletor de período do topo alcança 3 de 12 hooks em clientes, 2 de 8 em soluções, 4
de 10 em entrada. **Dezenove das 43 descrições contêm uma cláusula explicando por que aqueles
cards não conversam entre si** ("não se somam", "o seletor acima não alcança esta seção").
Cabeçalho que justifica por que os próprios cards não se relacionam é diagnóstico de agrupamento
errado, e aparece em nove das dez telas.

### 5. A ordem é a inversa da que o CEO pediu — e ninguém a escolheu

Pico de `nivel` por seção, em ordem de documento: **em seis das oito telas com nível declarado, a
última seção é a que contém o único card prescritivo** — o único que diz o que fazer e sobre quem.
Em três (formações, IA, soluções) a primeira seção é puramente descritiva. Soluções é o caso
literal: descritivo → diagnóstico → comparativo → prescritivo, a escada percorrida de baixo para
cima.

A causa é banal, e é isso que a torna corrigível: `escada.ts` declara
`NIVEIS = ['descritivo', 'comparativo', 'diagnostico', 'prescritivo']` em ordem ascendente, e a
`REGUA` se lê como lista de cima para baixo. Quem monta uma tela para satisfazer aquela lista monta
na ordem da lista. **Uma regra de COMPOSIÇÃO virou, em silêncio, uma regra de SEQUÊNCIA.**

Ninguém decidiu terminar toda tela com a ação. Isso caiu da ordem de um array.

Exemplos do custo: quem abre `/clientes` quer saber quem ainda dá para segurar — a lista nominal é
o 7º card, atrás de seis gráficos. Quem abre `/solucoes` quer saber o que revisar — as candidatas
são o último card.

---

## O plano

### Fase A — uma mudança de componente que conserta as dez telas

Nenhum merge de página. Dois arquivos.

1. **`AbaDeDados` nasce fechada**, num `Collapsible` único: "As linhas que esta tela leu · N
   funções". Padrão que o projeto já adotou em `/plano` com `AcordeaoDeAchados`; `radix-ui` 1.6.7
   já está instalado. **Devolve 88 blocos de peso visual e não apaga um dígito.**
2. **Remover `nivel="descritivo"` de `aba-de-dados.tsx`.** A camada de auditoria não é degrau da
   escada de análise; declarar nível ali é o que faz a régua medir 19 onde o DOM entrega 107.

> Cinco das dez auditorias propuseram, isoladas, a mesma coisa por outras palavras. Nenhuma podia
> ver que era a mesma proposta.

### Fase B — as duas réguas que faltam

**`src/lib/densidade.ts`**, irmã da escada, verificada pelo mesmo mecanismo (`import.meta.glob` do
fonte). A escada responde "esta tela é rasa?"; esta responde "esta tela é lida?".

```ts
export const REGUA_DE_DENSIDADE = {
  cardsDeConteudoNoMaximo: 9,
  cardsPorSecaoNoMinimo: 2,
  secoesNoMaximo: 5,
  descritivosNoMinimo: 1,
  prosaDeSecaoNoMaximo: 240,
}
```

Cada número saiu de medição, não de convenção:

- **9 cards** — toda tela com ≤8 recebeu do próprio auditor um veredito de que a análise está
  limpa; as duas com ≥10 (clientes 10, CS 12) são as duas em que os auditores acharam desordem
  estrutural. É o primeiro inteiro acima da maior tela que ninguém reprovou.
- **2 cards por seção** — 12 das 43 seções têm um só. Dois é o menor grupo que existe.
- **5 seções** — distribuição medida: 3, 3, 3, 4, 4, 4, 5, 5, 6, 6. As duas com 6 (clientes, CS)
  são exatamente as duas cujos auditores propuseram fundir seções.
- **piso de 1 descritivo** — é a trava da catraca no sentido contrário. Somadas, as dez auditorias
  levariam o produto de 19 descritivos para ~11, e organizações a **zero**, sem nenhum teste
  reclamar. Tela sem descritivo não tem denominador visível fora do KPI — e "denominador ausente"
  é a queixa mais repetida das dez auditorias.
- **240 caracteres de prosa de seção** — 3 linhas a 80ch. O CLAUDE.md já rege a descrição de *card*
  em "uma ou duas linhas"; a seção ganha uma linha a mais e nada além. ⚠️ **34 das 43 excedem
  hoje** (79%).

**Régua de ordem**, duas asserções e uma obrigação:

1. A primeira seção da aba `Gráficos` não pode ser só descritiva. *(Morde formações, IA, soluções.)*
2. A última seção não pode ser a única que contém o prescritivo — **salvo exceção declarada no
   fonte, com o motivo escrito**, no padrão que o banco já usa em `comment on function`.
3. A ordem de leitura passa a ser: **o que fazer → por quê → comparado a quê → quanto → linhas
   cruas.**

A exceção é deliberada: em Visão Geral o prescritivo é "Saúde do rastreio", um meta-card que prova
todos os outros, e ali o último lugar é o certo. **O que a régua garante não é uma ordem única — é
que a ordem tenha sido escolhida.**

**Adoção como a escada:** lista `TELAS_NA_DENSIDADE` curta e explícita, crescendo por fase, com as
demais aparecendo no relatório com o placar atual, para a dívida ficar visível. ⚠️ Pela contagem
conferida, **só `organizacoes` passaria hoje** nos cinco limites — visão geral, soluções e jornada
têm seção de um card.

### Fase C — o que sobra por tela

Depois de A e B, sobram os 6 cortes que os auditores de fato provaram, mais as fusões de seção
órfã. É a menor parte do trabalho, e a única que exige tocar página por página.

---

## Defeitos de dado achados de passagem

Não são de densidade. São de correção, e valem migration própria.

1. ⚠️ **"Aulas concluídas" tem dois valores.** Mesma janela de 30 dias: **22.417** na Visão Geral,
   **22.510** em Formações — 93 aulas de diferença, mesmo rótulo, duas telas. Conferido em SQL:
   `bi_visao_geral_kpis` conta de `marts.fact_evento`, `bi_formacoes_kpis` conta de
   `marts.fact_progresso_aula`. As duas aplicam `e_cliente`; a divergência é de **fonte**. Como o
   CLAUDE.md registra rastreio quebrado em `fact_evento`, o valor de Formações é o de referência.
2. ⚠️ **Entrada se contradiz dentro da própria tela**: 4.496 × 4.477 convites, 39,17% × 38,91%,
   89,61% × 89,49% — porque `bi_entrada_kpis` não aplica a régua `e_cliente` que `bi_funil_entrada`
   aplica.
3. **Visão Geral chama duas coisas diferentes de "Novo"**: o KPI usa data de cadastro (1.793); o
   card "De onde veio o número de ativos" usa primeira ação de produto (1.312).

---

## Erros da própria auditoria, corrigidos aqui

Registrados porque a auditoria vale pelo que se pode conferir:

- A síntese contou **47 seções em 11 valores para 10 telas**. A contagem certa é **43**, conferida
  duas vezes por medição direta. Os números derivados dela foram recalculados.
- A síntese propôs `blocosDePrimeiraLeituraNoMaximo: 14`, que é aritmeticamente determinado pelos
  outros limites (4 KPIs fixos + 9 cards + 1 bloco de dados). Removido — régua que repete outra
  régua dá falsa sensação de cobertura.
- A síntese descartou "teto de números impressos" alegando que não é contável no fonte. **As
  colunas são contáveis**, e a crítica que apontou isso também errou os números e omitiu as duas
  piores telas. Contagem de `<TableHead` conferida por medição direta:

  | tela | colunas | cards |
  | --- | ---: | ---: |
  | visão geral | 5 | 7 |
  | CS | 12 | **12** |
  | receita | 14 | 5 |
  | clientes · entrada · IA | 17 | 10 · 8 · 8 |
  | jornada | 22 | 8 |
  | formações | 23 | 8 |
  | organizações | 29 | 7 |
  | **soluções** | **30** | 7 |

  ⚠️ **Os dois eixos apontam telas opostas, e isso muda o plano.** Pela contagem de cards, CS (12)
  e clientes (10) são as piores e soluções (7) está limpa. Pela contagem de números impressos,
  **soluções é a pior do produto** com 30 colunas — quatro vezes a visão geral — e CS é a terceira
  **melhor**. Uma tela com poucos cards e tabelas largas parece limpa em toda régua que conta
  blocos, e é exatamente o tipo de tela que o leitor descreve como poluída. A régua de densidade
  proposta **não mede este eixo**, e por isso ela sozinha não fecha a queixa do CEO.

---

## O que ficou de fora, e por quê

- **As abas `Análise` e `Plano`** das dez telas. A auditoria cobriu **1 das 3 abas de cada módulo**.
  ⚠️ E há um defeito conhecido ali: `AnaliseDaTela` trava em `MAXIMO_DE_ACHADOS = 3`, um por
  família, e `PlanoDaTela` **não trava nada** — o CLAUDE.md diz que o teto vale e o código diz que
  não.
- **`/plano`, `/regras` e `/design`** — três telas visíveis, uma delas no primeiro grupo do rail. O
  CEO disse "em todas as telas".
- **A verificação visual.** É o que fecharia a pergunta que originou tudo isto.

---

---

# Parte II — Design e usabilidade

Sete lentes independentes (gráficos, design system, usabilidade, 375px, acessibilidade,
consistência, carga), mais síntese e crítica adversarial: **88 achados, 24 de gravidade alta**.

**A crítica derrubou 3 achados** por contrariarem decisão já registrada no CLAUDE.md — inclusive
um que pedia trocar o `h2` do rail (decisão de hoje) por um `<p>`. Fica registrado porque é o que
dá crédito ao resto: a lista foi filtrada, não só coletada.

## A causa comum: o kit para na moldura

O kit é dono do quadro — card, cabeçalho, estados, mosaico — e **para exatamente na fronteira onde
a página encontra o dado**. O que vive nessa fronteira não tem tipo, não tem peça e não tem teste:
o que fazer com `null`, qual a escala da tinta, qual a altura do gráfico, qual rótulo mostrar, qual
frase de vazio. Cada página improvisa, e improviso × 10 telas é quase toda a lista.

A prova mais cara está abaixo. As outras seguem o mesmo formato: não existe peça de tinta de
intensidade, então há **quatro implementações com cinco tetos de valor** (1,0 · 0,5 · 0,3 · 0,25 ·
0,6) e três alfas máximos, nenhuma com legenda — a mesma tinta significa números diferentes por
tela e por coluna. Não existe altura no `ChartCard`, então ela está no `className` de ~20 gráficos.

E o inverso: **quando a peça existe mas não é obrigatória, ninguém a chama.** `labelRota`,
`periodoDaUrl`, as props `icone`/`trend` do `KpiCard` e o `aside` do `CabecalhoDeModulo` têm **zero
call sites** em tela de produto.

## ⚠️ Defeitos de exatidão — a tela publica número errado hoje

Isto não é poluição, é correção, e é mais urgente que tudo neste documento. **Os três conferidos
por mim, em SQL, contra o código:**

**1. Formações publica um precipício que não existe.** `bi_duracao_ideal()` devolve
`taxa_media = null` para "30–60 min" (amostra abaixo do piso). A página faz `value: d.taxa_media ??
0` (`formacoes-page.tsx:280`). O card de destaque navy desenha **77% → 74% → 69% → 63% → 0,0%**,
com o rótulo "0,0%" escrito na coluna. A leitura óbvia é "aula longa tem conclusão zero" — e a
descrição do mesmo card diz por escrito o contrário: *"a queda com a duração é real mas suave… o
precipício que esta tela mostrava vinha de 76 aulas em cursos não publicados"*. **O card refuta a
si mesmo, e o gráfico é a metade que o olho lê primeiro.**

⚠️ **E o teste que existe para pegar isto não pega.** `contrato-de-tela.test.ts:49` casa
`value=\{… ?? 0\}` — a forma de prop JSX. As cinco páginas usam `value: … ?? 0`, a forma de objeto,
dentro do mapper. Verde por acidente, exatamente como o `contrato-do-motor` já foi. Os outros
quatro sites (`formacoes:306`, `entrada:226`, `ia:305`, `jornada:410`) estão latentes e disparam
sozinhos quando um recorte estreitar a amostra.

**2. IA desenha partição onde há interseção.** `bi_ia_adocao(30)` devolve Consultor 1.217 · Builder
534 · **"Usam os dois" 375** — a terceira é um `INTERSECT`, subconjunto das duas primeiras,
desenhada como categoria irmã, mesma cor, mesma espessura. Quem soma para dimensionar o alcance
chega a 2.126. O alcance real é 1.217 + 534 − 375 = **1.376**. Erro de 54%.
*Conserto: virar partição no SQL — "Só Consultor" · "Só Builder" · "Os dois". Zero mudança na página.*

**3. Organizações põe "não sabemos" em corpo 30px no bloco de destaque.** `bi_orgs_ocupacao()`:
247 · 52 · 39 · 132 · **1.453 "Sem limite definido"**. O headline escolhe a maior contagem, então o
único `tone="brand"` da tela publica **"75,6% das orgs em Sem limite definido"**. E o eixo escala
até 1.453, espremendo as quatro faixas reais nos 17% iniciais — justamente a comparação que a
descrição manda fazer.

**4. CS: o gráfico desenha uma medida e o headline afirma outra.** O headline diz "15,6% sem humano
assumir"; o gráfico plota `so_ia` por desfecho (resolvido 28 · em aberto 66). O número do headline
não existe em nenhuma barra, e a leitura do gráfico é oposta à do texto.

## O que explica a sensação de "poluído"

Em ordem de força, e separado de propósito dos defeitos acima:

1. **A `AbaDeDados` sempre aberta** — já tratada na Parte I. As duas frentes chegaram nela por
   caminhos independentes.
2. **A tela se remonta enquanto é lida.** Zero `placeholderData` no projeto (conferido): trocar
   30→90 dias derruba os 12 cards de Clientes para esqueleto ao mesmo tempo, e como o esqueleto é
   menor que o conteúdo, a página salta. **"Poluído" tem um componente que não é tinta: é uma
   página que se remonta seis vezes em cinco segundos.**
3. **No celular a primeira dobra inteira é cromo.** `KpiGrid` só vira 2 colunas em 640px, então os
   4 tiles empilham em ~512px — antes deles, título, régua e controles.
4. **33 de 43 títulos de seção terminam em reticências a 375px.** ⚠️ E isto é o projeto se
   contradizendo: `secao-de-analise.tsx:49` usa `truncate`, enquanto `card-cabecalho.tsx:54` usa
   `line-clamp-2` **com um comentário explicando por quê** — *"título cortado é título que mente"*.
   A decisão certa está escrita num componente e invertida no irmão. Uma classe conserta.
5. **O eixo come o gráfico** em Jornada: rota crua de 31 caracteres leva ~37% da largura do card.
6. **Todo gráfico se redesenha a cada troca de aba** — o `key={ativa}` do `ModuloTabs` remonta o
   painel, e ir da `Análise` ao gráfico que a sustenta é o movimento central do produto.

## Regras da própria casa, violadas

- ⚠️ **Zero `:active` em todo o produto** (conferido). O CLAUDE.md exige: *"Todo controle tem os 3
  estados (`:hover`, `:active`, `:focus-visible`)"*.
- **O anel de foco não alcança 3:1 em nenhuma superfície do tema claro** — `rgba(10,31,59,0.35)`
  sobre branco dá 2,17:1, e `button.tsx` ainda o dilui com `/50`.
- **`disabled:opacity-50` no Button**, contra *"disabled muta por cor, não por opacity"*.
- **A régua de todo card mora num `Tooltip` do Radix, que não abre no toque.** São 79 réguas de card
  inertes no celular. Três lentes independentes chegaram nesse tooltip por caminhos diferentes — é
  o sinal mais forte de que o quadrante "toque" nunca foi testado. Trocar por `Popover`: um arquivo.

## Uma lacuna que nenhuma lente cobriu

⚠️ **Não existe `ErrorBoundary` em lugar nenhum** (conferido: zero ocorrências de
`ErrorBoundary`/`componentDidCatch`/`errorElement`). Um `throw` em qualquer uma das dez páginas
derruba o app inteiro para tela branca, sem recuperação e sem mensagem. O produto trata com esmero
o erro de *card* (`isError`, `onRetry`, esqueleto, vazio) e não trata o erro de *tela*.

## Uma tarde × obra grande

**Uma tarde, e vale para as dez telas de uma vez** (um arquivo cada):
`placeholderData: keepPreviousData` + `staleTime` alinhado ao cron de 30 min · `Tooltip` → `Popover`
no `CardCabecalho` · `truncate` → `line-clamp-2` na seção · tirar o `sm:` do `grid-cols-2` do
`KpiGrid` · `--ring` sólido · acrescentar `active:` · `scope="col"` no `TableHead` · barra `sticky`
no mobile · `AbaDeDados` em acordeão fechado.

**Obra grande:** `CategoryDatum.value: number | null` com supressão declarada no card (mais ampliar
a regex do teste de contrato) · altura do gráfico como prop do `ChartCard` · peça única de tinta de
intensidade com teto obrigatório e legenda · widget de abas conforme (roving tabindex) ·
alternativa textual dos gráficos · `ErrorBoundary` de rota.

---

## Decisões que precisam do Mateus antes de virar código

1. **Os quatro defeitos de exatidão saem na frente de tudo?** São número errado publicado hoje, não
   densidade. O de Formações está num card de destaque e se contradiz com a própria descrição.
2. Fase A isolada, agora, ou o pacote inteiro por fase?
3. O piso de 1 descritivo **proíbe** o corte de "Ocupação de assentos" em Organizações, que estava
   bem provado (1.453 de 1.923 contas sem `team_limit`, headline publicando 75,6% de dado ausente).
   Manter o piso e recusar o corte, ou trocar o piso por "pelo menos um denominador visível"?
   ⚠️ Note que este card aparece nas duas frentes: a de densidade quer cortá-lo, a de design quer
   consertá-lo. **Consertar resolve as duas** — tirando o balde de desconhecido do eixo, o card
   passa a responder a pergunta que a descrição promete.
4. Empurrar o rail rotulado antes ou depois desta faxina? Ele custa 140px de largura de gráfico.
5. `ErrorBoundary` de rota entra nesta rodada? Hoje um `throw` em qualquer tela dá tela branca no
   produto que o CEO está validando.

---

## O que falta olhar (19/ago)

Checklist de verificação visual, em 1280px e 375px, nos dois temas. Cada item é uma mudança que
passou no CI e **não** foi vista.

**Exatidão**

1. `/formacoes` · "Duração de aula que maximiza conclusão" — a faixa "30–60 min (2 aulas)" deve
   aparecer no eixo **sem barra**, e a linha de supressão abaixo do gráfico deve dizer o motivo.
   ⚠️ É o único ponto do dia em que dependo de comportamento não documentado do Recharts: barra com
   `value: null` deveria não desenhar retângulo. Se desenhar um toco, a nota está certa e a barra
   precisa de tratamento à parte.
2. `/ia` · "Adoção entre clientes ativos" — três barras (Só Consultor · Os dois · Só Builder),
   headline "1.430 de 3.687 clientes ativos usam alguma IA". Tooltip da 1ª barra traz "Consultor ao
   todo: 1.227".
3. `/organizacoes` · "Ocupação de assentos" — quatro faixas, sem "Sem limite definido"; headline
   "52,6% das orgs com limite em Menos de 50%".
4. `/cs` · "A IA resolveu sozinha?" — headline "30,9% dos ciclos sem humano terminaram resolvidos".
5. `/design` — o card novo "Valor suprimido pela régua" exercita o estado; é a tela mais barata
   para conferir o item 1.

**Densidade e usabilidade**

6. Fim da aba `Gráficos` de qualquer módulo: a camada de dados fechada, com "N funções · M linhas"
   legível, e a animação de abrir **sem salto** (o fallback do `var()` das keyframes é a parte não
   vista).
7. Trocar o período de 30 → 90: os cards devem ESMAECER, não virar esqueleto, e a página não pode
   saltar. Vale conferir também que o texto da aba `Análise` VAI a esqueleto — ali o opt-out é
   proposital.
8. Foco por teclado (Tab) em botão, aba e item do rail: o anel deve ser visível nas quatro
   superfícies dos dois temas.
9. Régua de card no toque: o botão de informação agora abre por clique (Popover). Conferir no
   celular, que é o quadrante que nunca foi testado.
10. 375px: KPIs em duas colunas na primeira dobra, títulos de seção em duas linhas em vez de
    reticências, e a barra fixa ao rolar.
11. Erro de tela: forçar um `throw` numa página e confirmar que a barra e o rail continuam de pé, e
    que navegar para outro módulo limpa o estado.