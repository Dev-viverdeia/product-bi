import { useMemo } from 'react'
import { Cell, Label, Pie, PieChart } from 'recharts'

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

export type DonutDatum = { name: string; value: number }

type DonutChartProps = {
  data: DonutDatum[]
  /** legenda do total no centro: "assinaturas", "sessões"… */
  totalLabel: string
  valueFormatter?: (value: number) => string
  className?: string
}

const MAX_SLICES = 5
const RAMP = [
  'var(--color-chart-1)',
  'var(--color-chart-2)',
  'var(--color-chart-3)',
  'var(--color-chart-4)',
  'var(--color-chart-5)',
]

/**
 * Composição (parte-de-um-todo) com a rampa navy do DS.
 * A rampa é ORDENADA: fatias sempre em ordem decrescente de valor, máximo de
 * 5 — o excedente agrega em "Outros" (regra aplicada aqui, não opcional).
 * Identidade nunca depende só do hue: legenda + tooltip sempre presentes.
 */
export function DonutChart({
  data,
  totalLabel,
  valueFormatter = formatCompact,
  className,
}: DonutChartProps) {
  const { slices, config, total } = useMemo(() => {
    const sorted = [...data].sort((a, b) => b.value - a.value)
    const head = sorted.slice(0, MAX_SLICES - 1)
    const tail = sorted.slice(MAX_SLICES - 1)
    const rows =
      tail.length > 1
        ? [...head, { name: 'Outros', value: tail.reduce((sum, d) => sum + d.value, 0) }]
        : sorted

    const slices = rows.map((row, i) => ({ ...row, key: `slice${i + 1}` }))
    const config = Object.fromEntries(
      slices.map((slice, i) => [slice.key, { label: slice.name, color: RAMP[i] }]),
    ) satisfies ChartConfig
    const total = rows.reduce((sum, d) => sum + d.value, 0)

    return { slices, config, total }
  }, [data])

  return (
    <ChartReveal direction="scale">
      <ChartContainer
        config={config}
        className={cn('mx-auto aspect-auto h-[260px] w-full', className)}
      >
        <PieChart>
        <ChartTooltip
          content={
            <ChartTooltipContent
              nameKey="key"
              hideLabel
              formatter={(value, name, item) => (
                <>
                  <div
                    className="w-1 shrink-0 self-stretch rounded-[2px]"
                    style={{ background: (item.payload as { fill?: string })?.fill }}
                  />
                  <div className="flex flex-1 items-center justify-between gap-4 leading-none">
                    <span className="text-muted-foreground">
                      {config[String(name)]?.label ?? name}
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
        <Pie
          data={slices}
          dataKey="value"
          nameKey="key"
          innerRadius="62%"
          outerRadius="88%"
          paddingAngle={2}
          cornerRadius={3}
          strokeWidth={0}
          isAnimationActive={false}
        >
          {slices.map((slice, i) => (
            <Cell key={slice.key} fill={RAMP[i]} />
          ))}
          <Label
            content={({ viewBox }) => {
              if (!viewBox || !('cx' in viewBox) || viewBox.cx == null || viewBox.cy == null) {
                return null
              }
              return (
                <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle">
                  <tspan
                    x={viewBox.cx}
                    y={viewBox.cy - 4}
                    className="fill-foreground text-2xl font-semibold"
                  >
                    {valueFormatter(total)}
                  </tspan>
                  <tspan
                    x={viewBox.cx}
                    y={viewBox.cy + 16}
                    className="fill-muted-foreground text-xs"
                  >
                    {totalLabel}
                  </tspan>
                </text>
              )
            }}
          />
        </Pie>
        {/* flex-wrap: com 5 fatias a legenda estoura o card em 375px */}
        <ChartLegend
          content={<ChartLegendContent nameKey="key" className="flex-wrap gap-y-1.5" />}
        />
        </PieChart>
      </ChartContainer>
    </ChartReveal>
  )
}
