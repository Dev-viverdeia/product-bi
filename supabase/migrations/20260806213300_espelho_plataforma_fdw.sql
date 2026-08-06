-- Espelho (foreign tables) do banco da plataforma no schema `plataforma`.
-- Pré-requisito fora de migration: user mapping do role postgres no servidor
-- plataforma_srv (criado manualmente — credencial nunca toca o repositório).
-- Conexão via session pooler (IPv4): a rota direta db.<ref>.supabase.co (IPv6)
-- não fecha entre projetos aqui — não "corrigir" de volta.

alter server plataforma_srv options (set host 'aws-0-sa-east-1.pooler.supabase.com');

do $$
begin
  alter server plataforma_srv options (add connect_timeout '8');
exception
  when duplicate_object then null;
end $$;

-- Único enum remoto usado pelas tabelas espelhadas (import exige o tipo local
-- homônimo). Se a plataforma criar novos enums, replicar aqui antes de importar.
do $$
begin
  create type public.consultor_planejamento_status as enum ('gathering','generating','ready','error');
exception
  when duplicate_object then null;
end $$;

import foreign schema public limit to (
  -- usuários, papéis, planos e orgs
  profiles, user_roles, subscription_plans, plan_features, organizations, organization_admins,
  -- atividade e eventos
  user_activity_tracking, analytics, user_presence, audit_logs, benefit_clicks,
  -- formações
  learning_courses, learning_modules, learning_lessons, learning_lesson_videos,
  course_durations, learning_progress, learning_certificates, learning_lesson_nps,
  learning_lesson_ratings, lesson_tags, learning_lesson_tags, video_transcripts,
  -- soluções
  solutions, solution_areas, solution_sectors, progress, implementation_tab_progress,
  solution_ratings, solution_favorites, implementation_requests, solution_certificates,
  -- builder
  ai_generated_solutions, ai_solution_usage, builder_v2_step_generations,
  builder_success_logs, builder_v3_task_progress, builder_analysis_attempts,
  -- consultor
  consultor_threads, consultor_messages, consultor_journey, consultor_ia_token_usage,
  consultor_planejamentos,
  -- convites, masters e indicações
  invites, invite_deliveries, invite_delivery_events, team_invite_requests,
  master_user_snapshots, referral_events,
  -- entrada e erros
  onboarding_final, auth_error_telemetry, client_error_logs,
  -- eventos de comunidade/mentoria e ferramentas
  events, event_participants, mentorship_sessions, community_topics, community_posts, tools
) from server plataforma_srv into plataforma;
