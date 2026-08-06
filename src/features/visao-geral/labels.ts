/* Rótulos pt-BR para tipos de evento e rotas da plataforma. */

const TIPOS_EVENTO: Record<string, string> = {
  lesson_completed: 'Aulas concluídas',
  solution_viewed: 'Soluções visualizadas',
  solution_started: 'Soluções iniciadas',
  solution_completed: 'Soluções concluídas',
  consultor_ia_message: 'Mensagens no Consultor',
  builder_solution_created: 'Soluções no Builder',
  certificate_generated: 'Certificados emitidos',
  connection_sent: 'Conexões enviadas',
  connection_accepted: 'Conexões aceitas',
  community_post_created: 'Posts na comunidade',
  community_topic_created: 'Tópicos na comunidade',
  community_comment: 'Comentários na comunidade',
  mentorship_booked: 'Mentorias agendadas',
}

export function labelTipoEvento(tipo: string) {
  return TIPOS_EVENTO[tipo] ?? tipo
}

const ROTAS: Record<string, string> = {
  '/': 'Início',
  '/dashboard': 'Dashboard',
  '/solucoes': 'Soluções',
  '/formacoes': 'Formações',
  '/formacoes/certificados': 'Certificados',
  '/consultor-ia': 'Consultor IA',
  '/mentorias': 'Mentorias',
  '/mentorias-v2': 'Mentorias (v2)',
  '/ferramentas/builder-v2': 'Builder',
  '/ferramentas/builder-v2/historico': 'Builder · histórico',
  '/tools': 'Ferramentas',
  '/login': 'Login',
  '/profile': 'Perfil',
  '/profile/edit': 'Editar perfil',
  '/onboarding': 'Onboarding',
  '/metricas': 'Métricas',
  '/team-management': 'Gestão de time',
  '/convite': 'Convite',
  '/updates': 'Novidades',
}

export function labelRota(path: string) {
  const conhecida = ROTAS[path]
  if (conhecida) return conhecida
  if (path.startsWith('/solucoes/')) return 'Solução (detalhe)'
  if (path.startsWith('/learning/course/')) return 'Aula (player)'
  if (path.startsWith('/formacoes/')) return `Formação: ${path.slice('/formacoes/'.length)}`
  return path.length > 28 ? `${path.slice(0, 27)}…` : path
}
