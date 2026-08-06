import { useId } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from 'recharts'

import { ChartReveal } from '@/components/charts/chart-reveal'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { formatCompact } from '@/lib/format'
import { cn } from '@/lib/utils'

export type TimeSeriesPoint = { x: string } & Record<string, string | number>

export type TimeSeriesSeries = {
  /** chave numérica no ponto de dado */
  dataKey: string
  label: string
}

type TimeSeriesChartProps = {
  data: TimeSeriesPoint[]
  /**
   * Regra do DS, garantida por tipo: no máximo 2 séries.
   * 1 série → sem legenda (o título do card nomeia).
   * 2 séries → 2ª série tracejada (segundo canal) + legenda + rótulo direto no fim.
   * 3+ séries → NÃO existe aqui: use small multiples (vários cards) ou "Outros".
   */
  series: readonly [TimeSeriesSeries] | readonly [TimeSeriesSeries, TimeSeriesSeries]
  variant?: 'line' | 'area'
  xTickFormatter?: (value: string) => string
  valueFormatter?: (value: number) => string
  className?: string
}

/* Chaves de legenda espelham a marca: linha cheia p/ série 1, tracejada p/ série 2 */
function SolidLineKey() {
  return (
    <svg viewBox="0 0 12 12" fill="none" aria-hidden>
      <path d="M1 6h10" stroke="var(--color-s1)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function DashedLineKey() {
  return (
    <svg viewBox="0 0 12 12" fill="none" aria-hidden>
      <path
        d="M1 6h10"
        stroke="var(--color-s2)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="3 2.4"
      />
    </svg>
  )
}

type DotProps = { cx?: number; cy?: number; index?: number }

/** Marcador de fim de linha (r ≥ 4) com anel de 2px na cor da superfície. */
function renderEndDot(
  props: DotProps,
  lastIndex: number,
  color: string,
  keyPrefix: string,
) {
  const { cx, cy, index } = props
  if (index !== lastIndex || cx == null || cy == null) {
    return <g key={`${keyPrefix}-${index}`} />
  }
  return (
    <circle
      key={`${keyPrefix}-${index}`}
      cx={cx}
      cy={cy}
      r={4.5}
      fill={color}
      stroke="var(--color-card)"
      strokeWidth={2}
    />
  )
}

/**
 * Série temporal (linha ou área) no padrão do DS: linha 2px, grade recessiva
 * sólida, um eixo só, crosshair + tooltip com todas as séries, animação de
 * entrada com easing da casa.
 */
export function TimeSeriesChart({
  data,
  series,
  variant = 'line',
  xTickFormatter,
  valueFormatter = formatCompact,
  className,
}: TimeSeriesChartProps) {
  const gradientId = useId()
  const hasTwoSeries = series.length === 2
  const lastIndex = data.length - 1

  const config = {
    s1: { label: series[0].label, color: 'var(--color-data-1)', icon: SolidLineKey },
    ...(hasTwoSeries
      ? {
          s2: {
            label: series[1]!.label,
            color: 'var(--color-data-2)',
            icon: DashedLineKey,
          },
        }
      : {}),
  } satisfies ChartConfig

  const normalized = data.map((point) => {
    const next: Record<string, string | number> = { x: point.x, s1: point[series[0].dataKey] }
    if (hasTwoSeries) next.s2 = point[series[1]!.dataKey]
    return next
  })

  const axes = (
    <>
      <CartesianGrid vertical={false} stroke="var(--color-data-grid)" />
      <XAxis
        dataKey="x"
        tickLine={false}
        axisLine={{ stroke: 'var(--color-data-axis)' }}
        tickMargin={8}
        minTickGap={28}
        tickFormatter={xTickFormatter}
      />
      <YAxis
        width="auto"
        tickLine={false}
        axisLine={false}
        tickMargin={4}
        tickFormatter={(value: number) => valueFormatter(value)}
      />
      <ChartTooltip
        content={
          <ChartTooltipContent
            /* "dot" só para desativar o nesting do label (o formatter abaixo
               desenha a própria chave de linha) — o header do mês sempre aparece */
            indicator="dot"
            labelFormatter={(_, payload) => {
              const x = payload?.[0]?.payload?.x as string | undefined
              return x && xTickFormatter ? xTickFormatter(x) : x
            }}
            /* valores lideram, com o formatador do gráfico; identidade via chave de linha */
            formatter={(value, name, item) => (
              <>
                <div
                  className="w-1 shrink-0 self-stretch rounded-[2px]"
                  style={{ background: item.color }}
                />
                <div className="flex flex-1 items-center justify-between gap-4 leading-none">
                  <span className="text-muted-foreground">
                    {config[name as keyof typeof config]?.label ?? name}
                  </span>
                  <span className="text-foreground font-mono font-medium tabular-nums">
                    {valueFormatter(Number(value))}
                  </span>
                </div>
              </>
            )}
          />
        }
      />
      {hasTwoSeries ? <ChartLegend content={<ChartLegendContent />} /> : null}
    </>
  )

  const margin = { top: 8, right: 12, bottom: 0, left: 0 }

  return (
    <ChartReveal direction="left">
      <ChartContainer config={config} className={cn('aspect-auto h-[260px] w-full', className)}>
      {variant === 'area' ? (
        <AreaChart data={normalized} margin={margin}>
          <defs>
            {/* wash da série: o próprio hue a ~10% — nunca bloco saturado */}
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-s1)" stopOpacity={0.14} />
              <stop offset="100%" stopColor="var(--color-s1)" stopOpacity={0.03} />
            </linearGradient>
          </defs>
          {axes}
          <Area
            dataKey="s1"
            type="monotone"
            stroke="var(--color-s1)"
            strokeWidth={2}
            strokeLinecap="round"
            fill={`url(#${gradientId})`}
            dot={(props: DotProps) => renderEndDot(props, lastIndex, 'var(--color-s1)', 'a1')}
            activeDot={{ r: 5, strokeWidth: 2, stroke: 'var(--color-card)' }}
            isAnimationActive={false}
          />
          {hasTwoSeries ? (
            <Area
              dataKey="s2"
              type="monotone"
              stroke="var(--color-s2)"
              strokeWidth={2}
              strokeLinecap="round"
              strokeDasharray="6 4"
              fill="transparent"
              dot={(props: DotProps) => renderEndDot(props, lastIndex, 'var(--color-s2)', 'a2')}
              activeDot={{ r: 5, strokeWidth: 2, stroke: 'var(--color-card)' }}
              isAnimationActive={false}
            />
          ) : null}
        </AreaChart>
      ) : (
        <LineChart data={normalized} margin={margin}>
          {axes}
          <Line
            dataKey="s1"
            type="monotone"
            stroke="var(--color-s1)"
            strokeWidth={2}
            strokeLinecap="round"
            dot={(props: DotProps) => renderEndDot(props, lastIndex, 'var(--color-s1)', 'l1')}
            activeDot={{ r: 5, strokeWidth: 2, stroke: 'var(--color-card)' }}
            isAnimationActive={false}
          />
          {hasTwoSeries ? (
            <Line
              dataKey="s2"
              type="monotone"
              stroke="var(--color-s2)"
              strokeWidth={2}
              strokeLinecap="round"
              strokeDasharray="6 4"
              dot={(props: DotProps) => renderEndDot(props, lastIndex, 'var(--color-s2)', 'l2')}
              activeDot={{ r: 5, strokeWidth: 2, stroke: 'var(--color-card)' }}
              isAnimationActive={false}
            />
          ) : null}
        </LineChart>
      )}
      </ChartContainer>
    </ChartReveal>
  )
}
