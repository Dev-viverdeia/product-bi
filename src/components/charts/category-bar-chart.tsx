import { Bar, BarChart, CartesianGrid, Cell, LabelList, ReferenceLine, XAxis, YAxis } from 'recharts'

import { ChartReveal } from '@/components/charts/chart-reveal'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { formatCompact } from '@/lib/format'
import { cn } from '@/lib/utils'

export type CategoryDatum = {
  category: string
  value: number
  /** recua a barra para o cinza de de-ênfase — use para destacar UMA */
  mute?: boolean
  /**
   * Segunda medida da mesma barra, só no tooltip.
   *
   * Existe para o caso em que a barra responde "quanto" e a análise escrita
   * afirma "que proporção" — ou o contrário. Sem este canal, o texto publica um
   * número que o gráfico ancorado não mostra, e o leitor que clicou para
   * conferir não encontra o que veio conferir.
   *
   * Não vira segunda série nem segundo eixo: é anotação. Chega já formatada,
   * com a unidade escrita — o gráfico não sabe se é percentual, real ou minuto.
   */
  nota?: string
}

/**
 * Linha de referência: a meta, a média, o limiar.
 *
 * É o que transforma um gráfico de "quanto" num gráfico de "quanto comparado a
 * quê" — o degrau mais barato da escada de profundidade. Traço tracejado em
 * neutro forte de propósito: referência não é dado, então não pode usar cor de
 * série nem competir com a barra.
 */
export type Referencia = {
  valor: number
  rotulo: string
}

type CategoryBarChartProps = {
  data: CategoryDatum[]
  /** nome da medida — aparece no tooltip ("Sessões", "Receita"…) */
  label: string
  /** 'column' = vertical · 'bar' = horizontal (categorias longas) */
  layout?: 'column' | 'bar'
  valueFormatter?: (value: number) => string
  /** valor no topo/ponta de cada barra (rótulo direto) */
  showValues?: boolean
  /** meta, média ou limiar — no máximo duas, senão vira grade */
  referencias?: Referencia[]
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
  referencias = [],
  className,
}: CategoryBarChartProps) {
  const temMute = data.some((d) => d.mute)
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
              formatter={(value, _name, item) => {
                const nota = (item.payload as CategoryDatum | undefined)?.nota
                return (
                  <>
                    <div
                      className="w-1 shrink-0 self-stretch rounded-[2px]"
                      style={{ background: item.color ?? 'var(--color-value)' }}
                    />
                    <div className="flex flex-1 flex-col gap-1">
                      <div className="flex items-center justify-between gap-4 leading-none">
                        <span className="text-muted-foreground">{label}</span>
                        <span className="text-foreground font-mono font-medium tabular-nums">
                          {valueFormatter(Number(value))}
                        </span>
                      </div>
                      {nota ? (
                        <span className="text-muted-foreground text-xs leading-none">
                          {nota}
                        </span>
                      ) : null}
                    </div>
                  </>
                )
              }}
            />
          }
        />

        {/* Referência entra ANTES da barra para ficar por baixo dela: o dado é
            o que se lê, a meta é o pano de fundo contra o qual se lê. */}
        {referencias.slice(0, 2).map((r) => (
          <ReferenceLine
            key={r.rotulo}
            {...(isColumn ? { y: r.valor } : { x: r.valor })}
            stroke="var(--color-data-referencia)"
            strokeDasharray="4 4"
            strokeWidth={1.5}
            label={{
              value: r.rotulo,
              position: isColumn ? 'insideTopRight' : 'insideTopRight',
              fill: 'var(--color-data-ink)',
              fontSize: 11,
            }}
          />
        ))}

        <Bar
          dataKey="value"
          fill="var(--color-value)"
          maxBarSize={24}
          radius={isColumn ? [4, 4, 0, 0] : [0, 4, 4, 0]}
          isAnimationActive={false}
        >
          {/* Uma Cell por barra só quando há de-ênfase: sem isso o Recharts
              pinta tudo com o fill da série, que é o comportamento normal. */}
          {temMute
            ? data.map((d) => (
                <Cell
                  key={d.category}
                  fill={d.mute ? 'var(--color-data-mute)' : 'var(--color-value)'}
                />
              ))
            : null}
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
