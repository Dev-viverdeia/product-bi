# Roadmap do Product BI

Consolidado em 2026-08-06 a partir do briefing do Mateus + análises de valor
focadas no cliente (aprovadas por ele). Este documento é a fonte da verdade do
escopo — nenhum módulo começa sem estar aqui, e a ordem só muda com OK dele.

**Princípio norteador: foco no cliente.** Cada entrega responde perguntas de
decisão (o que proteger, o que empurrar, o que mudar, o que remover) — não é
coleção de gráficos.

## Método de execução de uma entrega

1. **Contrato de métricas primeiro**: definições exatas (o que conta, janelas,
   exclusões) registradas na seção da entrega e confirmadas pelo Mateus — antes
   de qualquer código.
2. Dados: marts/RPCs em migrations, advisors zerados, sync incremental.
3. UI: só com o kit de gráficos; peça visual nova passa pelo `/design` antes.
4. Verificação: light + dark, 1280px + 375px, console limpo, lint/build.
5. **Pronto quando**: toda pergunta da tabela da entrega tem resposta visível na
   tela, com as definições do contrato — e o Mateus deu o OK olhando o módulo.

## Status geral

| Entrega | Status |
| --- | --- |
| 0. Fundação (pipeline FDW, marts, kit de gráficos, DS) | ✅ Entregue |
| 1. Visão Geral (ativos, picos, telas, ações) | ✅ Entregue |
| 2a. Clientes & Retenção — descritiva | ✅ Entregue |
| 2b. Clientes & Retenção — acionável (risco, aha, churn) | ✅ Entregue |
| 3. Entrada & Crescimento | ✅ Entregue |
| 4. Formações | ✅ Entregue |
| 5. Soluções | ✅ Entregue |
| 6. Consultor & Builder | ✅ Entregue |
| 7. Organizações (B2B) | ✅ Entregue |
| 8. Jornada & Telas (profundidade) | ✅ Entregue |
| 9. Receita & Renovação | ✅ Entregue |
| 10. Saúde da plataforma (backend/banco/cyber) | ⏸️ Adiada por decisão do Mateus — só depois do BI |
| CS — dashboard executivo (2ª fonte: Pulse) | ✅ **No ar em 12/ago**: **9 marts carregados (95.781 linhas)**, sync a cada 30 min, tela lendo dado real. Falta a escada de profundidade e as pendências do Mateus |

### Auditoria roadmap × tela (11/ago/2026)

O ✅ acima significa "módulo no ar" — não "toda pergunta respondida". A
auditoria de 11/ago conferiu cada uma das 35 análises das entregas 2–9, mais o
recorte transversal, contra o código e o banco: **9 não têm resposta em tela
nenhuma**. Ficam registradas aqui até cada linha virar entrega.

| # | Onde | Pergunta do roadmap | Realidade na tela | Trava |
| --- | --- | --- | --- | --- |
| 1 | Transversal | recorte por persona/plano nas métricas centrais (obrigatório) | ✅ fase A entregue: `SegmentoFiltro` (`?papel=`/`?plano=`) em Visão Geral e Clientes | faltam as fases B e C (Entrada, Formações, Soluções · IA, Jornada, Receita, Organizações) |
| 2 | E3 | funil de entrada com "entregue" e "aberto" | funil no ar tem 4 etapas; faltam as 2 de e-mail | rastreio de entrega parou na plataforma em abr/2026 |
| 3 | E3 | onboarding: `time_per_step` e pontos de abandono | só a etapa atual de cada cliente | nenhuma — `plataforma.onboarding_final` é foreign table e o FDW está de pé |
| 4 | E4 | NPS × retenção/conclusão | só o ranking de NPS por aula | a coleta na origem: `learning_lesson_nps` parou em 29/07 (ver item H) |
| 5 | E5 | pedidos de implementação paga | mart carregado com as 114 linhas; falta a tela | nenhuma |
| 6 | E6 | Consultor: tokens vs limite | não existe | nenhuma — `plataforma.consultor_ia_token_usage` é foreign table |
| 7 | E6 | Builder: limite mensal atingido | não existe | nenhuma — `builder_v2_step_generations` e `builder_v3_task_progress` são foreign tables |
| 8 | E8 | rotina de uso por perfil | heatmap é global, sem recorte | nenhuma |
| 9 | E9 | engajamento pré-renovação | não existe — `renewal_logs` nem é foreign table | importar `renewal_logs` (o FDW está de pé; ninguém importou a tabela) |

Os itens 5 e 9 são as pendências 3 e 4 da auditoria de 08/ago, vistas do lado
do roadmap; o 5 fechou quando o pipeline voltou. **Com o FDW de pé desde
12/ago, a coluna "Trava" perdeu o motivo comum**: sobram travas de origem (o
NPS do item 4 parou de ser coletado) e de import (o `renewal_logs` do item 9).
O item 1 foi entregue na fase A do recorte persona/plano — `SegmentoFiltro`
está no ar em Visão Geral e Clientes.

Matéria-prima já mapeada que nenhuma tela consome: `invite_deliveries` e
`invite_delivery_events` (item 2), `onboarding_final` (item 3 e o
enriquecimento de setor/objetivo do recorte transversal),
`consultor_ia_token_usage` (item 6), `builder_v2_step_generations` e
`builder_v3_task_progress` (item 7).

## Entrega 2 — Clientes & Retenção ⭐ espinha dorsal

Dividida em duas metades com OK do Mateus entre elas (2a é pré-requisito de 2b).
**As definições fixadas aqui (ativo, retido, risco, churn) são reutilizadas por
todas as entregas seguintes** — E4/E6/E7/E9 referenciam retenção.

### 2a — Descritiva

| Análise | Pergunta que responde |
| --- | --- |
| Retenção por cohort | de quem entrou em cada mês, quantos seguem ativos após 7d/30d/90d/180d? |
| Stickiness & hábito | DAU/MAU, dias ativos/mês, % de clientes com hábito semanal |
| Amplitude multi-módulo | clientes que usam mais módulos retêm mais? |
| Power users | top clientes por engajamento (cases, depoimentos, beta) |

### 2b — Acionável / preditiva

| Análise | Pergunta que responde |
| --- | --- |
| Clientes em risco (lista nominal) | quem era ativo e parou? quem tem plano vencendo sem uso? |
| Momento "aha" | qual ação na 1ª semana mais prediz retenção? |
| Autópsia de churn | o que quem saiu tinha em comum (módulos nunca usados, onde parou)? |

### Contrato de métricas (proposta — confirmar antes de codar)

| Métrica | Definição proposta |
| --- | --- |
| Ativo (dia) | cliente (`e_cliente`) com ≥1 evento de domínio no dia |
| Retido em Xd | ativo em algum dia na janela [X, X+30d) após a entrada |
| Em risco | ativo nos 60d anteriores, zero atividade nos últimos 14d |
| Churn comportamental | 60d corridos sem nenhuma atividade |
| Janela do "aha" | ações nos primeiros 7d → retenção medida em 90d |

⚠️ Régua de dados: análises de retenção/cohort usam **somente `fact_evento`**
(histórico estável desde mai/2025). Pageviews (jul/2026+) entram só em métricas
de navegação — nunca em curva de retenção, para não contaminar com o degrau de
instrumentação.

Fontes: `dim_usuario`, `fact_evento`, `master_user_snapshots` (expiração de plano).

## Entrega 3 — Entrada & Crescimento

| Análise | Pergunta que responde |
| --- | --- |
| Funil de entrada completo | convite → entregue → aberto → cadastro → onboarding → 1ª ação de valor |
| Problemas na porta | erros de login (`auth_error_telemetry`) e de tela (`client_error_logs`) no funil |
| Tempo até o primeiro valor | cadastro → 1ª ação significativa, por segmento |
| Masters que convidam × não convidam | quantos masters convidam? conversão dos convites por master |
| Onboarding: onde abandonam | `time_per_step` e `abandonment_points` do onboarding_final |

Fontes: `invites`, `invite_deliveries/_events`, `onboarding_final`, `auth_error_telemetry`, `client_error_logs`, `audit_logs`.

## Entrega 4 — Formações

| Análise | Pergunta que responde |
| --- | --- |
| Uso por formação | quais formações estão sendo usadas (e quais não) |
| Jornada do aluno | quando entra, tempo médio até concluir, onde para |
| **Duração ideal de aula** | qual duração maximiza conclusão (duração × taxa de conclusão) |
| Assuntos mais assistidos | por categoria de curso (tags estão vazias na plataforma) |
| NPS × comportamento | aulas bem avaliadas seguram o aluno? conclusão pós-NPS |

Fontes: `learning_*`, `course_durations`, `video_transcripts` (fase 2 de assuntos).

## Entrega 5 — Soluções

| Análise | Pergunta que responde |
| --- | --- |
| Ranking de acesso e implementação | mais vistas, mais iniciadas, mais concluídas |
| **Candidatas a remoção** | sem acesso + sem implementação + nota baixa |
| Funil início→conclusão | hoje 4,8% concluem — onde travam (abas de implementação)? |
| Qualidade | ratings, favoritos, pedidos de implementação paga |
| A tela de Soluções está boa? | uso da tela (pageviews, chegada/saída, tempo) vs conversão em início de solução — base objetiva para decidir mudanças de design |

Fontes: `solutions`, `progress`, `implementation_tab_progress`, `solution_ratings/favorites`, `fact_pageview` (telas de solução).

## Entrega 6 — Consultor & Builder

| Análise | Pergunta que responde |
| --- | --- |
| Adoção e recorrência | quantos clientes usam, com que frequência, retenção de uso |
| Consultor | threads/mensagens por usuário, tokens vs limite, modos usados |
| Builder | gerações, taxa de sucesso/erro, evolução de soluções, limite mensal atingido |
| Impacto | quem usa Consultor/Builder retém mais que quem não usa? |

Fontes: `consultor_*`, `ai_generated_solutions`, `ai_solution_usage`, `builder_*`.

## Entrega 7 — Organizações (B2B)

| Análise | Pergunta que responde |
| --- | --- |
| Saúde por org | % do time ativo, assentos usados vs `team_limit`, tendência |
| Efeito master | org com master engajado retém o time melhor? |
| Valor contratado não consumido | créditos de mentoria parados, pool sem uso — churn silencioso |

Fontes: `organizations`, `master_user_snapshots`, `mentorship_credits/_transactions`, `dim_usuario`.

## Entrega 8 — Jornada & Telas (profundidade)

**Propósito (ponto nº 1 do briefing):** sustentar decisão de mudança de tela com
dados — "se vamos mudar uma tela: por quê? o design está funcionando? como está
o uso?". Antes de qualquer redesign na plataforma, o raio-x da tela sai daqui.

| Análise | Pergunta que responde |
| --- | --- |
| Raio-x por tela | uso ao longo do tempo, quem usa, de onde vem/para onde vai (referrer) — o "antes" de qualquer redesign |
| Fluxos de navegação | rotas de entrada, sequências mais comuns, onde a sessão morre |
| Rotina do usuário | padrão de uso por perfil (dia, hora, sequência) |

Fontes: `fact_pageview` (com referrer). ⚠️ pageviews desde jul/2026 — histórico cresce com o tempo.
Nota: clique-em-elemento (nível botão) exigiria instrumentação nova na plataforma — decidir só quando chegarmos aqui.

## Entrega 9 — Receita & Renovação

| Análise | Pergunta que responde |
| --- | --- |
| LTV por cohort/segmento | receita real (Hubla) por safra e perfil |
| Engajamento pré-renovação | uso nos 60d antes da renovação prevê o resultado? |
| Uso vs receita | quem paga mais usa mais? (a plataforma já esboça em `bi_uso_vs_consumo`) |

Fontes: `hubla_webhooks` (+espelhar), `renewal_logs`, views `bi_receita_hubla`/`bi_ltv_cohort` como especificação.

## Transversal — Segmentação (entra em todas as entregas)

O `onboarding_final` guarda setor, tamanho de empresa, objetivo principal e
experiência com IA de ~15k clientes — dado subutilizado. A partir da Entrega 2:

- `dim_usuario` é enriquecida com esses campos (setor, objetivo, experiência IA);
- **recorte por persona/plano é obrigatório** nas métricas centrais de cada
  módulo (master × hands_on × individual; plano) — "quem extrai valor do quê"
  é pergunta permanente, não análise avulsa;
- recorte por setor/objetivo entra onde fizer sentido analítico.

### Contrato do recorte persona/plano (proposta 11/ago — confirmar antes de codar)

| Item | Definição proposta |
| --- | --- |
| Papel | `hands_on` · `master_user` · `membro_club` — 99,2% dos 14.373 clientes. Os 7 papéis restantes (99 clientes) não viram opção de filtro: recorte que nasce suprimido não é oferta, e o "todos" já os inclui |
| Plano | `starter` · `pro` · `enterprise` · sem plano (867 clientes — grupo real, não erro de dado) |
| Fonte | `marts.dim_usuario` (`papel`, `plano`), sempre sob `e_cliente` |
| Semântica | recorte pelo papel/plano **atual** (a dim não guarda histórico): "retenção dos hands_on" lê "de quem hoje é hands_on". Papel na época do evento exigiria snapshot histórico — fora deste contrato. **Decisão do Mateus (11/ago): fica o papel atual**, porque papel é tipo de contrato comprado (estrutural), não estágio de ciclo de vida; a ressalva das migrações em lote é declarada na tela |
| **Comprador × convidado** | terceira dimensão, acrescentada em 11/ago: `is_master` separa quem **comprou** (dono da organização, 2.064 pessoas) de quem entrou pelo convite dele. É o recorte que mais explica retenção — mais que papel — e não se confunde com ele (445 `membro_club` são donos; 223 `master_user` não são) |
| Unidade | o filtro restringe o **conjunto de clientes**; eventos, pageviews e progresso contam só os desses clientes |
| Supressão | percentual, taxa e mediana só com denominador ≥ 30 na janela filtrada; abaixo disso a tela mostra a contagem absoluta e declara que a amostra não sustenta percentual. Contagem nunca é suprimida. Delta exige ≥ 30 nos dois períodos |
| UI | filtro global ao lado do período, na URL (`?papel=` e `?plano=`), combináveis entre si. Some nas telas de grão empresa (CS); em Organizações entra só onde a métrica é de pessoa |
| RPCs | parâmetros `p_papel`/`p_plano` (`text default null`, null = todos), aplicados no join com a dim dentro da função |

Rollout por fases, cada uma com OK do Mateus: **A** componente de filtro +
Visão Geral + Clientes & Retenção, mais uma peça nova em /clientes — retenção
por papel lado a lado, a resposta direta de "62% no agregado pode ser 80% no
master e 55% no hands_on" · **B** Entrada, Formações, Soluções · **C** IA,
Jornada (fecha o item 8 da auditoria), Receita e Organizações onde couber.

Amostras medidas em 11/ago (ativos nos 30 dias até 08/08, total 3.471):
hands_on 2.552 · master_user 739 · membro_club 169 · outros 11; pro 1.945 ·
enterprise 756 · starter 610 · sem plano 160. Papel × plano combinados podem
cair abaixo de 30 — a supressão é parte do contrato, não enfeite.

## Fase 2 — Profundidade e direcionamento (em desenho, 11/ago/2026)

Pedido do Mateus: o BI não pode ser "uma plataforma que exibe cards com
gráficos". Precisa ser completo, bem explicado, direcionar decisão — e cada
tela passa a ter **os gráficos e um resumo com o direcionamento**. As análises
atuais estão rasas e precisam ficar profundas. Pré-requisito declarado por ele:
mapear **todo** o banco do produto, entendendo bem.

### Decisões já tomadas (não reabrir sem ele)

| Decisão | O que fica valendo |
| --- | --- |
| **Público do resumo** | Os dois: o CEO precisa **conseguir decidir** lendo, e o time de produto precisa **saber como seguir**. Um achado, dois níveis de leitura — a frase de cima é executiva (número + régua, sem jargão), a linha de baixo é a ação e o link para o card que prova |
| **Profundidade é verificável** | Escada de 4 níveis (descritivo → comparativo → diagnóstico → prescritivo). Tela só é dada por pronta com 2+ cards diagnósticos e uma saída prescritiva. "Profundo" deixa de ser gosto |
| **O achado é calculado, não redigido** | A detecção roda determinística, com a mesma régua de supressão das RPCs. Texto sem número calculado por trás não entra na tela — a regra "nunca mostrar número errado" vale para a frase como vale para o gráfico |
| **Resumo pode não ter o que dizer** | Sem achado relevante, o bloco declara "nada fora do padrão no período". Resumo que sempre acha algo vira ruído e queima a credibilidade da tela |
| **Saúde do projeto de código** | Módulo desejado, e é o **último** da fila. Fonte de dado é externa (repositório, CI, deploy, advisors) — não sai do banco do produto, então é integração nova, não recorte do que já existe. Não confundir com a Entrega 10 (saúde da plataforma: backend/banco/cyber) |
| **Universo de análise** | **O cliente da plataforma** — quem está em `profiles` sob a régua `e_cliente`. O `via_hub` está sendo populado para virar o identificador único entre os produtos da casa e **não é fonte publicável enquanto isso**. Nenhuma tela passa a contar gente que não está na plataforma |
| **Dado espelhável** | **Tudo que a plataforma e o Pulse têm, desde que sirva a uma análise registrada.** O limite é a existência da pergunta, não a natureza do dado. Contrato com as quatro disciplinas no CLAUDE.md — a que mais pesa é que **exclusão na origem propaga para o mart**, com teste |

### Fase 0 ✅ entregue em 11/ago

Correção de veracidade, com OK do Mateus. Frequência de uso publicava 37,2%
onde a resposta é 57,8%; a duração ideal de aula media curso não publicado e o
precipício que sustentava a recomendação editorial era artefato disso; o NPS
era o único número de Formações fora da régua `e_cliente`; toda janela ancorava
em `now()` com o pipeline parado. Fora do escopo previsto, apareceram e foram
corrigidos: dois cards de Clientes devolvendo 500 por timeout, e o `?? 0` em 36
KPIs de 9 telas. Teste de fonte impede a volta das duas classes de defeito.

### Fase 1 ✅ entregue em 11/ago

Bloco "Resumo e direcionamento" no topo de Visão Geral e Clientes, fora das
abas, como card navy da tela. Motor determinístico: catálogo de gabaritos em
`insights.regra`, calculador lendo só as funções `bi_*` que os cards leem,
supressão declarada, âncora para o card que prova, página `/regras`. Cache por
`(tela, período, recorte, data do dado)` — 2,5s viraram 5ms.

Três correções durante a execução: score normalizado por múltiplo do próprio
limiar (sem isso a ordem dos achados saía do acaso da escala), o cache (sem ele
o bloco estourava o timeout) e a policy do catálogo, que faltando fez a RPC
devolver zero linha em silêncio — a armadilha que este documento já registrava.

### Fase 2 — em andamento (primeira leva entregue em 11/ago)

**Entregue:** a escada de profundidade virou trava de CI — todo card declara o
degrau, e o teste conta a composição da tela contra a régua. O kit ganhou faixa
de referência e de-ênfase (`--data-referencia`, `--data-mute`), e a dívida do
`--data-ink` fechou. **A Visão Geral subiu a escada:** saíram os dois cards que
mediam errado, entraram quatro que respondem outra coisa — quem apareceu contra
a base, de onde veio o número de ativos, uso raso × profundo, e a saúde do
rastreio.

**Clientes & Retenção também subiu.** Entrou o corte comprador × convidado
(38,9% × 19,4%), "Onde a jornada termina" virou taxa sobre a audiência de cada
módulo em vez de contagem, e Power users saiu.

**Segunda leva, 12/ago: a análise em aba chegou às oito telas restantes.** Cada
uma abre num documento escrito e guarda os gráficos na aba ao lado. Vinte e oito
regras novas no catálogo — 5 em Entrada, 4 em Formações, 2 em Soluções, 4 em IA,
3 em Organizações, 4 em Jornada, 4 em Receita e 2 em Clientes. Nenhuma suprimida
na carga de 08/ago. CS ficou de fora a pedido do Mateus, que tem pendências nela.

Quatro regras propostas foram recusadas, três pelo mesmo motivo — publicariam
número que não existe em card nenhum. `org_time_morto` lia a RPC com limite de
cem mil enquanto o card chama com vinte e cinco; `sol_aba_pulada` lia coluna
inexistente; `sol_catalogo_sem_morto` tinha o score invertido e sairia rotulada
"atenção" dizendo que está tudo bem. `cli_gap_papel` foi **aposentada**, não
recusada: media pelo tipo de contrato o que `cli_comprador` mede pela régua
certa, e ocupava a mesma família.

Três correções vieram junto, todas do mesmo princípio — a regra só publica o que
a tela mostra:

- `marts.v_saude_organizacao` ancorava a janela de 30 dias em `now()`. Com o
  pipeline atrasado, a organização parecia esvaziar sem nada ter mudado no
  cliente. Passou para `data_referencia()`, e o número que faltava apareceu:
  **960 de 2.101 organizações sem uma única pessoa ativa**.
- O card "Onde a sessão morre" desenhava só contagem absoluta — que segue o
  tráfego da tela e não distingue a tela que resolve da que trava. Passou a
  desenhar a taxa, a mesma que o achado publica e das mesmas dez linhas da RPC,
  declarando que a régua é outra que a da coluna "% saída" do raio-x.
- `AnaliseDaTela` deixou `periodo` e `recorte` opcionais: Receita e Organizações
  não têm esses controles e o cabeçalho afirmava um escopo que a tela não
  oferece.

**Entrada subiu a escada (12/ago).** Tinha quatro cards descritivos, um
diagnóstico e nenhum comparativo. Saíram duas perguntas rasas e entraram três
que o dado sustenta:

- **Quem comprou age; quem foi convidado, não.** Na porta, 34,9% dos convidados
  nunca fizeram nada, contra 10,7% dos compradores — safra fechada, todos com a
  mesma janela. É a mesma fratura que Clientes mede na retenção, agora visível
  onde ela nasce.
- **Quem não termina o onboarding não volta:** 0,9% de atividade recente contra
  17,1% de quem terminou. Três pessoas em 343. O card declara que a ordem causal
  não sai dali — quem já ia sumir também não terminou.
- **O convite é aceito na hora ou não é aceito:** mediana de 1,9 hora entre criar
  e aceitar, e 41,7% nunca aceitos. O card declara o que não consegue separar —
  convite nunca aceito pode nunca ter sido enviado, porque o rastreamento de
  envio da plataforma parou em 19/abr/2026.

Duas hipóteses foram medidas e **reprovadas**, e ficam registradas na migration
para ninguém tentar de novo: conversão por canal do convite (a diferença
agregada entre email e "both" é efeito de mistura — mês a mês as taxas se
cruzam) e "o convite de quem está ativo converte mais" (dá o contrário, e por
pouco).

**Formações subiu a escada (12/ago).** Tinha três descritivos, dois diagnósticos
e nenhum comparativo. Entraram os dois que o dado sustenta, cada um publicando a
própria margem — diferença sem margem não é comparação, e tabela lado a lado
convida a ler qualquer gap como real:

- **O certificado prende, ou só marca quem já estava preso?** 36,5% de quem
  certificou agiu no último mês, contra 17,9% de quem estudou e não terminou.
  Margem de 2,8 pp. Os dois lados já estudaram, de propósito: sem esse recorte a
  conta viraria "quem usa o produto × quem não usa".
- **Quem começa pela primeira aula termina mais:** 43,2% certificam contra 33,7%
  de quem entra no meio da grade. Margem de 1,9 pp.

Duas hipóteses medidas e **reprovadas**, registradas na migration:

- *"Grade longa entrega menos certificado"* (59,0% até 10 aulas × 36,0% acima).
  Parece forte e não é: **um curso sozinho responde por 59,4% dos alunos da faixa
  longa** — a faixa é aquele curso disfarçado de faixa. E as faixas se sobrepõem:
  o pior curso curto certifica 31,2%, o melhor longo 63,5%.
- *"Maratonar prejudica"* (36,2% × 33,8%). Diferença de 2,4 pontos contra margem
  de 4,5 — dentro do ruído. Vale saber: a maratona não aparece como problema.

**Defeito encontrado pela sonda de navegador, corrigido nos cinco lugares:**
`headline={formatInt((x.data ?? []).length)}` publicava **"0 formações com aluno
no período"** enquanto a consulta estava no ar. É o `?? 0` do KPI com outra
roupa — o esqueleto do card cobre o corpo, não o headline. Virou trava de CI.

**Soluções subiu a escada (12/ago).** A tela mostra 4,9% de conclusão; antes de
tratar isso como problema era preciso saber se concluir importa. Importa:

- **Concluir solução importa?** 42,8% de quem concluiu alguma segue ativo, contra
  25,4% de quem só iniciou. Margem de 4,5 pp. Os dois lados já iniciaram, de
  propósito.
- **A primeira tentativa é a que mais termina:** 8,3% na primeira solução contra
  6,0% da segunda em diante — e os dois grupos são **as mesmas 3.168 pessoas**,
  o que tira de cena a diferença entre clientes. Contraria a hipótese da curva de
  aprendizado: iniciar solução virou hábito barato, e fechar não acompanhou.

Quatro hipóteses medidas e **reprovadas**, todas na migration:

- *Dificuldade explica a conclusão.* Não: `medium` 7,0%, `easy` 6,3%, `advanced`
  5,2%. A distância entre as pontas é de 1,0 pp contra margem de 1,1 — e o topo é
  "medium", então nem a direção se sustenta.
- *Favoritar prediz concluir* (10,9% × 6,2%). Passa raspando, mas favoritar é
  ação de 1,1% da base: recomendação sobre quase ninguém.
- *Nota alta entrega conclusão.* Vem invertida **e sobre unidade errada** — 13
  soluções contra 22, tratadas como 18 mil tentativas independentes. Mesmo erro
  da "grade longa" em Formações.
- *Concluir aba prediz concluir solução.* Circular por construção: só 0,15% das
  soluções são concluídas sem passar pela aba `tools`. A aba não prediz o
  desfecho — ela faz parte dele.

**Consultor & Builder subiu a escada (12/ago).** Faltavam um comparativo, um
diagnóstico e o prescritivo — a tela não tinha nenhuma lista de ação:

- **A porta de entrada muda se o cliente volta.** Quem estreia no modo
  `planejamento` volta em 36,1%; quem estreia no `chat`, 47,8%. Margem de 6,6 pp.
  Lê a PRIMEIRA conversa de cada pessoa: usar todas mediria a preferência de quem
  já ficou. O card declara o que não separa — quem entra para montar um plano
  pode ter resolvido de primeira.
- **Onde a conversa para:** 15,1% das conversas param na 1ª mensagem, e 2,0% são
  abertas e nunca usadas. Declarado no card: conversa curta também descreve
  pergunta respondida de primeira.
- **Lista para ação:** 269 clientes que usaram o Consultor em **um único dia**,
  não voltaram há 30+ dias e **seguem ativos no produto**. É o recorte que faz a
  lista valer — quem sumiu do produto inteiro é outro problema e já tem lista em
  Clientes; estes continuam aparecendo e estão ao alcance.

Duas hipóteses reprovadas: *"a IA deixa pergunta sem resposta"* (são 1,34
mensagem do assistente por mensagem do usuário — não há problema de
confiabilidade a reportar) e *"crédito de mentoria parado vira lista de ação"*
(o dado mostra 58 sessões estratégicas disponíveis e **zero** usadas, mas são 47
pessoas e o assunto já tem card próprio em Organizações — dois donos para o mesmo
número).

**Corrigido de passagem:** a descrição anunciava "lista cortada nos 5.000 mais
recentes" numa lista de 269. O corte agora só é declarado quando de fato morde —
anunciar limitação inexistente ensina o leitor a desconfiar de número que está
inteiro.

**Organizações subiu a escada (12/ago).** Tinha um descritivo, um comparativo e
dois prescritivos — e **nenhum diagnóstico**: a tela dizia quem está mal e para
quem ligar, nunca onde nem por quê.

- **Onde estão as contas, e onde está a gente.** 38,6% das contas ativas não têm
  ninguém aparecendo — mas elas são só 16% das pessoas. A maior parte das
  **pessoas** (46,6%, 6.111) está nas 223 contas com menos de 25% do time ativo,
  que são 11,7% das contas. Contar organização e contar gente aponta para lugares
  diferentes, e qual olhar depende de a decisão ser sobre cobrança ou sobre uso.
  Este card **destrava a regra `org_time_morto`**, recusada em 12/ago por
  publicar um total que não existia em card nenhum.
- **Quanto maior o time, menor a fatia que aparece:** 34,7% até 5 pessoas, 27,2%
  de 6 a 20, 20,4% acima de 20. Margem de 2,0 pp entre as pontas. O card mostra a
  taxa por pessoa **e** a média das organizações lado a lado: quando as duas
  concordam, o gradiente não é efeito de misturar conta de uma pessoa com conta
  de cem.
- **Quando a conta esfria, quem parou primeiro?** Em 69,7% das vezes o master,
  contra 11,6% do time — 6× mais frequente. É o degrau seguinte ao card do efeito
  do master: sai da correlação e lê a ordem no tempo. Declara as 581 contas que
  ficam de fora por não ter histórico dos dois lados (essas não esfriaram, nunca
  esquentaram) e que master que delegou aparece como parado sem ter abandonado.

Reprovada: *"comprar mais assento do que precisa prediz time parado"*. Contas com
sobra de assento têm 39,4% de zeradas contra 8,9% das quase cheias — mas isso é
**tamanho disfarçado de sobra**: as contas com folga têm 1,5 membro em média, e
conta de uma pessoa só é 0% ou 100% ativa. A média de time ativo até inverte o
sinal. O tamanho virou card próprio, medido direito.

**Defeito de desempenho corrigido:** `bi_orgs_quem_parou_primeiro` levava 6,8 s e
estourava o timeout da API na primeira chamada (HTTP 500 no navegador). Era
desenho, não volume — duas subconsultas correlacionadas rodando uma vez por
organização. Viraram agregados de conjunto: **6.798 ms → 107 ms**.

**Jornada & Telas subiu a escada (12/ago).** Tinha três descritivos e dois
diagnósticos — nenhum comparativo, nenhum prescritivo.

- **As sessões que inflam o ranking.** 38 sessões — 0,08% do total — carregam
  **15,5% de todas as telas vistas**; somadas às de 51 a 200 telas, 355 sessões
  (0,8%) carregam 22,7%. Sessão de centenas de telas não é hábito: é aba
  esquecida aberta ou robô, e contamina de uma vez o ranking de pageview, as
  telas por sessão e a duração mediana. É o card que faltava desde que
  `jor_posicao_inflada` apareceu, e o alvo dele é a instrumentação.
- **Quem chega por link direto não navega:** 41,2% dessas sessões terminam na
  primeira tela, contra 1,3% de quem entra por `/`, `/login` ou `/convite` — e
  77% das sessões chegam por link direto. Margem de 0,6 pp. Declarado: sessão de
  tela única vinda de link direto também descreve quem veio ver uma coisa
  específica e viu.
- **Navegar fundo prediz seguir ativo:** 62,7% × 49,8%, margem de 4,0 pp. As
  janelas são **disjuntas de propósito** — navegação medida na primeira semana do
  mart, atividade nos 30 dias até o último dia com dado — para o comportamento
  não ser lido depois do resultado.

As três funções **não aceitam período**: `marts.fact_navegacao` cobre o que a
purga dominical da plataforma deixou entrar no mart, e esse intervalo *é* a
janela — cada card declara de quando fala.

⚠️ **O arquivo é `marts.fact_pageview`, não `fact_navegacao`.** A navegação é
**derivada** do pageview e **reconstruída a cada sync**: `etl.sync_fact_navegacao`
faz `delete from marts.fact_navegacao where data_brt >= hoje - 45 dias` e
reinsere. Ela não guarda nada além dessa janela móvel — em 17/08 o corte cai
exatamente em 03/07, então **a semana de 03–09/07 sai de `fact_navegacao` a
partir de 18/08**. A cópia que sobrevive é `fact_pageview`: 474.831 linhas de
03/07 a 17/08, das quais **73.296 são da semana de 03–09/07 que a origem já não
tem** (`public.analytics` da plataforma: zero linha naquele intervalo). Análise
que precise daquela semana lê `fact_pageview`.

**Receita fica de fora da escada por ora** (decisão do Mateus, 12/ago). Faz
sentido: a tela mede uma fonte que parou de registrar pagamento há 112 dias
(pendência A), e subir a escada de uma série que termina onde o rastreamento
parou seria construir análise sobre um cano entupido. Volta depois que a
pendência A for decidida.

**Falta:** a escada em Receita, quando a fonte dela for resolvida.

Placar da escada:

| Tela | Aba de análise | Escada de profundidade |
| --- | --- | --- |
| Visão Geral | ✅ 3 regras | ✅ na régua |
| Clientes & Retenção | ✅ 6 regras | ✅ na régua |
| Entrada | ✅ 5 regras | ✅ na régua |
| Formações | ✅ 4 regras | ✅ na régua |
| Soluções | ✅ 2 regras | ✅ na régua |
| Consultor & Builder | ✅ 4 regras | ✅ na régua |
| Organizações | ✅ 3 regras | ✅ na régua |
| Jornada & Telas | ✅ 4 regras | ✅ na régua |
| Receita | ✅ 4 regras | congelada (§6.9) |
| CS | fora desta leva (pendência do Mateus) | bloqueada (sem carga) |

Quatro achados da leva, todos medidos:

1. **35,2% dos ativos entraram no próprio período** — o crescimento é comprado,
   não retido, e o KPI de ativos não distinguia isso.
2. **Comprador retém 38,9%, convidado 19,4%.** O produto retém quem paga e
   perde quem o pagante trouxe.
3. ~~**Soluções tem 1,6% de compromisso** contra praticamente tudo nos outros
   módulos — atrai atenção e não converte.~~ **RETIRADO em 17/ago: o achado era
   instrumentação, não comportamento.** `solution_started` parou de ser emitido
   em 22/06/2026 e a janela de 30 dias tem **zero** desses eventos, então o
   numerador perdeu os inícios inteiros. Medido no mesmo dia:
   `marts.fact_progresso_solucao` registra **11.666 inícios reais** na janela, e
   o compromisso reconstruído é **32,12%**, não 1,6%. A conclusão "atrai atenção
   e não converte" não se sustenta neste número — o funil de Soluções continua
   valendo pelo card próprio (4,9% de conclusão), que lê o mart de progresso e
   não o evento morto. Corrigir a tela é a Fase 2 (frente A).
4. **Mortalidade por módulo, em taxa:** de quem passou por Formações, 33,8%
   teve ali a última ação; pelo Consultor, 2,8%. O card antigo dizia "59% param
   em Formações", que era popularidade.

O que a segunda leva encontrou, em ordem de gravidade medida (score = múltiplo
do próprio limiar da regra):

1. **Receita: 112 dias sem um único pagamento registrado** (score 3,73). A série
   não descreve um negócio parado — descreve um rastreamento que parou. É o
   primeiro número a levar para o Mateus.
2. **A cobrança insiste mais do que acerta:** 131 faturas em falha contra 236
   pagas — 79,3% de falha (score 3,17). Dinheiro que não entra por atrito de
   cobrança, não por decisão do cliente.
3. **Jornada: o ranking de pageview está inflado** (score 11,20 — o maior do
   catálogo). A tela líder aparece na posição média 235 da sessão, contra sessão
   média de 7 telas. Navegação humana não tem esse comprimento: é aba esquecida
   aberta ou robô, e contamina de uma vez o ranking, as telas por sessão e a
   duração mediana.
4. **Soluções: 1.814 começam, 89 terminam** — 4,9% (score 4,08). A perda não
   está na descoberta, está depois do início.
5. **Organizações: onde o master para, o time para junto.** Time ativo de 52,9%
   nas contas com master ativo contra 14,3% nas de master parado — 3,7×. Com a
   view corrigida, são 960 organizações sem ninguém ativo.
6. **Receita concentra num lançamento:** 77 dos 103 compradores num único mês.
   A série descreve um evento, não um regime — e qualquer projeção feita sobre
   ela herda esse formato.

### Lote de 18/ago — cinco passos, e um desenho descartado pela medição

Cinco entregas encadeadas, cada uma medida antes e depois:

1. **A régua de rastreio passou a viver num lugar só.** `marts.rastreio_por_tipo()`
   virou a fonte única de ativo/atrasado/parado e `bi_saude_rastreio` passou a
   publicá-la em vez de manter uma segunda cópia. ~3,5 s → ~0,15 s.
2. **O espelho de CS ganhou as duas redes que a plataforma já tinha** —
   propagação de exclusão e reconciliação de valor. O delete de movimento é
   escopado por quadro que ainda existe: `bi_pulse.pipeline_movimentos` faz
   INNER JOIN com uma tabela sem foreign key, e um quadro apagado faria os
   movimentos dele sumirem da view com as linhas vivas na base.
3. **Jornada trocou "duração mediana" por mediana de telas.** O KPI publicava
   0,5 min porque 31,6% das sessões têm uma tela só e valem zero por construção
   — e é o MESMO conjunto, conferido linha a linha. Aposentado em vez de
   declarado: não há leitura honesta enquanto a plataforma não instrumentar
   tempo. Duas RPCs órfãs caíram junto, uma delas devolvendo nome e e-mail para
   qualquer autenticado (pendência O).
4. **O compromisso de Soluções saiu de 1,6% para 32,1%**, e a fonte mudou de
   vez: o início passa a sair de `marts.fact_progresso_solucao`. Decisão do
   Mateus: publicar o reconstruído em vez de suprimir o card.
5. **A guarda prometida pelo passo 1 foi construída — mas não como estava
   desenhada.** Ver abaixo.

**O desenho original do passo 5 era falso, e a medição pegou antes do código.**
A guarda seria "suprimir quando `rastreio_por_tipo` disser que o tipo está
parado". Só que "faz tempo que não registra" não separa cano entupido de
torneira fechada. Medidos os quatro tipos parados contra uma fonte independente
do mesmo fato:

| tipo | evento parou | fonte independente | veredito |
| --- | --- | --- | --- |
| `solution_started` | 22/06 · 17.694 ev | `fact_progresso_solucao`: 24.643 inícios depois disso | **quebrado** |
| `connection_accepted` | 05/05 · 144 ev | `member_connections` aceitas: 190 linhas, última em 14/08 | **quebrado** |
| `community_post_created` | 18/06 · 137 ev | `community_posts` raiz: 142 linhas, última em **18/06** | **sem uso** |
| `community_comment` | 23/04 · 22 ev | `community_posts` respostas: 20 linhas, última em **23/04** | **sem uso** |

As duas últimas batem na data exata. A guarda original carimbaria a Comunidade
de rastreio quebrado — publicaria diagnóstico falso, que é a mesma classe de
defeito que o passo 4 acabou de tirar da tela.

O que entrou no lugar: `etl.corroborar_rastreio()` no cron diário (04:45 BRT),
gravando em `marts.rastreio_corroboracao`. Roda fora da RPC por duas razões
medidas — a corroboração da Comunidade lê foreign table, e o card de saúde
passaria a falhar exatamente quando o FDW cai, que é quando se olha para ele.
Qualquer falha de leitura vira `sem_corroboracao`, nunca `sem_uso`: com o FDW
fora do ar, "a fonte não tem registro" é verdade para todas as fontes.

**Achado de produto que caiu daí: a Comunidade está morta, e a instrumentação
está sadia.** Zero post desde 18/06/2026 e zero comentário desde 23/04 — 162
posts e 20 respostas em toda a história da tabela. Fica registrado aqui e **não
vira tela**: o volume não sustenta análise, e o módulo já não aparece no card de
ações por não ter uma única ação na janela. É decisão de produto (manter,
relançar ou encerrar), não pergunta de BI.

**Duas correções durante a execução, as duas de desempenho, as duas medidas:**

- A guarda chamava `rastreio_por_tipo()` — varria 350 mil linhas do fato para
  ler quatro. Passou a ler `marts.rastreio_corroboracao` direto: 317 ms → 0,3 ms.
  E o segundo canal ficou mais certo, não só mais barato: "o módulo tem consumo
  vivo?" passou a ser respondido pela janela e pelo recorte pedidos
  (`consumo > 0`), não pelo status global do tipo.
- ⚠️ **`marts.evento_aposentado(tipo) -> boolean` custou 12× em predicado de
  linha** — 31 ms viraram 371 ms no mesmo scan. A causa não é o custo da função:
  é que **função SQL com cláusula `SET` não faz inline**, e `set search_path to
  ''` é obrigatório pela regra da casa. As duas regras do projeto se combinam
  num defeito que nenhuma prevê sozinha. A saída foi mudar a forma:
  `marts.eventos_aposentados() -> text[]`, sem argumento e `immutable`, que o
  planejador dobra em constante. **Régua compartilhada que entra em predicado de
  linha devolve conjunto, nunca booleano por item.**

**A guarda é no-op hoje, de propósito.** Ela suprime `pct_compromisso` (e a
média da plataforma junto) quando o módulo tem consumo na janela e um
compromisso quebrado. Hoje não dispara: o único quebrado que a função leria é o
`solution_started`, que o passo 4 aposentou. Mesmo espírito do escopo por quadro
do passo 2 — existe para a falha seguinte.

### Fase 2 da proposta de direcionamento — 5 de 6 itens fechados (18/ago)

`docs/proposta-fase-3-direcionamento.md` §6 lista seis itens na fase 2 ("parar de
publicar número quebrado"). Estado conferido no banco em 18/08:

| Item | Estado |
| --- | --- |
| guarda de instrumentação | ✅ passo 5 do lote — virou régua com corroboração |
| aposentadoria do KPI de duração | ✅ passo 3 — mediana de telas no lugar |
| reconciliação do espelho de CS | ✅ passo 2 |
| RPCs órfãs | ✅ passo 3 — `bi_ultima_sincronizacao` e `bi_power_users` |
| lote das 22 RPCs com `now()` | ✅ **fechado**: 20 na migration `20260818050000`, `bi_jornada_kpis` no passo 3, `bi_saude_pipeline` declarada como exceção permanente |
| **corte de sessão inflada** | ❌ **aberto** — ver abaixo |

**As 22 RPCs, com verificação que vale registrar.** A substituição é a mesma em
todas: `(now() at time zone 'America/Sao_Paulo')::date` →
`marts.data_referencia()`. Com o pipeline vivo os dois valem o mesmo dia, então
**o resultado tem de ser idêntico** — e é isso que prova que a troca pegou só a
âncora. Tirei o md5 do resultado das 20 antes e depois: **20 de 20 iguais**,
incluindo a `bi_raio_x_telas`, que era a de risco (588 ms, sem regressão).

A migration é uma **transformação declarada com asserção**, não vinte corpos
colados: a mudança é de uma linha por função, e colar ~24 mil caracteres de SQL
idêntico ao que já está no banco esconderia justamente o que mudou. A lista de
alvos é explícita, e o bloco aborta se alguma função não contiver o padrão, se
sobrar `now()` depois, ou se o corpo não mudar.

⚠️ **`bi_saude_pipeline` estava na lista das 22 por engano.** Ela calcula "horas
desde a última sync" — existe para comparar o relógio do dado com o de parede.
Migrá-la faria o BI responder "0 hora desde a sincronização" para sempre,
inclusive com o pipeline parado, que é o único momento em que alguém a lê. Ficou
com o motivo no próprio `comment on function`.

**O que falta na fase 2: o corte de sessão inflada.** Conferido no banco — só
existe o card que as MEDE (`bi_jornada_sessoes_infladas`, entregue em 12/ago).
Nenhuma RPC de navegação corta: `bi_raio_x_telas`, `bi_portas_entrada` e
`bi_pontos_saida` seguem contando as sessões-robô. É o achado de maior score do
catálogo inteiro (`jor_posicao_inflada`, 11,20) e continua no ar: 355 sessões
(0,8%) carregam 22,7% de todas as telas vistas. Antes de cortar é preciso fixar
o limiar, e limiar é régua — vai para o Mateus com a medição do efeito ao lado.

**Módulo encerrado entrou na régua (18/ago).** Comunidade e Networking saíram do
ar como produto, o que muda a leitura do card de saúde: três dos quatro eventos
calados passaram a `descontinuado`, e o card parou de pedir conserto sobre
produto que não existe. O histórico fica nos fatos de propósito — janela que
alcance o período em que os módulos existiam continua contando as ações deles.

### As três camadas saíram do papel (18/ago)

A arquitetura que o Mateus desenhou em 17/ago — **dados brutos · análises · plano
de ação** — deixou de ser só proposta. Estado no fim de 18/ago:

> ⚠️ **O desenho de abas mudou no fim do dia 18/ago, por correção do Mateus.** A
> primeira versão tinha `Análise` primeira, abas por pergunta variando de tela
> para tela, e o plano de ação só como seção de topo. Ele fechou outro padrão:
> **as MESMAS três abas em todo módulo — `Gráficos` · `Análise` · `Plano` —
> nesta ordem**, que é a das três camadas. As abas por pergunta saíram; o
> agrupamento delas passou para a `SecaoDeAnalise`, dentro de `Gráficos`.

| Camada | Onde vive | Estado |
| --- | --- | --- |
| Gráficos (o dado) | 1ª aba de todo módulo, **e a padrão** — gráficos + linhas cruas no fim | ✅ 10 de 10 |
| Análise (a leitura) | 2ª aba de todo módulo | ✅ 10 de 10 (CS declara que ainda não tem regra) |
| Plano (a sugestão) | 3ª aba de todo módulo | ✅ 10 de 10 (idem) |
| Plano transversal | `/plano`, seção de topo | ✅ no ar, modo **reporta** — a pergunta que nenhum módulo responde |
| Explorar | `/explorar`, seção de topo | ✅ no ar, 37 tabelas e 1,78 milhão de linhas |

**O passo mais arriscado da mudança de abas não foi o layout, foi a âncora.**
`insights.regra.ancora_aba` guarda o valor da aba para onde o link "ver o
gráfico que sustenta" navega. Medido antes de mexer: **28 das 35 regras
apontavam para aba que ia deixar de existir**, em 8 telas — e o CLAUDE.md já
descrevia essa armadilha em prosa, sem nada no CI para pegá-la. A migration
`20260818090000` reancorou as 35 em `graficos`, purgou `insights.achado_cache`
(que guarda o achado serializado com a âncora dentro, e serviria a antiga sem
erro nenhum) e o `contrato-de-shell.test.ts` ganhou a trava que faltava: todo
módulo tem de ter a aba `graficos`, e ela tem de ser a primeira.

**O que a fase 6 virou na prática.** A camada de dados tem duas metades de
natureza oposta, e só uma estava travada:

- **As linhas por trás dos cards** (`AbaDeDados`) não abrem exposição nenhuma:
  são as mesmas linhas que a tela já baixou para desenhar o gráfico. A decisão
  central foi **não fazer consulta nova** — se a aba relesse o banco, passaria a
  existir uma segunda consulta capaz de divergir do card ao lado. A garantia é
  estrutural, não uma promessa: é o mesmo objeto em memória.
- **O `Explorar` sobre os marts** é exposição de verdade, porque o schema `marts`
  não está na API REST e o navegador não o alcança. Quem serve são duas RPCs
  contra uma **allowlist congelada por migration**.

⚠️ **Como não há papel de admin (decisão de 18/08), a allowlist é o único
controle que sobrou** — o controle deixou de ser de acesso e passou a ser de
armazenamento. Por isso ela é allowlist nos dois eixos (tabela e coluna), com
padrão seguro dos dois lados, e por isso a migration termina com uma guarda que
aborta se algum identificador direto ficou servido.

**Três defeitos meus, achados conferindo o próprio resultado:**

1. A recomendação original dizia "deixar os fatos de grão de pessoa fora". Está
   errada e teria esvaziado o Explorar — quase todo fato é de grão de pessoa. A
   régua certa é **identificador direto**: `user_id` é chave pseudônima e o
   contrato de PII manda usar chave no lugar do valor.
2. A primeira lista de identificadores era `nome` e `email`. Com ela, o catálogo
   retinha `dim_organizacao.nome` e **servia `dim_usuario.organizacao`**, que é o
   mesmo valor na tabela vizinha. Retenção que o vizinho desfaz não é retenção.
   `organizacao` entrou na lista.
3. A proposta afirmava que a aba `Dados` "nasce barata porque cada card já
   declara qual RPC o alimenta". **Nenhum card declara.** São 93 RPCs em 10
   módulos e o vínculo card→RPC era feito a olho.

**O que a varredura por nome de coluna encontrou** (e uma lista escrita à mão
teria perdido): `fact_fatura.email` e `master_snapshot.organizacao`. Todo o resto
é hash (`contato_hash`, `email_hash`, `empresa_hash`, `solicitante_email_hash`),
chave (`empresa_id`, `organization_id`, `user_id`) ou conteúdo (`titulo`, `slug`,
`path`, `tela`) — e esses ficam servidos de propósito.

### Auditoria de coerência do produto (18/ago) — nove dimensões, dois defeitos

A pedido do Mateus ("garanta que todos os dados estão corretos"), varri abas,
menus e páginas por verificação determinística. Nada de leitura a olho: os
defeitos desta classe são todos silenciosos.

**O que saiu limpo:** as 35 âncoras de achado resolvem num card real da tela
certa · `ancora_aba` existe como 1ª aba nos 10 módulos · as três abas em 10/10 ·
nada perdido na fusão (seção, card, bento, `nivel` e `id` idênticos) · ~100
fontes de dado declaram a RPC que o hook de fato chama, com objeto-único ×
array correto em todas · as 106 RPCs que o front chama existem no banco ·
menu ↔ router 1:1 · `temPeriodo`/`temRecorte` declarado = controle renderizado
em 12/12 · os 18 campos de percentual dentro de [0,1].

**Dois defeitos, os dois da classe que o projeto mais combate** — a regra
publicando número que o card apontado não desenha. Foi por isso que
`org_time_morto`, `sol_aba_pulada` e `sol_catalogo_sem_morto` foram recusadas em
12/08; estas duas passaram porque nasceram certas e **a tela mudou embaixo
delas**.

| Regra | O que a frase dizia | O que o card mostrava |
| --- | --- | --- |
| `vg_concentracao` | "43,8% de **todas as ações do período** — 59.024 no total" (`bi_eventos_por_tipo`, soma 59.138) | `card-eventos` = "Ações por módulo" (`bi_acoes_por_modulo`, soma **70.949**) |
| `ent_sem_primeira_acao` | "31,57% do grupo… **a maior barra do gráfico** é a de quem não agiu" (`bi_tempo_primeiro_valor`) | `card-tempo-primeira-acao` = corte por origem, onde a maior barra do comprador é "No mesmo dia" |

**`vg_concentracao` foi APOSENTADA**, e a causa não era a âncora: era a base.
Rastreado até `c0b7c71` — quando a Visão Geral subiu a escada, o card que
desenhava `bi_eventos_por_tipo` saiu e o `id` foi reaproveitado por outro
gráfico. Mas desde o passo 4 da Fase 2 a definição de "ação de produto" da casa
é `bi_acoes_por_modulo`, e os 11.811 de diferença **são exatamente** o braço de
inícios reconstruídos do mart. Reescrita sobre a base atual a regra ficaria
redundante: `solution_viewed` é o único tipo classificado como `consumo`, então
"a fatia do comportamento líder" e "a fatia de consumo" viraram o mesmo número —
já publicado no headline de "O uso é raso ou profundo?". Mesmo caso de
`cli_gap_papel`, aposentada em 12/08.

**`ent_sem_primeira_acao` foi REESCRITA** sobre a RPC que o card desenha. Voltar
a distribuição de sete faixas desfaria uma decisão deliberada e registrada em
código; e não é preciso, porque o corte por origem responde a mesma pergunta com
mais informação. A regra passa a publicar a fratura que este roadmap já celebra
como achado de 12/08 e que o motor nunca teve: **34,5% dos convidados nunca
agiram, contra 10,3% de quem comprou — 3,34×**, score 1,67.

Depois das duas: o catálogo tem **34 regras**, e os 9 calculadores leem
**apenas** RPCs que a página desenha.

**Dívida encontrada:** 3 RPCs órfãs no banco (`bi_eventos_por_tipo` e
`bi_tempo_primeiro_valor`, agora com o aviso no próprio `comment on function`, e
as duas de CS sem card) e 2 hooks órfãos em `visao-geral/queries.ts`.

⚠️ **O teste de contrato do motor estava verde por acidente, e isto é o achado
mais incômodo da auditoria.** `contrato-do-motor.test.ts` extraía o corpo de
cada função procurando a string `'$$;'` — mas as migrations do motor abrem com
`$function$`. O `indexOf` nunca casava com o fecho certo: devolvia -1 e o
"corpo" virava todo o SQL dali até o fim do arquivo concatenado. Enquanto o
texto engolido não citasse `marts.` nem `etl.`, passava. Quebrou justamente
quando uma migration ganhou um `comment on function` explicando de qual mart a
régua saiu — a mesma armadilha que a limpeza de comentário já existia para
evitar, entrando por outra porta. Corrigido: a tag é lida do próprio texto.

⚠️ **O que a auditoria NÃO consegue travar no CI, e por quê.** O invariante
"todo calculador lê só RPC que a página desenha" precisa do estado atual dos
calculadores, e isso só o banco tem — o CI não tem banco. Tentei extrair das
migrations e o parser errou 4 dos 9 (deu a receita para Formações e a entrada
para Soluções). Não instalei: guarda que mede errado é pior que guarda nenhuma.
Fica como conferência de revisão, com a consulta registrada neste documento.

### Segundo corte da auditoria: a régua `e_cliente` (18/ago)

O primeiro corte conferiu COERÊNCIA e achou dois defeitos. Este confere
SEMÂNTICA, começando pela régua que já custou 30,8% de desvio em 13/08.

Trinta RPCs leem fato sem `e_cliente`. A maioria é legítima, e agora cada caso
está provado: **13 de CS** (grão empresa) · **8 leem `fact_navegacao`**, que já
nasce filtrada · e nove que precisaram de medição uma a uma.

**Um defeito real — `bi_valor_nao_consumido`:**

| Créditos de mentoria individual | antes | depois |
| --- | --- | --- |
| disponíveis | 280 | **195** |
| usados | 60 | **31** |
| taxa de uso | 17,65% | **13,72%** |
| beneficiários | 61 | 56 |

**85 dos 280 créditos "parados" — 30% — eram de quem não é cliente**, e quase
metade dos usos também (29 de 60). O card se chama "valor contratado não
consumido" e existe para decisão comercial: inflava o problema em 43%.

**Duas exceções em que aplicar a régua seria DEFEITO, não correção.** As três
RPCs de Receita leem `marts.fact_fatura`, onde só **3** das 1.119 linhas são de
não-cliente — mas **283 (25,3%) não têm `user_id` nenhum**. Um join com a dim
descartaria essas 283 e derrubaria a receita publicada. `bi_erros_login` e
`bi_erros_por_tela` são caso ainda mais claro: `fact_erro_login` e
`fact_erro_cliente` **não têm coluna `user_id`** — a régua é impossível ali, não
omitida.

⚠️ **O achado estrutural é que nenhuma das nove exceções estava declarada** —
oito não tinham `comment on function` nenhum. O CLAUDE.md exige "sem exceção não
declarada" justamente porque exceção muda de indistinguível de esquecimento com
o tempo, e foi assim que os 30,8% entraram em 13/08. As nove agora carregam o
motivo medido no próprio banco, onde quem abre a função encontra.

**Correção ao próprio registro:** publiquei o efeito como "21,4% → 15,9%" antes
de ler a função. O denominador da taxa é `disponivel + usado`, não `disponivel`;
a conta certa é 17,65% → 13,72%. Dividir antes de ler a fonte é exatamente o
defeito que esta auditoria persegue.

### Levantamento concluído em 11/ago

- **`proposta-fase-2-profundidade.md`** — documento de decisão: anatomia padrão
  da tela, escada de profundidade com régua de composição verificada no CI,
  arquitetura do resumo, plano por módulo, módulos novos e sequência de fases.
  **Aguarda OK por fase.**
- **`mapa-dados-plataforma.md`** — 211 tabelas dos três bancos, 138 perguntas de
  decisão que o BI não responde, 192 achados de qualidade.

Três resultados que mudam o plano, todos reconferidos no banco:

1. **A Entrega 9 mede um gateway morto.** O schema `via_hub` (R$ 32,2 milhões
   desde dez/2025, 6 gateways, vivo) mostra que `hubla_webhooks` era um gateway
   entre seis — o webhook não quebrou, a empresa trocou de gateway. **Mas o hub
   está em construção** (decisão do Mateus, 11/ago: 46% dos perfis ainda sem
   `id_via`), então a Entrega 9 **não** será refeita sobre ele agora: nesta fase
   ela só declara a limitação e encerra a série. Critérios de retomada em
   `proposta-fase-2-profundidade.md` §4.
2. **Nove das dez telas reprovam na escada de profundidade** — o parque tem 78
   cards descritivos contra 4 diagnósticos.
3. **O BI virou arquivo sem saber.** A purga dominical da plataforma apagou os
   pageviews de 03–09/07/2026 em 09/08 (73.479 linhas numa execução); eles só
   existem em **`marts.fact_pageview`** — não em `fact_navegacao`, que é
   derivada e só guarda 45 dias. A purga de navegação está inativa hoje. As de
   notificações estão **agendadas mas falham em toda execução** desde 19/07
   (`permission denied for function`), então 546.616 notificações seguem vivas.

**Descoberta que destravou o mapeamento:** o MCP alcança os três bancos direto,
sem depender do `postgres_fdw`. O pipeline parado bloqueia a carga dos marts,
não a análise do schema de origem.

## Pendências abertas pela leva de 12/ago (análise em aba)

Registro corrido: o que ficou para corrigir ou alinhar depois. Ordem de
gravidade, não de esforço.

| # | Pendência | Onde | Precisa de |
| --- | --- | --- | --- |
| A | **112 dias sem pagamento registrado.** A Receita descreve um rastreamento parado, não um negócio parado. A tela declara, mas o dado não volta sozinho | Receita | decisão do Mateus: reconectar a fonte, apontar para o `via_hub` quando ele estiver populado, ou congelar a tela de vez |
| B | ~~**Escada de profundidade não subiu nas oito telas novas.**~~ **Fechada.** As oito telas estão em `TELAS_NA_REGUA` e declaram `nivel` em **todos os cards, 63 no total** — Clientes 10/10 · Entrada 8/8 · Formações 8/8 · IA 8/8 · Jornada 8/8 · Organizações 7/7 · Soluções 7/7 · Visão Geral 7/7. Ficam de fora **Receita** (5 cards) e **CS** (12 cards), as duas por decisão declarada, não por dívida esquecida (§6.9 e pendência T·c) | 8 telas | ✅ |
| C | ~~**`org_time_morto` ficou órfã.**~~ **Destravada em 12/ago**: o card "Onde estão as contas, e onde está a gente" publica o total — 738 de 1.911 contas ativas sem ninguém aparecendo (38,6%). A regra pode voltar lendo `bi_orgs_distribuicao_engajamento` | Organizações | entra no lote de reescrita do catálogo (itens K e M) |
| D | **Duas réguas de "% saída" na mesma tela.** `bi_pontos_saida.pct_da_tela` (29,6% para `/team-management`) e `bi_raio_x_telas.pct_saida` (36,5% para a mesma tela) medem coisas diferentes. Hoje cada card declara a sua | Jornada | alinhar nomes, ou aceitar as duas e manter a declaração explícita |
| E | **Severidade oscila no corte.** Muita regra cai entre 1,2 e 1,6, e o corte de `atenção` está em 1,5 — variação mínima de dado troca o rótulo entre "atenção" e "observação" | motor | decidir se a régua de severidade muda ou se o rótulo deixa de ser gradiente |
| F | **Piso de rastreamento chumbado em `VALUES`.** `bi_churn_modulos` carrega a lista de quando cada módulo passou a ser medido; módulo novo fica invisível para `cli_mortalidade` até alguém lembrar de atualizar | Clientes | virar tabela, ou ganhar teste que reprove módulo ausente da lista |
| G | **Janela de `cli_comprador` duplicada.** O 120/30 vive no calculador e em `bi_retencao_comprador`; mudar num e não no outro faz a frase mentir sem erro nenhum | Clientes | a RPC devolver a própria régua como coluna |
| H | **NPS de aula parou em 29/07 — é a coleta na origem, não o pipeline.** Conferido em 17/08 direto na plataforma: `learning_lesson_nps` tem 17.912 linhas e a última é de **29/07/2026**, com o FDW de pé e `fact_nps_aula` sincronizando normalmente (0 linhas novas porque não há linha nova lá). Nenhuma regra de Formações lê NPS, de propósito | Formações | perguntar ao time da plataforma por que a coleta parou |
| I | ~~**As seis RPCs de Jornada ainda ancoram em `now()`.**~~ **Fechada em 18/08**, junto com a dívida inteira: as 22 funções de produto migraram para `marts.data_referencia()` (`bi_jornada_kpis` no passo 3; as outras 20 na migration `20260818050000`). Verificação: md5 do resultado de cada uma antes e depois — **as 20 idênticas**, que é o esperado com o pipeline vivo. Sobram no relógio 6 `bi_cs_*` e a `bi_saude_pipeline`, as sete por decisão declarada | Jornada · parque | ✅ |
| J | **`card-retencao-papel` ficou sem regra.** É o card que `cli_gap_papel` apontava antes de ser aposentada. O card segue correto e útil | Clientes | nada urgente — anotado para não parecer esquecimento |
| K | **Os três cards novos de Entrada não têm regra no motor.** A aba de análise ainda fala das cinco perguntas antigas; o corte comprador × convidado na porta e o efeito do onboarding não aparecem no texto | Entrada | reescrever o catálogo da tela depois que todas subirem a escada, para não mexer duas vezes |
| P | **O repo não reconstrói o banco.** Medido em 17/08: `supabase/migrations` tem **87 arquivos**; `supabase_migrations.schema_migrations` tem **97 entradas** — a distância de 10 não fechou, só andou junto. Renomeei 26 arquivos para a versão realmente aplicada (o timestamp do arquivo era o que eu escrevia, não o do apply), mas sobram **10 arquivos sem entrada no banco** — quatro deles porque um arquivo virou 2–3 entradas ao ser aplicado em pedaços via MCP — e **18 entradas sem arquivo**. Enquanto isso durar, `supabase db push` é inseguro | infra | reconciliar antes de qualquer merge para a `main`; parte é dívida anterior a 11/ago |
| V | ~~**`cliente_status_diario` guarda só 4 dias.**~~ **Resolvido em 13/ago, e a minha hipótese estava errada.** A tabela **acumula** — nasceu em 10/08, a função que escreve nela não tem delete e nenhum job purga (verificado pelo time do Pulse). Nada estava se perdendo. O contrato ganhou a 9ª view e o mart `marts.fact_cs_status_diario` carrega incremental por dia, com releitura dos dois últimos. Perguntar antes de afirmar evitou um pedido urgente que não era urgente | CS | ✅ |
| W | **Duas tabelas de CS fora do contrato, com valor e com data de morte.** `client_upsell_opportunities` (9.582 oportunidades com produto e status, **parou em 09/07/2026**) e `whatsapp_conversation_intent` (11.302 classificações de intenção e urgência, **parou em 19/03/2026**). A segunda parece feature abandonada; a primeira parou há um mês e vale perguntar se migrou de lugar | CS | perguntar ao Pulse antes de pedir espelho |
| U | ~~**Pipeline da plataforma: causa confirmada, é o allow list.**~~ **Resolvido em 12/ago às 22:32 UTC.** A causa foi confirmada ao vivo — `FATAL: (EADDRNOTALLOWED) address not in tenant allow_list: {54, 232, 250, 105}`, o IP de saída do BI fora das network restrictions da plataforma, não credencial nem tenant do pooler. Com a reinclusão o cano voltou no mesmo minuto: **5 dias corridos sem uma falha** (13–17/08, 1.440 execuções por dia, 0 falhas) e `marts.data_referencia()` = a data de hoje. Fica registrado que foi a **terceira ocorrência do mesmo IP caindo da lista** e que o IP de saída não é dedicado — a pergunta ao time da plataforma sobre IaC sobrescrevendo mudança manual continua valendo, porque o sintoma se repete | infra | ✅ (monitorar a 4ª ocorrência) |
| T | **CS: três acabamentos abertos.** (a) `saude_cs` grava `finalizado_em` anterior a `iniciado_em` — cosmético, mas é a linha que alguém lê quando o canário dispara; (b) `bi_cs_disparos_mensal` é dirigida por `fact_cs_envio`, então mês com campanha e sem log some da série (42 campanhas sem log); (c) os 13 cards de CS não declaram `nivel` nem `id` — a tela está fora da escada e sem âncora para o motor de achados | CS | entra junto com as pendências do Mateus |
| S | **Atribuição de `atendimento_tickets` depende do Pulse — `retencao` não.** Medido em 12/ago: o workaround que o time do Pulse sugeriu para `retencao` (ligar a `pipeline_cards` por `empresa_hash`) resolve **205 de 232 (88,4%)** com org única, 6 ambíguos, 21 sem org — derivamos do nosso lado, sem pedir nada. Já `atendimento_tickets` traz só `contato_hash` (telefone), e `marts.dim_usuario` **não espelha telefone**: não há caminho nosso. Aceito o que eles ofereceram (match por telefone normalizado, só o unívoco, ~81%) | CS | resposta enviada ao Pulse |
| R | ~~**CS: conexão de pé, import bloqueado por 2 grants**~~ **Resolvido.** Os dois `grant execute` saíram — `bi_pulse.hash_pii` (usada por 7 das 8 views) e `public.wa_phone_key` (usada por `retencao`). Medido em 17/08: **as 9 foreign tables de `pulse` leem**, e os 9 marts de CS estão carregados com **95.781 linhas** (`retencao` 261 · `atendimento_tickets` 2.645 · `pipeline_cards` 6.557 · `cancelamentos` 296 · `disparos_campanhas` 1.970 · `cliente_status_diario` 20.937). O host errado (`aws-0` → `aws-1`) segue corrigido e versionado | CS | ✅ |
| Q | **Atribuição de CS: resolvida em 3 das 5 views** (12/ago). O time do Pulse expôs `organization_id` em `pipeline_cards` (75,2%), `pipeline_movimentos` (80,4%) e `cancelamentos` (83,8%) — verificado ao vivo. Fizeram melhor que o pedido: em vez de liberar `bi.empresa` para o nosso role, embrulharam a busca em `public.bi_empresa_org_id(uuid) returns uuid` SECURITY DEFINER. O role ganhou a chave **sem** ganhar acesso a razão social, e-mail ou telefone — segue lendo 8 objetos e zero dos 414 de `public`. Coluna adicionada no fim da view, para não quebrar `select *` de quem já consome. **Resolvida também em `atendimento_tickets`** (medido 17/08): o time entregou `organization_id` + `organization_id_origem` na view, cobrindo **1.984 de 2.645 tickets (75,0%)**, todos por `telefone_unico` — o match por telefone normalizado unívoco que o item S registra como aceito. Sobram 661 sem org e 1.308 orgs distintas atribuídas. **Falta só `retencao`** (261 linhas), que segue com `empresa_hash`/`id_via` e sem `organization_id` — o caminho ali é o workaround do item S, derivado do nosso lado. ⚠️ **A coluna nova não chega ao BI ainda**: `pulse.atendimento_tickets` foi importada antes dela e a definição da foreign table está velha — precisa de `import foreign schema ... limit to (atendimento_tickets)` para a coluna aparecer | CS | reimportar a foreign table; `retencao` pelo caminho do item S |
| O | ~~**Lista nomeada não passa por `private.is_admin()`.**~~ **RESOLVIDA POR DECISÃO em 18/08: não haverá papel de admin no BI.** O contrato de PII passa a valer por "quem tem conta no BI" — a segunda das duas saídas que esta pendência listava. São **três** RPCs nominais e não duas (`bi_clientes_em_risco`, `bi_masters_top_convidadores`, `bi_ia_experimentaram_e_sumiram`); a terceira apareceu na conferência. Consequência registrada no CLAUDE.md: o controle deixa de ser de ACESSO e passa a ser de ARMAZENAMENTO, e é por isso que a allowlist do Explorar é a peça central daquela camada | IA · Clientes · Entrada | ✅ (decisão) |
| M | **Os cards novos de Formações também não têm regra no motor** — mesma situação de Entrada (item K). O texto da aba ainda fala das quatro perguntas antigas | Formações | mesmo lote de reescrita do catálogo |
| N | **Uma linha da tela de CS foi corrigida fora do combinado.** O headline de atendentes tinha o mesmo defeito do "0 enquanto carrega" e o teste novo reprovava o build; corrigi só essa linha, sem tocar em nada do que está pendente com o Mateus | CS | ciente — nenhuma decisão de CS foi antecipada |
| L | **Tabela comparativa pede rolagem lateral em 375px.** É o comportamento correto do DS (rola dentro do próprio container, a página não rola), e o headline já carrega o número principal — mas a coluna "Convidado" só aparece rolando | Entrada | avaliar esconder uma coluna no mobile quando o padrão se repetir nas outras telas |
| X | ~~**`member_connections` não está espelhada.**~~ **Encerrada sem execução em 18/08: o Networking saiu do ar.** O veredito de `connection_accepted` passou a `descontinuado`, que é a leitura certa — o evento não sai porque o produto acabou, não porque o cano entupiu. Espelhar a tabela deixou de ter pergunta que a justifique, e o contrato de PII é explícito: tabela sem pergunta não vira mart | — | ✅ (não fazer) |
| Y | ~~**A Comunidade está morta e a instrumentação está sadia.**~~ **Respondida em 18/08 pelo Mateus: Comunidade e Networking não existem mais como produto.** Os dois entraram em `marts.modulos_descontinuados()`, e o card de saúde parou de pedir conserto para eles. O histórico fica nos fatos de propósito | produto | ✅ |
| Z | **`bi_acoes_por_modulo` leva ~1,4 s.** Não é a guarda (0,3 ms) nem regressão do lote de 18/ago — é o `count(distinct user_id)` sobre 70 mil linhas, que derrama para disco (`external merge`). Está longe do timeout, mas é o card mais lento da Visão Geral | Visão Geral | medir se um `HashAggregate` com `work_mem` maior ou uma pré-agregação por usuário/dia resolve; não mexer sem medir |

## Pendências abertas pela auditoria de 08/ago/2026

Relatório completo: `docs/auditoria-dados-2026-08.md`. As telas 1–9 estão
entregues; estes são os pontos que a auditoria abriu e ainda não fecharam.

| # | Pendência | Entrega | Estado |
| --- | --- | --- | --- |
| 1 | Pageviews por solução via `slug` (a origem não preenche `analytics.solution_id`) | 5 | ✅ resolvida |
| 2 | `dim_usuario` não removia quem foi deletado na plataforma | — | ✅ resolvida |
| 3 | Espelhar `implementation_requests` (114) — "pedidos de implementação paga" ficou sem cobertura | 5 | ✅ **resolvida**: com o pipeline de volta, `marts.fact_pedido_implementacao` carregou as **114 linhas — o mesmo total da origem `plataforma.implementation_requests`**, sem perda. O mart deixou de ser tabela vazia; falta só a tela consumir |
| 4 | Engajamento pré-renovação — sem RPC; depende de inventariar `renewal_logs` | 9 | aberta — item 9 da auditoria de 11/ago |
| 5 | "Onde a implementação trava" não é monotônico — lido como funil, confunde | 5 | passada visual |

**Nota de infraestrutura**: a restrição de rede do projeto da plataforma já
parou o pipeline duas vezes, e as duas voltaram. A primeira (19h) foi porque o
allow list só tinha `72.60.154.220/32` e o BI sai por `54.232.250.105`. Em
08/ago o `54.232.250.105/32` saiu de novo da lista e o pipeline ficou parado de
08/08 a 12/08 ("could not connect to server plataforma_srv"; **4.006 falhas no
total**, com 11/ago inteiro sem um único sucesso). **A reinclusão surtiu efeito
em 12/08 às 22:32 UTC** e desde 13/08 são 1.440 execuções por dia com zero
falhas. O IP de saída do BI não é dedicado e pode mudar em manutenção do
Supabase — o sintoma se repete e o alerta avisa em até 30 min. Esta foi a
terceira ocorrência; vale o pedido do item U ao time da plataforma.

## Notas de régua (valem para tudo)

- "Cliente" = regra `e_cliente` herdada do `bi_cohort_base` da plataforma —
  aplicada em **toda** métrica de uso, sem exceção (a auditoria de 08/ago
  encontrou 7 pontos que não aplicavam).
- Timezone: America/Sao_Paulo, colunas `*_brt`.
- **Pageviews começam em 03/07/2026.** Nenhuma métrica que atravesse essa data
  pode incluir pageview: "ativo" é sempre `fact_evento` (contrato), e todo
  comparativo cujo período anterior anteceda 03/07 é suprimido (`null` na RPC,
  delta omitido na UI) em vez de mostrar crescimento que é instrumentação.
- Toda peça visual nova passa pelo showcase `/design` antes do módulo.
