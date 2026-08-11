# Dicionário de dados — Plataforma Viver de IA

> ⚠️ **Superado como referência de origem por `mapa-dados-plataforma.md`**
> (11/08/2026), que mapeia 211 tabelas com volume, período, qualidade e as
> perguntas de decisão que cada domínio destrava. Este arquivo continua útil
> como índice por domínio e para os payloads JSONB, mas o mapa é a fonte.
> Em especial, este documento **não conhece o schema `via_hub`**, onde está a
> receita real do produto (R$ 32,2 mi), nem os schemas `auth`, `storage`,
> `meta`, `archive` e `backup`.

**Banco:** `product_viverdeia_platform` · ref `zotzvtepvpnkcoobdubt` · `sa-east-1` · Postgres 15.
Mapeamento completo em 2026-08-06 (complementa `discovery-banco-plataforma.md`, que traz volumes e qualidade).

> **Referência viva de schema:** as 58 foreign tables no schema `plataforma` do nosso banco
> são espelho 1:1 das tabelas de produção — para ver colunas/tipos atualizados, basta
> inspecionar `plataforma.*` no nosso próprio banco (`information_schema.columns`).

## 1. Como os dados nascem (caminhos de escrita)

- **`user_activity_tracking` é populada por TRIGGERS de banco** (`track_lesson_completed`, `track_builder_solution_created`, `track_community_activity`, `track_connection_activity`, `track_consultor_ia_usage`, `track_certificate_generated`, `track_mentorship_booked`) — ou seja, eventos de domínio são fiéis às tabelas de origem, não dependem do frontend.
- **`analytics` é PAGEVIEW do app inteiro** enviado pelo frontend: `event_type='view'` + `event_data = {path, referrer, timestamp, user_agent}` (+ `solution_id`/`module_id` quando a rota é de solução). Cobre `/dashboard`, `/formacoes`, `/solucoes`, `/consultor-ia`, `/mentorias`, `/login`, `/onboarding`, aulas individuais etc.
- **808 funções** no public (inclui internals de pgvector/pg_trgm). RPCs de negócio relevantes p/ entender semântica: `complete_lesson_v2`, `use_invite_enhanced`, `apply_invite_to_user`, `complete_onboarding_v2`, `check_ai_solution_limit_v2`, `use_mentorship_credit_v2`, `get_nps_analytics_data`, `refresh_master_user_snapshots`.
- **Cron da plataforma** (rotinas que mantêm dados): `refresh_master_user_snapshots` (15min), `sync-video-durations-daily`, reconciliações diárias de org/plan, `process-email-queue` (1min).

## 1.1 ⚠️ Janelas de rastreamento por tipo de evento (medido em 2026-08-06)

Os triggers `track_*` foram criados em momentos diferentes — TODA análise
longitudinal precisa respeitar estas janelas:

| Tipo de evento | Início | Fim | Nota |
| --- | --- | --- | --- |
| `lesson_completed` | mai/2025 | ativo | régua mais estável |
| `connection_sent` | jul/2025 | **jul/2026?** | conferir se parou |
| `certificate_generated` | ago/2025 | ativo | |
| `community_post_created` | ago/2025 | jun/2026? | volume baixo |
| `builder_solution_created` | out/2025 | ativo | ≈ lançamento do Builder |
| `mentorship_booked` | nov/2025 | ativo | volume baixo |
| `solution_viewed/completed` | **abr/2026** | ativo | tracking novo |
| `solution_started` | abr/2026 | **⚠️ PAROU em 22/jun/2026** | provável trigger quebrado — reportar ao time da plataforma |
| `connection_accepted` | nov/2025 | **⚠️ parou em mai/2026** | idem |
| `consultor_ia_message` | mai/2026 | ativo | = lançamento do Consultor |

> 📄 **Reporte consolidado para o time da plataforma:** `reporte-rastreamentos-quebrados.md`
> — inclui o achado de que `hubla_webhooks`, `webhook_logs` e `invite_deliveries`
> pararam **no mesmo dia (19/abr/2026)**, sugerindo causa raiz única no subsistema
> de webhooks.

**Receita: fonte parada E view quebrada (medido em 2026-08-07):**
`hubla_webhooks` **parou em 19/abr/2026**. Pior: a view `bi_receita_hubla` da
plataforma lê `payload->'invoice'->'amount'->>'totalCents'`, caminho que **não
existe** — a estrutura real é `payload->'event'->'invoice'->...`. Resultado: a
view retorna vazio e qualquer análise de receita/LTV feita com ela é nula.
O BI usa o caminho correto (`marts.fact_fatura`). Reportar ao time.

**Rastreamentos de convite também mortos (medido em 2026-08-07):**
`invite_deliveries.opened_at`/`clicked_at` NUNCA foram preenchidos (colunas mortas)
e `invite_delivery_events` é 100% `sent`; o próprio registro de envio **parou em
19/abr/2026**. Funil honesto atual: criado → cadastro (used_at) → onboarding →
1ª ação. Reportar ao time da plataforma junto com os triggers de evento.

Consequências já aplicadas no BI: (a) curvas de retenção entre cohorts distantes
carregam efeito de instrumentação (régua ganhou tipos novos — nota na UI);
(b) "usou Soluções" vem do espelho de `progress` (jul/2025+), não dos eventos;
(c) análise de aha moment só considera ações com cobertura no período.

## 2. ⚠️ Retenção e pipelines pré-existentes (não tocar, só saber)

- **`cleanup_old_analytics(365)` + cron semanal `cleanup-analytics-views`**: pageviews têm retenção ~365 dias (com backup em `analytics_backups`). **Nosso mart de pageviews é o que preserva histórico além disso.**
- **Pipeline BI legado ATIVO**: jobs `bi_pull_club_*` (10 tabelas, a cada 10 min) + funções `bi_emit_event`/`bi_backfill_table`/`bi_call_revops` — alimentam o `db_bi_platform` (decisão do Mateus: não mexer lá; nosso BI é independente via FDW).
- `cleanup_old_audit_logs`, `cleanup_old_notifications`, `cleanup_old_logs_lgpd` existem — assumir retenção limitada também em `audit_logs`/`notifications`/logs de segurança.

## 3. Tabelas por domínio (nome · linhas ≈ · papel no BI)

**Legenda**: ✅ = já espelhada no schema `plataforma` · ⬜ = não espelhada (irrelevante p/ BI) · 💀 = morta/vazia · 🗄️ = backup/operacional (nunca consumir)

### Usuários, papéis, planos e orgs
| Tabela | Linhas | Papel |
| --- | --- | --- |
| ✅ `profiles` | 14,7k | dimensão usuário (role, plano, org, master, onboarding, last_active) |
| ✅ `user_roles` | 12 | catálogo de papéis (hands_on, master_user, membro_club, freemium…) |
| ✅ `subscription_plans` | 3 | catálogo de planos |
| ✅ `plan_features` | 30 | gating de features por plano (source of truth de acesso a telas) |
| ✅ `organizations` | 2,1k | orgs com master_user_id, team_limit, status de assinatura |
| ✅ `organization_admins` | 109 | co-masters |
| ⬜ `permission_definitions` / `role_permissions` | 15/57 | RBAC fino (irrelevante p/ métricas) |
| 💀 `users` | 0 | morta (auth.users é a fonte) |

### Atividade e jornada
| Tabela | Linhas | Papel |
| --- | --- | --- |
| ✅ `user_activity_tracking` | 327k | **fato de ações de domínio** (14 tipos, via triggers) |
| ✅ `analytics` | 372k | **fato de pageviews do app inteiro** (`event_data.path`) · retenção 365d |
| ✅ `user_presence` | 13k | last_seen + current_path |
| ✅ `audit_logs` | 282k | funil convite/onboarding, ações de sistema · retenção limitada |
| ✅ `benefit_clicks` | 2,5k | cliques em benefícios de ferramentas |
| ⬜ `notifications` | 535k | notificações (volume alto, valor BI baixo — engajamento futuro) |
| 💀 `user_sessions`, `navigation_events` (36), `journey_progress` | ~0 | mortas — pageview real está em `analytics` |

### Formações (learning)
| Tabela | Linhas | Papel |
| --- | --- | --- |
| ✅ `learning_courses` / `learning_modules` / `learning_lessons` | 59/183/554 | catálogo hierárquico |
| ✅ `learning_lesson_videos` | 551 | vídeos + `duration_seconds` (Panda) |
| ✅ `course_durations` | 59 | duração agregada por curso (cron diário) |
| ✅ `learning_progress` | 143k | progresso por aula (`completed_at`, `video_progress`) |
| ✅ `learning_certificates` | 9,9k | conclusões de curso |
| ✅ `learning_lesson_nps` | 18k | NPS por aula |
| ✅ `learning_lesson_ratings` | 215 | avaliação 1–5 (recente) |
| ✅ `lesson_tags` + `learning_lesson_tags` | 50/0 | tags criadas, **nenhuma aula taggeada** |
| ✅ `video_transcripts` | 202k | transcrições + keywords (análise de assunto, fase avançada) |
| ⬜ `learning_comments`/`_likes`, `learning_resources`, `learning_certificate_templates`, `course_access_control`, `user_course_access` | — | secundárias (comentários/permissão) |

### Soluções
| Tabela | Linhas | Papel |
| --- | --- | --- |
| ✅ `solutions` | 167 | catálogo (categoria enum, dificuldade, área, setor) |
| ✅ `progress` | 54k | funil início→conclusão por usuário×solução |
| ✅ `implementation_tab_progress` | 22k | progresso por aba |
| ✅ `solution_ratings` / `solution_favorites` / `solution_certificates` | 692/3,1k/2,6k | qualidade, interesse, implementação certificada |
| ✅ `implementation_requests` | 114 | pedidos de implementação paga (→ Pipedrive) |
| ✅ `solution_areas` / `solution_sectors` | 8/21 | taxonomia |
| ⬜ `solution_tools`, `solution_resources`, `solution_comments`, `remix_*` (remix_click_logs 18k), `unified_checklists` | — | detalhe de implementação/remix |
| 💀 `solution_metrics` | 0 | morta |

### Builder
| Tabela | Linhas | Papel |
| --- | --- | --- |
| ✅ `ai_generated_solutions` | 6,7k | soluções geradas (tokens, tempo, status, evolução) |
| ✅ `ai_solution_usage` | 12k | uso vs limite mensal |
| ✅ `builder_v2_step_generations` | 37k | gerações por step (status/erro/modelo) |
| ✅ `builder_success_logs` / `builder_analysis_attempts` | 1,4k/696 | sucesso e tentativas |
| ✅ `builder_v3_task_progress` | 1,2k | kanban da Sala do Projeto |
| ⬜ `builder_generation_*` (reservations/attempts/jobs), `smart_step_cache`, `idea_validations_cache`, `builder_prompt_configs`, `ai_models`, `ai_prompts` | — | infra interna do Builder |

### Consultor IA
| Tabela | Linhas | Papel |
| --- | --- | --- |
| ✅ `consultor_threads` / `consultor_messages` | 8,5k/52k | conversas (tokens, modelo, duração por msg) |
| ✅ `consultor_journey` | 17k | timeline lateral |
| ✅ `consultor_ia_token_usage` | 31k | uso diário vs limite |
| ✅ `consultor_planejamentos` | 431 | modo planejamento (enum status) |
| ⬜ `consultor_knowledge_base` (+sync_log) | 131 | base de conhecimento interna |

### Convites, masters e indicações
| Tabela | Linhas | Papel |
| --- | --- | --- |
| ✅ `invites` | 32k | funil criado→usado (46%), quem convida, org, plano concedido |
| ✅ `invite_deliveries` / `invite_delivery_events` | 7,8k/42k | entrega por canal (sent→opened→clicked) |
| ✅ `team_invite_requests` (⬜ +items 4,9k) | 2,5k | convites em lote |
| ✅ `master_user_snapshots` | 2,4k | snapshot 15min por master (engajamento do time) |
| ✅ `referral_events` | 8,5k | eventos de indicação (`referrals` = 0, morta) |
| 💀 `team_invites`, `invite_campaigns`, `campaign_invites`, `invite_analytics_events` | 0 | mortas |

### Entrada, onboarding e erros
| Tabela | Linhas | Papel |
| --- | --- | --- |
| ✅ `onboarding_final` | 15k | onboarding completo (`time_per_step`, `abandonment_points` jsonb) |
| ✅ `auth_error_telemetry` | 9,9k | erros de login categorizados |
| ✅ `client_error_logs` | 7k | erros JS por tela |
| ⬜ `leads_valley` / `leads_black_friday` / `leads_empreende_icara` | 365/385/88 | captação de leads por campanha (com UTM + invite_id) |
| 💀 `onboarding_step_tracking`, `onboarding_abandonment_points` | 0 | mortas (dado equivalente no jsonb de onboarding_final) |

### Mentoria e eventos
| Tabela | Linhas | Papel |
| --- | --- | --- |
| ✅ `events` | 1,1k | eventos/mentorias (recorrência, mentor, sala Daily) |
| ✅ `event_participants` | 10k | presença (check-in, tempo em sala) |
| ✅ `mentorship_sessions` | 987 | sessões Daily.co (participantes, pico, duração) |
| ⬜ `mentors` (16), `mentor_ratings` (1,8k), `mentor_cases` (3,5k), `mentorship_credits`/`_transactions` (7,4k), `individual_mentorship_bookings`, `mentorship_monthly_subscriptions`, `tickets`/`ticket_types` | — | economia de créditos/avaliações (módulo futuro) |

### Comunidade, networking e ferramentas
| Tabela | Linhas | Papel |
| --- | --- | --- |
| ✅ `community_topics` / `community_posts` | 105/162 | fórum (volume baixo) |
| ✅ `tools` | 165 | glossário de ferramentas + benefícios |
| ⬜ networking: `member_connections` (1,2k), `network_matches`, `strategic_matches_v2` (6k), `networking_*` | — | módulo futuro |
| ⬜ `suggestions` + votos/comentários | 40 | feedback de produto (baixo volume) |

### Receita 💰
| Tabela | Linhas | Papel |
| --- | --- | --- |
| ⬜ `hubla_webhooks` | 3,5k | **webhooks de pagamento crus** — a view `bi_receita_hubla` extrai valor por fatura (`payload.invoice.amount.totalCents`). Fonte de receita/LTV real. Candidata a espelhar quando fizermos módulo de receita |
| ⬜ `renewal_logs`, `credit_checkout_links`, `addon_catalog`, `user_addons`, `coupons` | — | renovações/addons |

### Segurança e infra (fase "saúde da plataforma")
`security_logs` (114k) · `security_events` (12,6k) · `security_incidents` (1,5k) · `rate_limits` (16,6k) · `blocked_ips` · `email_queue` (3,8k) · `webhook_logs` — mapeadas, não espelhadas.

### 🗄️ Nunca consumir (backups/operacionais)
`_backup_convidado_org_20260707`, `ghost_auth_cleanup_20260715`, `whatsapp_backfill_20260805`, `_rls_policies_backup_20251029`, `video_id_backup`, `invite_backups`, `user_backups`, `onboarding_backups`, `master_member_backup`, `member_entitlement_backup`, `networking_opportunities_backup`, `profile_cache`, `translations`/`translation_settings`, schemas `backup`/`_backup`/`archive`/`meta`.

## 4. Relacionamentos-chave (grafo de FKs)

- `profiles.id → auth.users` · `profiles.organization_id → organizations` · `profiles.subscription_plan_id → subscription_plans` · `profiles.role_id → user_roles`
- `organizations.master_user_id → profiles` (dono) · `organization_admins.{organization_id,user_id}` (co-masters)
- Learning: `learning_modules.course_id → learning_courses` → `learning_lessons.module_id` → `learning_lesson_videos.lesson_id` / `learning_progress.lesson_id` / `learning_lesson_nps.lesson_id`; `learning_certificates.course_id`; `video_transcripts.video_id → learning_lesson_videos`
- Soluções: `progress.solution_id → solutions` · `implementation_tab_progress.solution_id → solutions` · `solutions.area_id/sector_id → solution_areas/sectors`
- Builder: `builder_v2_step_generations.solution_id → ai_generated_solutions` (idem v3/attempts/jobs)
- Consultor: `consultor_messages.thread_id → consultor_threads`; `consultor_journey.message_id → consultor_messages`
- Convites: `invites.created_by/used_by_user_id → auth.users` · `invites.organization_id → organizations` · `invite_deliveries.invite_id → invites`
- Mentoria: `event_participants.event_id → events` · `mentorship_sessions.event_id → events` · `events.mentor_id → mentors → profiles`
- ⚠️ `user_activity_tracking` e `analytics` não têm FK para profiles em algumas rotas (analytics.user_id → auth.users) — joins por uuid funcionam normalmente.

## 5. Enums (10)

`solution_category` (Receita, Operacional, Estratégia, Vendas, Marketing, Juridico, RH, Atendimento e CS, Modelos de IA, Financeiro, Outros) · `difficulty_level` (beginner/intermediate/advanced) · `difficulty_level_new` (easy/medium/advanced) · `consultor_planejamento_status` (gathering/generating/ready/error) · `connection_status` · `referral_status` · `suggestion_status` · `notification_type` · `vote_type` · `solution_category_bkp` (legado).

## 6. Views (37) — as que importam para o BI

| View | O que define |
| --- | --- |
| `bi_cohort_base` | **regra oficial de "cliente"** (exclusões + cohort mensal) — já herdada no nosso `dim_usuario.e_cliente` |
| `bi_dau_mau` | DAU/MAU sobre `analytics` (pageviews), TZ São Paulo |
| `bi_churn_cohort` | churn = status inactive OU last_active > 90 dias |
| `bi_ltv_cohort` + `bi_receita_hubla` | receita real por cohort via webhooks Hubla |
| `bi_frequencia_uso` / `bi_uso_vs_consumo` | frequência mensal por tipo de ação; uso vs consumo |
| `daily_activity_metrics` / `user_activity_summary` / `user_engagement_ranking` / `user_engagement_scores` | agregações de atividade e score de engajamento |
| `builder_analytics` / `solution_implementation_counts` / `organization_health` | agregações por módulo |
| família `*_external` (13) | contratos do pipeline BI legado (`bi_pull_club_*` → db_bi_platform) — úteis como especificação, não consumir |
| demais (`profiles_safe`, `admin_all_comments`…) | operacionais do app |

## 7. Payloads JSONB (medidos em amostra recente)

| Campo | Chaves |
| --- | --- |
| `analytics.event_data` | `path`, `referrer`, `timestamp`, `user_agent` |
| `uat.activity_data` (lesson_completed) | `lesson_id`, `progress_id` |
| `uat.activity_data` (solution_viewed) | `solution_id`, `title`, `category` |
| `uat.activity_data` (solution_completed / builder_solution_created) | `solution_id`, `title` |
| `uat.activity_data` (consultor_ia_message) | `thread_id`, `message_id` |
| `uat.activity_data` (certificate_generated) | `certificate_id`, `course_id` |
| `uat.activity_data` (mentorship_booked) | `booking_id` |
| `onboarding_final` | `time_per_step`, `abandonment_points`, blocos de formulário (personal/business/goals…) |

## 8. Correção sobre o discovery inicial

O discovery registrava "jornada por telas não existe". **Errado — corrigido**: `analytics` contém pageviews de TODAS as rotas do app com `path` + `referrer`. A jornada por telas é viável já; instrumentação nova só seria necessária para granularidade de clique-em-elemento (heatmap de botão), não para navegação.

**Janela real dos pageviews (medida por mês):** o tracking de `view` foi ligado em **jul/2026** (318k em jul, ~11k/dia desde então). As únicas 238 linhas anteriores (jun–jul/2025) são `event_type='start'` de um experimento abortado. Consequência para métricas: séries baseadas em navegação começam em jul/2026; a definição de "usuário ativo" do nosso BI (evento de domínio ∪ pageview) tem um degrau de régua em jul/2026 — em janelas ≥90d, o crescimento aparente nessa data é mudança de instrumentação, não de comportamento.
