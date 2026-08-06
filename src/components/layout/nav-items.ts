import { LayoutDashboardIcon, PaletteIcon } from 'lucide-react'
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
  { title: 'Design system', to: '/design', icon: PaletteIcon },
]
