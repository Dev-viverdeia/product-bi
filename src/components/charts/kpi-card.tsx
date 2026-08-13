import { useEffect, useState } from 'react'
import type { ComponentType, ReactNode } from 'react'
import { animate, useReducedMotion } from 'motion/react'
import * as motion from 'motion/react-client'
import { AlertCircleIcon, InfoIcon, TrendingDownIcon, TrendingUpIcon } from 'lucide-react'

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

type IconeKpi = ComponentType<{ className?: string; strokeWidth?: number }>

type KpiCardProps = {
  label: string
  /** `null` = a régua do dado suprimiu o valor — o tile mostra travessão */
  value: number | null
  /** formatador do valor — padrão compacto pt-BR */
  format?: (value: number) => string
  delta?: KpiDelta
  /**
   * Ícone da métrica, num tile à esquerda.
   *
   * Serve para achar o tile de relance numa fileira de quatro, não para
   * decorar: é o mesmo ícone que o módulo usa no rail e no cabeçalho do card
   * correspondente. Opcional — tile sem par no resto da tela é ruído.
   */
  icone?: IconeKpi
  /** série curta (~12 pontos) para o sparkline de tendência */
  trend?: number[]
  isLoading?: boolean
  /**
   * Sem isto o tile mostra o valor de fallback — quase sempre `?? 0` — quando a
   * consulta falha, e zero é indistinguível de "não carregou". Num painel
   * executivo isso é pior que erro: é número errado com cara de certo.
   */
  isError?: boolean
  /**
   * Por que não há valor (ex.: `notaAmostra(n)` quando a RPC suprime percentual
   * com denominador < 30). Não é erro: é a régua se declarando — sem o motivo,
   * o travessão viraria mistério.
   */
  motivoSemValor?: string
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
 * Casca comum aos quatro estados do tile.
 *
 * Existe para o tile de erro e o de valor suprimido terem a MESMA anatomia do
 * normal — mesma altura, mesmo tile de ícone, mesmo lugar do rótulo. Quando
 * cada estado montava a própria casca, o de erro encolhia e a fileira de KPIs
 * ficava desalinhada justamente na tela em que algo deu errado.
 */
function Casca({
  icone: Icone,
  children,
  className,
}: {
  icone?: IconeKpi
  children: ReactNode
  className?: string
}) {
  return (
    <Card className={cn('glass-card h-full', className)}>
      <CardContent className="flex h-full items-start gap-4">
        {Icone ? (
          <span className="bg-controle text-foreground flex size-12 shrink-0 items-center justify-center rounded-md">
            <Icone className="size-5" strokeWidth={1.75} />
          </span>
        ) : null}
        <div className="flex min-w-0 flex-1 flex-col gap-1">{children}</div>
      </CardContent>
    </Card>
  )
}

/**
 * Stat tile do DS: rótulo · valor (count-up, figuras proporcionais) ·
 * delta assinado vs período nomeado · sparkline opcional.
 *
 * O delta é **colorido pelo sentido**, não por convenção fixa: `upIsGood`
 * decide, então churn subindo fica coral e retenção subindo fica verde. Uma
 * versão do mockup trazia o delta numa pílula escura neutra, e ela foi recusada
 * de propósito — a pílula neutra apaga a única informação que o delta carrega
 * além da magnitude, que é se aquilo é boa ou má notícia. Pior: no mockup a
 * mesma pílula vestia um delta e uma participação, dois números de natureza
 * diferente com a mesma roupa.
 */
export function KpiCard({
  label,
  value,
  format = formatCompact,
  delta,
  icone,
  trend,
  isLoading = false,
  isError = false,
  motivoSemValor,
  className,
}: KpiCardProps) {
  const reducedMotion = useReducedMotion()
  const displayed = useCountUp(
    value ?? 0,
    !reducedMotion && !isLoading && !isError && value != null,
  )

  if (isLoading) {
    return (
      <Casca icone={icone} className={className}>
        <Skeleton className="h-3.5 w-24 rounded-md" />
        <Skeleton className="h-8 w-32 rounded-md" />
        <Skeleton className="h-3.5 w-36 rounded-md" />
      </Casca>
    )
  }

  if (isError) {
    return (
      <Casca icone={icone} className={className}>
        <p className="text-muted-foreground text-xs">{label}</p>
        {/* travessão, não zero: a mesma convenção que o resto do produto usa
            para "não há valor" */}
        <p className="num text-3xl leading-none font-semibold tracking-tight">—</p>
        <p className="text-muted-foreground flex items-center gap-1 text-xs">
          <AlertCircleIcon className="size-3.5" />
          não foi possível carregar
        </p>
      </Casca>
    )
  }

  if (value == null) {
    return (
      <motion.div variants={gridItem} className="h-full">
        <Casca icone={icone} className={className}>
          <p className="text-muted-foreground text-xs">{label}</p>
          <p className="num text-3xl leading-none font-semibold tracking-tight">—</p>
          {motivoSemValor ? (
            <p className="text-muted-foreground flex items-center gap-1 text-xs">
              <InfoIcon className="size-3.5 shrink-0" />
              {motivoSemValor}
            </p>
          ) : null}
        </Casca>
      </motion.div>
    )
  }

  const isPositive = delta ? delta.value > 0 : false
  const isNeutral = delta ? delta.value === 0 : true
  const isGood = delta ? (delta.upIsGood ?? true) === isPositive : false

  return (
    <motion.div variants={gridItem} className="h-full">
      <Casca icone={icone} className={className}>
        {/* rótulo um degrau abaixo do delta: ele identifica, o número responde */}
        <p className="text-muted-foreground text-xs">{label}</p>

        {/* Figuras proporcionais de propósito: tabular-nums é só para colunas */}
        <p className="text-3xl font-semibold tracking-tight">{format(displayed)}</p>

        {delta ? (
          <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs">
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
      </Casca>
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
