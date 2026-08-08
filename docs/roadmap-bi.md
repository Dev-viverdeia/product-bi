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

## Pendências abertas pela auditoria de 08/ago/2026

Relatório completo: `docs/auditoria-dados-2026-08.md`. As telas 1–9 estão
entregues; estes são os pontos que a auditoria abriu e ainda não fecharam.

| # | Pendência | Entrega | Bloqueio |
| --- | --- | --- | --- |
| 1 | Pageviews por solução via `slug` (a origem não preenche `analytics.solution_id`) — reintroduz a coluna e o critério "sem acesso" | 5 | FDW |
| 2 | Espelhar `implementation_requests` (114) — "pedidos de implementação paga" ficou sem cobertura | 5 | FDW |
| 3 | Engajamento pré-renovação — sem RPC; depende de inventariar `renewal_logs` | 9 | FDW |
| 4 | `dim_usuario` não remove quem foi deletado na plataforma | — | FDW |
| 5 | "Onde a implementação trava" não é monotônico — lido como funil, confunde | 5 | passada visual |

⚠️ **O FDW está fora**: o projeto da plataforma passou a ter restrição de rede
que rejeita a conexão do BI. Enquanto não for liberada, o pipeline não
sincroniza e as pendências 1–4 ficam paradas.

## Notas de régua (valem para tudo)

- "Cliente" = regra `e_cliente` herdada do `bi_cohort_base` da plataforma.
- Timezone: America/Sao_Paulo, colunas `*_brt`.
- Pageviews rastreados desde jul/2026; deltas longos de navegação refletem instrumentação.
- Toda peça visual nova passa pelo showcase `/design` antes do módulo.
