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
| CS — dashboard executivo (2ª fonte: Pulse) | 🚧 Tela, marts e RPCs prontos; aguarda o user mapping do FDW (`docs/discovery-banco-cs-pulse.md`) |

### Auditoria roadmap × tela (11/ago/2026)

O ✅ acima significa "módulo no ar" — não "toda pergunta respondida". A
auditoria de 11/ago conferiu cada uma das 35 análises das entregas 2–9, mais o
recorte transversal, contra o código e o banco: **9 não têm resposta em tela
nenhuma**. Ficam registradas aqui até cada linha virar entrega.

| # | Onde | Pergunta do roadmap | Realidade na tela | Trava |
| --- | --- | --- | --- | --- |
| 1 | Transversal | recorte por persona/plano nas métricas centrais (obrigatório) | o único filtro do app é o de período | nenhuma — `papel` e `plano` já estão em `marts.dim_usuario` |
| 2 | E3 | funil de entrada com "entregue" e "aberto" | funil no ar tem 4 etapas; faltam as 2 de e-mail | rastreio de entrega parou na plataforma em abr/2026 |
| 3 | E3 | onboarding: `time_per_step` e pontos de abandono | só a etapa atual de cada cliente | FDW parado |
| 4 | E4 | NPS × retenção/conclusão | só o ranking de NPS por aula | FDW parado |
| 5 | E5 | pedidos de implementação paga | mart criado e nunca sincronizado | FDW parado |
| 6 | E6 | Consultor: tokens vs limite | não existe | FDW parado |
| 7 | E6 | Builder: limite mensal atingido | não existe | FDW parado |
| 8 | E8 | rotina de uso por perfil | heatmap é global, sem recorte | nenhuma |
| 9 | E9 | engajamento pré-renovação | não existe — `renewal_logs` nem é foreign table | FDW parado |

Os itens 5 e 9 são as pendências 3 e 4 da auditoria de 08/ago, vistas do lado
do roadmap. Os itens 1 e 8 não têm trava — são os únicos executáveis com o
pipeline parado, e o 1 é o próximo passo acordado com o Mateus.

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
| Semântica | recorte pelo papel/plano **atual** (a dim não guarda histórico): "retenção dos hands_on" lê "de quem hoje é hands_on". Papel na época do evento exigiria snapshot histórico — fora deste contrato |
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

### Levantamento concluído em 11/ago

- **`proposta-fase-2-profundidade.md`** — documento de decisão: anatomia padrão
  da tela, escada de profundidade com régua de composição verificada no CI,
  arquitetura do resumo, plano por módulo, módulos novos e sequência de fases.
  **Aguarda OK por fase.**
- **`mapa-dados-plataforma.md`** — 211 tabelas dos três bancos, 138 perguntas de
  decisão que o BI não responde, 192 achados de qualidade.

Três resultados que mudam o plano, todos reconferidos no banco:

1. **A receita real do produto está no schema `via_hub`**, que ninguém tinha
   aberto: R$ 32,2 milhões desde dez/2025, vivo até hoje, em 6 gateways. A
   Entrega 9 mede ~2,7% disso porque `hubla_webhooks` era um gateway entre seis
   — o webhook não quebrou, a empresa trocou de gateway. E R$ 1,15 milhão das
   compras de julho foi reembolsado (34,5% do mês), o que nenhuma tela mostra.
2. **Nove das dez telas reprovam na escada de profundidade** — o parque tem 78
   cards descritivos contra 4 diagnósticos.
3. **O BI virou arquivo sem saber.** A purga dominical da plataforma já apagou
   os pageviews de 03–09/07/2026; eles só existem no nosso mart. A purga de
   navegação está inativa hoje, a de notificações está ativa.

**Descoberta que destravou o mapeamento:** o MCP alcança os três bancos direto,
sem depender do `postgres_fdw`. O pipeline parado bloqueia a carga dos marts,
não a análise do schema de origem.

## Pendências abertas pela auditoria de 08/ago/2026

Relatório completo: `docs/auditoria-dados-2026-08.md`. As telas 1–9 estão
entregues; estes são os pontos que a auditoria abriu e ainda não fecharam.

| # | Pendência | Entrega | Estado |
| --- | --- | --- | --- |
| 1 | Pageviews por solução via `slug` (a origem não preenche `analytics.solution_id`) | 5 | ✅ resolvida |
| 2 | `dim_usuario` não removia quem foi deletado na plataforma | — | ✅ resolvida |
| 3 | Espelhar `implementation_requests` (114) — "pedidos de implementação paga" ficou sem cobertura | 5 | aberta — item 5 da auditoria de 11/ago |
| 4 | Engajamento pré-renovação — sem RPC; depende de inventariar `renewal_logs` | 9 | aberta — item 9 da auditoria de 11/ago |
| 5 | "Onde a implementação trava" não é monotônico — lido como funil, confunde | 5 | passada visual |

**Nota de infraestrutura**: a restrição de rede do projeto da plataforma já
parou o pipeline duas vezes. A primeira (19h) foi porque o allow list só tinha
`72.60.154.220/32` e o BI sai por `54.232.250.105` — resolvida. Em 08/ago o
`54.232.250.105/32` saiu de novo do allow list: pipeline parado desde então
("could not connect to server plataforma_srv"; 240 falhas até 11/ago), números
da plataforma congelados em 08/ago e o alerta no topo do app declarando a
parada. Reinclusão pedida ao time da plataforma em 11/ago. O IP de saída do BI
não é dedicado e pode mudar em manutenção do Supabase — o sintoma se repete e o
alerta avisa em até 30 min.

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
