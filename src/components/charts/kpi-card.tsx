import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { animate, useReducedMotion } from 'motion/react'
import * as motion from 'motion/react-client'
import { AlertCircleIcon,TrendingDownIcon, TrendingUpIcon } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Sparkline } from '@/components/charts/sparkline'
import { formatCompact, formatSignedPercent } from '@/lib/format'
import { cn } from '@/lib/utils'

/** Anima o número de 0 → valor no mount; respeita prefers-reduced-motion. */
function useCountUp(target: number, enabled: boolean) {
  const [animated, setAnimated] = useState(0)

  useEffect(() => {
    if (!enabled) return
    // onUpdate é callback do sistema de animação (externo) — setState permitido
    const controls = animate(0, target, {
      duration: 0.9,
      ease: [0.16, 1, 0.3, 1], // --via-ease-out
      onUpdate: setAnimated,
    })
    return () => controls.stop()
  }, [target, enabled])

  return enabled ? animated : target
}

export type KpiDelta = {
  /** variação como fração: 0.042 = +4,2% */
  value: number
  /** período de comparação nomeado: "vs mês anterior" */
  vs: string
  /** subir é bom? (churn: false) — decide a cor junto com a direção */
  upIsGood?: boolean
}

type KpiCardProps = {
  label: string
  value: number
  /** formatador do valor — padrão compacto pt-BR */
  format?: (value: number) => string
  delta?: KpiDelta
  /** série curta (~12 pontos) para o sparkline de tendência */
  trend?: number[]
  isLoading?: boolean
  /**
   * Sem isto o tile mostra o valor de fallback — quase sempre `?? 0` — quando a
   * consulta falha, e zero é indistinguível de "não carregou". Num painel
   * executivo isso é pior que erro: é número errado com cara de certo.
   */
  isError?: boolean
  className?: string
}

const gridItem = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] as const },
  },
}

/**
 * Stat tile do DS: label · valor (count-up, figuras proporcionais) ·
 * delta assinado vs período nomeado · sparkline opcional.
 */
export function KpiCard({
  label,
  value,
  format = formatCompact,
  delta,
  trend,
  isLoading = false,
  isError = false,
  className,
}: KpiCardProps) {
  const reducedMotion = useReducedMotion()
  const displayed = useCountUp(value, !reducedMotion && !isLoading && !isError)

  if (isLoading) {
    return (
      <Card className={cn('glass-card', className)}>
        <CardContent className="space-y-3">
          <Skeleton className="h-3.5 w-24 rounded-md" />
          <Skeleton className="h-8 w-32 rounded-md" />
          <Skeleton className="h-3.5 w-36 rounded-md" />
        </CardContent>
      </Card>
    )
  }

  if (isError) {
    return (
      <Card className={cn('glass-card h-full', className)}>
        <CardContent className="flex h-full flex-col gap-1">
          <p className="text-muted-foreground text-xs">{label}</p>
          {/* travessão, não zero: a mesma convenção que o resto do produto usa
              para "não há valor" */}
          <p className="num text-3xl leading-none font-semibold tracking-tight">—</p>
          <p className="text-muted-foreground flex items-center gap-1 text-xs">
            <AlertCircleIcon className="size-3.5" />
            não foi possível carregar
          </p>
        </CardContent>
      </Card>
    )
  }

  const isPositive = delta ? delta.value > 0 : false
  const isNeutral = delta ? delta.value === 0 : true
  const isGood = delta ? (delta.upIsGood ?? true) === isPositive : false

  return (
    <motion.div variants={gridItem} className="h-full">
      <Card className={cn('glass-card h-full', className)}>
        <CardContent className="flex h-full flex-col gap-1">
          {/* rótulo um degrau abaixo do delta: ele identifica, o número responde */}
          <p className="text-muted-foreground text-xs">{label}</p>

          {/* Figuras proporcionais de propósito: tabular-nums é só para colunas */}
          <p className="text-3xl font-semibold tracking-tight">
            {format(displayed)}
          </p>

          {delta ? (
            <p className="flex items-center gap-1 text-xs">
              <span
                className={cn(
                  'inline-flex items-center gap-0.5 font-medium',
                  isNeutral
                    ? 'text-muted-foreground'
                    : isGood
                      ? 'text-success'
                      : 'text-destructive',
                )}
              >
                {isNeutral ? null : isPositive ? (
                  <TrendingUpIcon className="size-3.5" aria-hidden />
                ) : (
                  <TrendingDownIcon className="size-3.5" aria-hidden />
                )}
                {formatSignedPercent(delta.value)}
              </span>
              <span className="text-muted-foreground">{delta.vs}</span>
            </p>
          ) : null}

          {trend && trend.length > 1 ? (
            <div className="mt-auto pt-2">
              <Sparkline data={trend} />
            </div>
          ) : null}
        </CardContent>
      </Card>
    </motion.div>
  )
}

/** Grid de KPIs com entrada escalonada. */
export function KpiGrid({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.07 } } }}
      className={cn('grid gap-4 sm:grid-cols-2 xl:grid-cols-4', className)}
    >
      {children}
    </motion.div>
  )
}
