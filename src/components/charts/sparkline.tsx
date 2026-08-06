import { Line, LineChart, ResponsiveContainer } from 'recharts'

import { ChartReveal } from '@/components/charts/chart-reveal'

/**
 * Sparkline de 12 pontos para stat tiles: tendência no tom de de-ênfase da
 * rampa, período atual marcado com a cor de série (accent).
 */
export function Sparkline({ data }: { data: number[] }) {
  const points = data.map((y, i) => ({ i, y }))
  const lastIndex = points.length - 1

  return (
    <ChartReveal direction="left" className="h-9 w-full" aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={points}
          margin={{ top: 4, right: 6, bottom: 4, left: 2 }}
        >
          <Line
            dataKey="y"
            type="monotone"
            stroke="var(--color-chart-3)"
            strokeWidth={2}
            strokeLinecap="round"
            isAnimationActive={false}
            dot={(props: { cx?: number; cy?: number; index?: number }) => {
              const { cx, cy, index } = props
              if (index !== lastIndex || cx == null || cy == null) {
                return <g key={`spark-${index}`} />
              }
              // marcador do período atual: cor de série + anel na cor da superfície
              return (
                <circle
                  key={`spark-${index}`}
                  cx={cx}
                  cy={cy}
                  r={3.5}
                  fill="var(--color-data-1)"
                  stroke="var(--color-card)"
                  strokeWidth={2}
                />
              )
            }}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartReveal>
  )
}
