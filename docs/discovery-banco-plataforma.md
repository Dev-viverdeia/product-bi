# Discovery — Banco da plataforma Viver de IA

**Fonte única do BI (por decisão do Mateus, 2026-08-06):** projeto Supabase `product_viverdeia_platform` — ref `zotzvtepvpnkcoobdubt`, região `sa-east-1`, Postgres 15.
Levantamento feito em 2026-08-06, somente leitura. Volumes e janelas referem-se a essa data.

## 1. Visão geral do banco

- **251 objetos** no schema `public` (≈190 tabelas + **37 views**), além de schemas `backup`, `_backup`, `archive` (ignorar — são operacionais).
- RLS ligada nas tabelas; várias tabelas de backup/operacionais com sufixo de data devem ficar **fora** do BI.
- **Já existe uma camada de BI parcial** em views: `bi_dau_mau`, `bi_cohort_base`, `bi_churn_cohort`, `bi_ltv_cohort`, `bi_receita_hubla`, `bi_frequencia_uso`, `bi_uso_vs_consumo`, `daily_activity_metrics`, `user_engagement_scores`, `user_engagement_ranking`, `builder_analytics`, `solution_implementation_counts`, `organization_health` + família `*_external` (13 views preparadas para consumo externo — provável pipeline antigo para o projeto `db_bi_platform`).

### Regra de negócio herdável (de `bi_cohort_base`)

Quem conta como **cliente** exclui: `role IN (admin, sales_team, convidado, freemium)`, e-mails `%viverdeia.ai%` e `%teste%`. Timezone de análise: `America/Sao_Paulo` (usada em `bi_dau_mau`). **Adotar essas mesmas exclusões em todos os marts.**

## 2. Números-chave validados (2026-08-06)

| Métrica | Valor |
| --- | --- |
| Perfis | 14.751 (14.201 ativos · 2.038 masters · 90,6% onboarding concluído) |
| Papéis principais | `hands_on` 11.707 · `master_user` 1.802 · `membro_club` 710 · `freemium` 301 |
| Ativos 7d / 30d (por evento de produto) | 1.407 / 3.623 |
| Convites | 31.988 emitidos · 14.733 usados (46%) · 5.148 deletados |
| Progresso de aulas | 143.638 linhas · 7.190 usuários · 550 aulas · 9.908 certificados |
| Progresso de soluções | 54.167 linhas · 6.670 usuários · **apenas 2.626 concluídas (4,8%)** |
| Consultor IA (desde mai/2026) | 8.552 threads · 51.783 mensagens |
| Builder | 6.711 soluções geradas · 37.094 gerações de step (v2, desde mar/2026) |

## 3. Fontes por módulo do BI

### 3.1 Usuários & atividade (módulo âncora)

| Tabela | Linhas | Janela | Uso no BI |
| --- | --- | --- | --- |
| `profiles` | 14,7k | jan/2025→hoje | dimensão usuário: role, plano, org, master, status, onboarding |
| `user_activity_tracking` | 327k | mai/2025→hoje | **fato principal de atividade** — 14 tipos de ação de domínio (populada por triggers de banco) |
| `analytics` | 372k | jun/2025→hoje | **pageviews do app INTEIRO** — `event_type='view'` + `event_data.path/referrer` cobre todas as rotas (`/dashboard`, `/formacoes`, `/solucoes`, `/consultor-ia`…); `solution_id` preenchido quando a rota é de solução. ⚠️ retenção ~365 dias (`cleanup_old_analytics`) — ver dicionário §2 |
| `user_presence` | 13,2k | fev/2026→hoje | last_seen + `current_path` (última tela) |
| `audit_logs` | 282k | mar/2026→hoje | funis de convite (`invite_created/applied`), `onboarding_v2_completed`, `learning_action` |
| `organizations` / `organization_admins` / `subscription_plans` / `plan_features` | 2k/151/3/30 | — | dimensões de org e plano |

Tipos em `user_activity_tracking` (volume): `lesson_completed` 143k · `solution_viewed` 124k · `consultor_ia_message` 22k · `solution_started` 17,9k · `certificate_generated` 10k · `builder_solution_created` 6,8k · `solution_completed` 2k · `connection_sent` 1,2k · + community/mentorship (volumes menores).

### 3.2 Formações

| Tabela | Linhas | Uso |
| --- | --- | --- |
| `learning_courses` / `learning_modules` / `learning_lessons` | 59/183/554 | catálogo (curso→módulo→aula), `published`, categoria, nível |
| `learning_lesson_videos` | 551 | `duration_seconds` por vídeo — base p/ tempo total e análise "duração ideal" |
| `course_durations` | 59 | duração agregada por curso (já sincronizada) |
| `learning_progress` | 143,6k | started_at, completed_at, `progress_percentage`, `last_position_seconds`, `video_progress` jsonb |
| `learning_certificates` | 9,9k | conclusão de formação (entrada→certificado = tempo de jornada) |
| `learning_lesson_nps` | 18k | NPS por aula (score + feedback texto) |
| `learning_lesson_ratings` | 215 | avaliação 1–5 (recurso novo, pouco volume) |
| `lesson_tags` / `learning_lesson_tags` | 50/0 | ⚠️ tags existem mas **nenhuma aula taggeada** — "assuntos mais assistidos" via categoria do curso ou tags do vídeo/transcript por enquanto |
| `video_transcripts` | 202k | transcrições com keywords — análise de assunto por conteúdo (fase avançada) |

⚠️ Qualidade: 98,5% das linhas de `learning_progress` têm `completed_at` — a tabela registra sobretudo conclusões; "tempo assistido" virá de `video_progress`/`last_position_seconds`, validar semântica na modelagem.

### 3.3 Soluções

| Tabela | Linhas | Uso |
| --- | --- | --- |
| `solutions` | 167 | catálogo: categoria, dificuldade, área (`solution_areas` 8), setor (`solution_sectors` 21), published |
| `progress` | 54k | funil por usuário×solução: iniciada→módulos→concluída (`is_completed`, `completion_percentage`) |
| `implementation_tab_progress` | 22k | progresso por aba de implementação (granular) |
| `analytics` (views) | 372k | visualizações por solução — ranking de acesso |
| `solution_ratings` | 692 | nota + feedback |
| `solution_favorites` | 3,1k | interesse |
| `implementation_requests` | 114 | pedidos de implementação paga (vai p/ Pipedrive) |
| `solution_certificates` | 2,6k | implementações certificadas |
| view `solution_implementation_counts` | — | contagem pronta, conferir definição |

Análise "quais saem": cruzar views (analytics) × starts (progress) × conclusão × rating × favoritos.

### 3.4 Builder

| Tabela | Linhas | Uso |
| --- | --- | --- |
| `ai_generated_solutions` | 6,7k | geração por usuário: status de implementação, tokens, tempo, evolução |
| `ai_solution_usage` | 11,9k | uso vs limite mensal por usuário |
| `builder_v2_step_generations` | 37k | gerações por step: status, erro, tokens, modelo, tempo |
| `builder_success_logs` / `builder_analysis_attempts` / `builder_step_generation_attempts` | 1,4k/696/5,2k | sucesso/tentativas/erros |
| `builder_v3_task_progress` | 1,2k | kanban da Sala do Projeto (todo/doing/done) |
| view `builder_analytics` | — | definição pronta, conferir |

### 3.5 Consultor IA

| Tabela | Linhas | Uso |
| --- | --- | --- |
| `consultor_threads` | 8,5k | threads por usuário, modo |
| `consultor_messages` | 51,8k | mensagens, tokens, modelo, duração |
| `consultor_journey` | 16,7k | itens de timeline |
| `consultor_ia_token_usage` | 30,7k | uso diário vs limite |
| `consultor_planejamentos` | 431 | modo planejamento estratégico |

### 3.6 Masters, times & convites

| Tabela | Linhas | Uso |
| --- | --- | --- |
| `organizations` | 2.092 | orgs, plano, team_limit, status |
| `invites` | 32k | funil: criado→`used_at` (46% conversão) · quem convida (`created_by`) · org |
| `invite_deliveries` / `invite_delivery_events` | 7,7k/42k | entrega por canal (email/whatsapp): sent→delivered→opened→clicked |
| `team_invite_requests` (+items) | 2,5k/4,9k | pedidos de convite em lote |
| `master_user_snapshots` | 2,4k | snapshot por master (cron 15min) — engajamento do time, expiração de plano |
| `referrals` / `referral_events` | 0/8,5k | indicações (referrals vazia; events com dado) |

"Masters que convidam vs não": `invites.created_by` × masters de `profiles`.

### 3.7 Entrada & onboarding

| Tabela | Linhas | Uso |
| --- | --- | --- |
| `onboarding_final` | 15,2k | `is_completed`, `current_step`, `time_per_step` jsonb, `abandonment_points` jsonb, score |
| `audit_logs` (`onboarding_v2_completed` 2,9k, `invite_applied` 6,4k) | — | funil de entrada |
| `auth_error_telemetry` | 9,9k (abr/2026→hoje) | **problemas de login** categorizados |
| `client_error_logs` | 7k (jun/2026→hoje) | erros de JS no navegador por tela |

### 3.8 Saúde da plataforma (fase futura — dados já existem)

`security_events` 12,6k · `security_logs` 114k · `security_incidents` 1,5k · `security_anomalies` · `blocked_ips` · `rate_limits` — deixar mapeado, não consumir agora.

## 4. Lacunas encontradas (o que o banco NÃO responde hoje)

1. ~~Jornada por telas: não existe~~ **CORRIGIDO no mapeamento completo (2026-08-06)**: `analytics` contém pageviews de todas as rotas do app (`event_data.path` + `referrer`) desde jun/2025 — jornada por telas é viável já. Instrumentação nova só seria necessária para clique-em-elemento (nível botão). Ver `dicionario-dados-plataforma.md` §1 e §8.
2. **Sessões**: sem tabela de sessão viva; DAU/tempo-na-plataforma virão de eventos (aproximação) — `user_activity_tracking` + `user_presence`.
3. **Tags de aula não populadas** (`learning_lesson_tags` = 0) — "assuntos" começam por categoria de curso.
4. Tabelas mortas que não devem entrar: `user_sessions`, `solution_metrics`, `material_downloads`, `journey_progress`, `onboarding_step_tracking`, `onboarding_abandonment_points` (dados equivalentes estão em `onboarding_final`).
5. `learning_lesson_ratings` é recente (215 linhas) — tratar como métrica nova, não histórica.

## 5. Recomendações para o pipeline (Fase 3.2)

- **Não plugar dashboard direto na produção.** Extração incremental (cron) → marts no nosso projeto `product-bi`.
- Chave incremental: `created_at`/`updated_at` presentes em todas as tabelas-fato ✓.
- Herdar exclusões de `bi_cohort_base` e timezone `America/Sao_Paulo` em TODA métrica.
- Aproveitar as views `bi_*` como especificação de DAU/MAU/churn/cohort já validada pelo time da plataforma; as `*_external` indicam que já houve um canal de consumo externo (confirmar com o time se `db_bi_platform` ainda consome — evitar duplicidade).
- Marts propostos (rascunho): `dim_usuario`, `dim_curso`, `dim_solucao`, `fact_atividade_diaria`, `fact_progresso_aula`, `fact_progresso_solucao`, `fact_builder`, `fact_consultor`, `fact_convites`, `fact_onboarding`, `fact_erros`.
