# Auditoria do dado bruto — o que sustenta análise e o que não sustenta

Medido ao vivo nos três bancos em **13/08/2026**. Toda linha aqui saiu de consulta,
não de leitura de documentação — inclusive as que confirmam o mapa de 11/ago.

A pergunta que originou a auditoria: *"eu tenho a minutagem que o usuário parou em
um vídeo, eu tenho os logs corretos de tudo?"* e, adiante, *"consigo medir que um
cliente viu formação X e solução Y e pediu cancelamento?"*.

---

## 1. Minutagem de vídeo: NÃO EXISTE

| medição | resultado |
| --- | --- |
| `learning_progress` | 148.393 linhas |
| `last_position_seconds` diferente de zero | **0** |
| `video_progress` preenchido | **1** |
| progresso parcial (1–99%) | 2.106 (1,4%) |
| conclusões (100%) | 146.287 (98,6%) |

As duas colunas existem no schema e o player **nunca escreveu nelas**. Varri o
schema `public` inteiro atrás de qualquer coluna que pudesse guardar posição em
mídia (`position|seconds|watch|heartbeat|playback|elapsed`): as únicas candidatas
são essas duas, vazias, e os timestamps de `video_transcripts` — que são marcação
da fala do instrutor, não do espectador. **Não existe tabela de heartbeat.**

Consequência: "onde o aluno parou no vídeo" e "tempo assistido" não são
respondíveis, e nenhum contorno de dado resolve. Exige instrumentação nova na
plataforma (heartbeat do player Panda).

**O proxy honesto que já temos** é abriu-vs-concluiu por aula, cruzando o pageview
da rota de aula com `learning_progress`. Não diz o minuto, mas diz qual aula é
abandonada — que é a decisão editorial que importa primeiro.

## 2. "Temos os logs de tudo?" — três regimes muito diferentes

Não existe um "log de tudo". Existem três, com vidas úteis incompatíveis:

| log | linhas | janela real | vida |
| --- | ---: | --- | --- |
| `analytics` (navegação) | 363.331 | 10/07/2026 → 13/08/2026 | **34 dias** — janela móvel |
| `audit_logs` | 281.638 | 23/03/2026 → 13/08/2026 | 143 dias |
| `learning_progress` | 148.406 | 13/05/2025 → 13/08/2026 | 457 dias |
| `progress` (soluções) | 56.950 | 17/07/2025 → 13/08/2026 | 392 dias |

⚠️ **A navegação é uma janela móvel de ~30 dias, não um histórico.** As linhas de
2025 em `analytics` são 238 eventos `start` de 9 pessoas — instrumento morto. Todo
o volume real é `event_type='view'`, e começa em 10/07/2026.

**O espelho do BI já é arquivo, e isso já valeu.** `marts.fact_pageview` tem 42
dias (03/07 → 13/08) contra 34 na origem: **8 dias que a plataforma já apagou só
existem aqui**. Cada domingo que o pipeline passa parado é uma semana de navegação
perdida para sempre.

**`marts.fact_evento` é a espinha do comportamento de longo prazo**: 343.510
linhas, 9.734 clientes, 09/05/2025 → 13/08/2026. Tem 72 dias sem registro, todos
concentrados entre mai e ago/2025 — o instrumento nascendo, não buraco de sync.
**De 11/08/2025 em diante não falta um dia.** É um ano contínuo.

## 3. A análise que o Mateus quer: caminho → desfecho

### Cancelamento: RESPONDÍVEL HOJE

| medição | resultado |
| --- | --- |
| cancelamentos espelhados | 276 (13/10/2025 → 13/08/2026) |
| com `organization_id` | 231 (83,7%) |
| orgs canceladas com gente na plataforma | **230 de 231** |
| clientes alcançados | 1.016 |
| desses, com aula concluída ANTES do cancelamento | 432 |
| com solução tocada antes | 506 |
| com evento de produto antes | 660 |

E o grupo de controle existe, que é o que torna a comparação honesta:

| | orgs |
| --- | ---: |
| na plataforma | 2.077 |
| no CS | 2.136 |
| **nos dois** | **2.074 (99,9%)** |
| cancelaram | 230 |
| **controle (ficaram)** | **1.844** |

230 casos contra 1.844 controles, com um ano de comportamento antes do desfecho.
Passa folgado da régua de 30 e sustenta recorte por formação, por solução e por
ordem temporal.

### Renovação: NÃO RESPONDÍVEL AINDA — e o relógio está correndo

`cliente_status_diario` tem **4 dias, na origem também** (10/08 → 13/08/2026). A
tabela nasceu em 10/08; não estamos perdendo carga, o histórico simplesmente não
existe.

Ela **acumula** — cada dia vira uma linha por empresa. `plan_started_at` já traz
378 datas distintas desde 09/09/2024, então dá para saber a idade do contrato
hoje; o que não dá é ver a renovação ACONTECER, porque isso exige comparar dois
dias e só temos quatro.

⚠️ **Consequência operacional, não teórica: toda renovação que acontecer num dia
em que o sync não rodar é uma renovação que nunca poderá ser detectada.** Não há
como recuperar depois — a origem não guarda changelog, só o retrato do dia.

## 4. Instrumento morto que a tela ainda lê

| instrumento | linhas | último registro | nos últimos 30d |
| --- | ---: | --- | ---: |
| `learning_lesson_nps` — **a tela lê este** | 17.920 | 29/07/2026 | 730 |
| `learning_lesson_ratings` — o substituto vivo | 310 | **13/08/2026** | 310 |
| `learning_comments` | 635 | 21/05/2026 | 0 |

O NPS de aula foi substituído por estrelas e parou de receber resposta em
29/07/2026. `learning_lesson_ratings` **não está espelhada no BI**. O KPI de NPS
ainda mostra número porque a janela de 30 dias ainda alcança 29/07 — e vai zerar
sozinho por volta de **28/08/2026**, sem erro nenhum, como se ninguém tivesse
respondido.

## 5. Ordem de trabalho que isto sugere

1. **Nada a fazer no dado para a análise de cancelamento** — está de pé. É a
   primeira análise a construir, porque é a de maior valor e não depende de
   ninguém.
2. **Garantir o sync diário de `cliente_status_diario`** antes de qualquer outra
   coisa: é o único item em que atraso destrói dado de forma irreversível.
3. **Espelhar `learning_lesson_ratings`** e aposentar o KPI de NPS antes de 28/08,
   senão a tela mente sozinha.
4. **Pedir instrumentação de heartbeat de vídeo** à plataforma — é decisão de
   produto, não de BI, e enquanto não vier o proxy é abriu-vs-concluiu.
5. **Declarar em tela que navegação é janela móvel.** Qualquer comparação de
   pageview contra período anterior a 03/07/2026 não tem com o que comparar.

## Origens não espelhadas com valor registrado

| tabela | por que importa |
| --- | --- |
| `learning_lesson_ratings` | o instrumento de qualidade que está VIVO |
| `course_access_control` (321 regras curso×papel) | o denominador de toda taxa de adoção de formação — hoje divide-se por todos os clientes, não por quem tem acesso |
| `solution_learning_recommendations` (`key_topics`) | a única taxonomia de assunto por aula que existe (441 de 554 aulas); congelada em 25/06/2026 |
