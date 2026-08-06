import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from 'recharts'

import { ChartReveal } from '@/components/charts/chart-reveal'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { formatCompact } from '@/lib/format'
import { cn } from '@/lib/utils'

export type CategoryDatum = { category: string; value: number }

type CategoryBarChartProps = {
  data: CategoryDatum[]
  /** nome da medida — aparece no tooltip ("Sessões", "Receita"…) */
  label: string
  /** 'column' = vertical · 'bar' = horizontal (categorias longas) */
  layout?: 'column' | 'bar'
  valueFormatter?: (value: number) => string
  /** valor no topo/ponta de cada barra (rótulo direto) */
  showValues?: boolean
  className?: string
}

/**
 * Magnitude por categoria no padrão do DS: barra ≤ 24px, ponta arredondada
 * 4px e base reta ancorada no ZERO, uma medida = um hue, valor na ponta.
 */
export function CategoryBarChart({
  data,
  label,
  layout = 'column',
  valueFormatter = formatCompact,
  showValues = true,
  className,
}: CategoryBarChartProps) {
  const config = {
    value: { label, color: 'var(--color-data-1)' },
  } satisfies ChartConfig

  const isColumn = layout === 'column'

  return (
    <ChartReveal direction={isColumn ? 'up' : 'left'}>
      <ChartContainer
        config={config}
        className={cn('aspect-auto h-[260px] w-full', className)}
      >
        <BarChart
        data={data}
        layout={isColumn ? 'horizontal' : 'vertical'}
        margin={
          isColumn
            ? { top: showValues ? 20 : 8, right: 8, bottom: 0, left: 0 }
            : { top: 0, right: showValues ? 44 : 12, bottom: 0, left: 0 }
        }
        barCategoryGap="28%"
      >
        {isColumn ? (
          <>
            <CartesianGrid vertical={false} stroke="var(--color-data-grid)" />
            <XAxis
              dataKey="category"
              tickLine={false}
              axisLine={{ stroke: 'var(--color-data-axis)' }}
              tickMargin={8}
            />
            <YAxis
              width="auto"
              tickLine={false}
              axisLine={false}
              tickMargin={4}
              tickFormatter={(value: number) => valueFormatter(value)}
            />
          </>
        ) : (
          <>
            <CartesianGrid horizontal={false} stroke="var(--color-data-grid)" />
            <XAxis
              type="number"
              tickLine={false}
              axisLine={{ stroke: 'var(--color-data-axis)' }}
              tickMargin={8}
              tickFormatter={(value: number) => valueFormatter(value)}
            />
            <YAxis
              dataKey="category"
              type="category"
              width="auto"
              tickLine={false}
              axisLine={false}
              tickMargin={6}
            />
          </>
        )}

        <ChartTooltip
          cursor={{ fill: 'var(--color-data-grid)' }}
          content={
            <ChartTooltipContent
              formatter={(value, _name, item) => (
                <>
                  <div
                    className="w-1 shrink-0 self-stretch rounded-[2px]"
                    style={{ background: item.color ?? 'var(--color-value)' }}
                  />
                  <div className="flex flex-1 items-center justify-between gap-4 leading-none">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="text-foreground font-mono font-medium tabular-nums">
                      {valueFormatter(Number(value))}
                    </span>
                  </div>
                </>
              )}
            />
          }
        />

        <Bar
          dataKey="value"
          fill="var(--color-value)"
          maxBarSize={24}
          radius={isColumn ? [4, 4, 0, 0] : [0, 4, 4, 0]}
          isAnimationActive={false}
        >
          {showValues ? (
            <LabelList
              dataKey="value"
              position={isColumn ? 'top' : 'right'}
              offset={8}
              formatter={(label: unknown) => valueFormatter(Number(label))}
              fill="var(--color-muted-foreground)"
              fontSize={11}
            />
          ) : null}
        </Bar>
        </BarChart>
      </ChartContainer>
    </ChartReveal>
  )
}
