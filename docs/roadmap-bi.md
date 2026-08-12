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
| CS — dashboard executivo (2ª fonte: Pulse) | ✅ **No ar em 12/ago**: 8 marts carregados (73.314 linhas), sync a cada 30 min, tela lendo dado real. Falta a escada de profundidade e as pendências do Mateus |

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

As três funções **não aceitam período**: `marts.fact_navegacao` cobre 03/07 a
08/08/2026 e mais nada, porque a plataforma purga navegação com mais de 30 dias
todo domingo. Esse intervalo *é* a janela, e cada card declara de quando fala —
inclusive a semana de 03–09/07, da qual este mart é a única cópia que existe.

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
3. **Soluções tem 1,6% de compromisso** contra praticamente tudo nos outros
   módulos — atrai atenção e não converte.
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
3. **O BI virou arquivo sem saber.** A purga dominical da plataforma já apagou
   os pageviews de 03–09/07/2026; eles só existem no nosso mart. A purga de
   navegação está inativa hoje, a de notificações está ativa.

**Descoberta que destravou o mapeamento:** o MCP alcança os três bancos direto,
sem depender do `postgres_fdw`. O pipeline parado bloqueia a carga dos marts,
não a análise do schema de origem.

## Pendências abertas pela leva de 12/ago (análise em aba)

Registro corrido: o que ficou para corrigir ou alinhar depois. Ordem de
gravidade, não de esforço.

| # | Pendência | Onde | Precisa de |
| --- | --- | --- | --- |
| A | **112 dias sem pagamento registrado.** A Receita descreve um rastreamento parado, não um negócio parado. A tela declara, mas o dado não volta sozinho | Receita | decisão do Mateus: reconectar a fonte, apontar para o `via_hub` quando ele estiver populado, ou congelar a tela de vez |
| B | **Escada de profundidade não subiu nas oito telas novas.** A aba de análise entrou, mas os cards não declaram `nivel` — elas seguem fora de `TELAS_NA_REGUA` | 8 telas | trabalho de gráfico, uma tela por vez (é a fase seguinte) |
| C | ~~**`org_time_morto` ficou órfã.**~~ **Destravada em 12/ago**: o card "Onde estão as contas, e onde está a gente" publica o total — 738 de 1.911 contas ativas sem ninguém aparecendo (38,6%). A regra pode voltar lendo `bi_orgs_distribuicao_engajamento` | Organizações | entra no lote de reescrita do catálogo (itens K e M) |
| D | **Duas réguas de "% saída" na mesma tela.** `bi_pontos_saida.pct_da_tela` (29,6% para `/team-management`) e `bi_raio_x_telas.pct_saida` (36,5% para a mesma tela) medem coisas diferentes. Hoje cada card declara a sua | Jornada | alinhar nomes, ou aceitar as duas e manter a declaração explícita |
| E | **Severidade oscila no corte.** Muita regra cai entre 1,2 e 1,6, e o corte de `atenção` está em 1,5 — variação mínima de dado troca o rótulo entre "atenção" e "observação" | motor | decidir se a régua de severidade muda ou se o rótulo deixa de ser gradiente |
| F | **Piso de rastreamento chumbado em `VALUES`.** `bi_churn_modulos` carrega a lista de quando cada módulo passou a ser medido; módulo novo fica invisível para `cli_mortalidade` até alguém lembrar de atualizar | Clientes | virar tabela, ou ganhar teste que reprove módulo ausente da lista |
| G | **Janela de `cli_comprador` duplicada.** O 120/30 vive no calculador e em `bi_retencao_comprador`; mudar num e não no outro faz a frase mentir sem erro nenhum | Clientes | a RPC devolver a própria régua como coluna |
| H | **NPS de aula parou em 29/07.** Nenhuma regra de Formações lê NPS, de propósito | Formações | conferir se a coleta na origem parou ou se é o pipeline |
| I | **As seis RPCs de Jornada ainda ancoram em `now()`.** Dívida declarada; nenhuma das quatro regras compara períodos, então pipeline atrasado encurta a janela sem inverter sinal | Jornada | entra no lote geral das ~43 funções com `now()` |
| J | **`card-retencao-papel` ficou sem regra.** É o card que `cli_gap_papel` apontava antes de ser aposentada. O card segue correto e útil | Clientes | nada urgente — anotado para não parecer esquecimento |
| K | **Os três cards novos de Entrada não têm regra no motor.** A aba de análise ainda fala das cinco perguntas antigas; o corte comprador × convidado na porta e o efeito do onboarding não aparecem no texto | Entrada | reescrever o catálogo da tela depois que todas subirem a escada, para não mexer duas vezes |
| P | **O repo não reconstrói o banco.** `supabase/migrations` tem 64 arquivos; `supabase_migrations.schema_migrations` tem 72 entradas. Renomeei 26 arquivos para a versão realmente aplicada (o timestamp do arquivo era o que eu escrevia, não o do apply), mas sobram **10 arquivos sem entrada no banco** — quatro deles porque um arquivo virou 2–3 entradas ao ser aplicado em pedaços via MCP — e **18 entradas sem arquivo**. Enquanto isso durar, `supabase db push` é inseguro | infra | reconciliar antes de qualquer merge para a `main`; parte é dívida anterior a 11/ago |
| U | **Pipeline da plataforma: causa confirmada, é o allow list.** Provoquei a conexão ao vivo em 12/ago e o erro completo é `FATAL: (EADDRNOTALLOWED) address not in tenant allow_list: {54, 232, 250, 105}`. Não é credencial nem tenant do pooler — é o IP de saída do BI fora das network restrictions do projeto da plataforma. **Terceira ocorrência do mesmo IP caindo da lista**: vale perguntar ao time da plataforma se a lista é gerida por IaC que sobrescreve mudança manual, senão isto volta | infra | pedido ao time da plataforma |
| T | **CS: três acabamentos abertos.** (a) `saude_cs` grava `finalizado_em` anterior a `iniciado_em` — cosmético, mas é a linha que alguém lê quando o canário dispara; (b) `bi_cs_disparos_mensal` é dirigida por `fact_cs_envio`, então mês com campanha e sem log some da série (42 campanhas sem log); (c) os 13 cards de CS não declaram `nivel` nem `id` — a tela está fora da escada e sem âncora para o motor de achados | CS | entra junto com as pendências do Mateus |
| S | **Atribuição de `atendimento_tickets` depende do Pulse — `retencao` não.** Medido em 12/ago: o workaround que o time do Pulse sugeriu para `retencao` (ligar a `pipeline_cards` por `empresa_hash`) resolve **205 de 232 (88,4%)** com org única, 6 ambíguos, 21 sem org — derivamos do nosso lado, sem pedir nada. Já `atendimento_tickets` traz só `contato_hash` (telefone), e `marts.dim_usuario` **não espelha telefone**: não há caminho nosso. Aceito o que eles ofereceram (match por telefone normalizado, só o unívoco, ~81%) | CS | resposta enviada ao Pulse |
| R | **CS: conexão de pé, import bloqueado por 2 grants** (12/ago). O mapping foi criado pelo Mateus e o cano funciona — lido `bi_pulse.disparos_campanhas` pelo FDW, 1.780 linhas frescas. O host estava errado (`aws-0` → `aws-1`, corrigido e versionado). Falta o time do Pulse dar `grant execute` em `bi_pulse.hash_pii` (usada por 7 das 8 views) e em `public.wa_phone_key` (usada por `retencao`). Só `disparos_campanhas` funciona hoje | CS | pedido aberto |
| Q | **Atribuição de CS: resolvida em 3 das 5 views** (12/ago). O time do Pulse expôs `organization_id` em `pipeline_cards` (75,2%), `pipeline_movimentos` (80,4%) e `cancelamentos` (83,8%) — verificado ao vivo. Fizeram melhor que o pedido: em vez de liberar `bi.empresa` para o nosso role, embrulharam a busca em `public.bi_empresa_org_id(uuid) returns uuid` SECURITY DEFINER. O role ganhou a chave **sem** ganhar acesso a razão social, e-mail ou telefone — segue lendo 8 objetos e zero dos 414 de `public`. Coluna adicionada no fim da view, para não quebrar `select *` de quem já consome. **Falta**: `atendimento_tickets` (2.499) e `retencao` (232) seguem sem qualquer ligação com empresa; a resposta do time sobre elas veio cortada na mensagem | CS | pedir a parte truncada da resposta |
| O | **Lista nomeada não passa por `private.is_admin()`.** O contrato de PII no CLAUDE.md diz que lista com nome e e-mail fica atrás de `is_admin()`; `public.bi_clientes_em_risco` já devolvia nome e e-mail para qualquer autenticado, e a lista nova de IA seguiu o mesmo modelo — divergir só na nova criaria duas regras para o mesmo dado | IA · Clientes | decisão do Mateus: apertar as duas ou registrar que o contrato vale por "quem tem conta no BI" |
| M | **Os cards novos de Formações também não têm regra no motor** — mesma situação de Entrada (item K). O texto da aba ainda fala das quatro perguntas antigas | Formações | mesmo lote de reescrita do catálogo |
| N | **Uma linha da tela de CS foi corrigida fora do combinado.** O headline de atendentes tinha o mesmo defeito do "0 enquanto carrega" e o teste novo reprovava o build; corrigi só essa linha, sem tocar em nada do que está pendente com o Mateus | CS | ciente — nenhuma decisão de CS foi antecipada |
| L | **Tabela comparativa pede rolagem lateral em 375px.** É o comportamento correto do DS (rola dentro do próprio container, a página não rola), e o headline já carrega o número principal — mas a coluna "Convidado" só aparece rolando | Entrada | avaliar esconder uma coluna no mobile quando o padrão se repetir nas outras telas |

## Pendências abertas pela auditoria de 08/ago/2026

Relatório completo: `docs/auditoria-dados-2026-08.md`. As telas 1–9 estão
entregues; estes são os pontos que a auditoria abriu e ainda não fecharam.

| # | Pendência | Entrega | Estado |
| --- | --- | --- | --- |
| 1 | Pageviews por solução via `slug` (a origem não preenche `analytics.solution_id`) | 5 | ✅ resolvida |
| 2 | `dim_usuario` não removia quem foi deletado na plataforma | — | ✅ resolvida |
| 3 | Espelhar `implementation_requests` (114) — "pedidos de implementação paga" ficou sem cobertura | 5 | **agravada (12/ago)**: `marts.fact_pedido_implementacao` existe e está **vazia**. Tabela vazia é pior que ausente — um join devolve nada em silêncio e parece resposta |
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
