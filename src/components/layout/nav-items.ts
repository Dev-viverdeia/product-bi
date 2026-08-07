import {
  CompassIcon,
  GraduationCapIcon,
  LayoutDashboardIcon,
  PaletteIcon,
  PuzzleIcon,
  UserPlusIcon,
  UsersIcon,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type NavItem = {
  title: string
  to: string
  icon: LucideIcon
  /** rota é ativa por prefixo (útil para páginas de detalhe) */
  matchPrefix?: boolean
}

/** Ponto único para registrar novas seções do produto. */
export const navItems: NavItem[] = [
  { title: 'Visão geral', to: '/', icon: LayoutDashboardIcon },
  { title: 'Clientes', to: '/clientes', icon: UsersIcon },
  { title: 'Entrada', to: '/entrada', icon: UserPlusIcon },
  { title: 'Formações', to: '/formacoes', icon: GraduationCapIcon },
  { title: 'Soluções', to: '/solucoes', icon: PuzzleIcon },
  { title: 'Consultor & Builder', to: '/ia', icon: CompassIcon },
  { title: 'Design system', to: '/design', icon: PaletteIcon },
]
