import type { ReactNode } from 'react'
import { CheckIcon, CircleIcon, TriangleAlertIcon, XIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * Pill de status — bom / atenção / crítico / neutro.
 *
 * Regras que não são estéticas:
 *
 * - **Cor de status é reservada.** Verde e coral existem só para estado; não
 *   podem virar "categoria 4" num gráfico. É regra do DS e da skill dataviz.
 * - **Nunca só cor.** Cada tom traz ícone e rótulo — quem não distingue
 *   verde de vermelho precisa ler o estado do mesmo jeito. Por isso o ícone
 *   não é decorativo e não pode ser removido "porque polui".
 * - **`atencao` usa neutro forte, não âmbar.** O DS bane âmbar/gold, então o
 *   degrau intermediário é resolvido por peso (borda + texto sólido), não por
 *   uma cor nova. Se o âmbar for liberado um dia, é aqui que ele entra.
 */
const tons = {
  bom: 'bg-success/10 text-success border-success/20',
  atencao: 'bg-foreground/[0.06] text-foreground border-foreground/15',
  critico: 'bg-destructive/10 text-destructive border-destructive/20',
  neutro: 'bg-muted text-muted-foreground border-transparent',
} as const

const icones = {
  bom: CheckIcon,
  atencao: TriangleAlertIcon,
  critico: XIcon,
  neutro: CircleIcon,
} as const

export type TomDeStatus = keyof typeof tons

export function StatusPill({
  tom,
  children,
  className,
}: {
  tom: TomDeStatus
  children: ReactNode
  className?: string
}) {
  const Icone = icones[tom]

  return (
    <span
      className={cn(
        // 11px e peso 500, sem uppercase e sem bolinha decorativa — regra de pill do DS
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap',
        tons[tom],
        className,
      )}
    >
      <Icone aria-hidden className="size-3 shrink-0" />
      {children}
    </span>
  )
}
