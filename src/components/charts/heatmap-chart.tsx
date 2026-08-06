import { useMemo } from 'react'

import { ChartReveal } from '@/components/charts/chart-reveal'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { formatCompact } from '@/lib/format'
import { cn } from '@/lib/utils'

export type HeatmapDatum = {
  /** 0 = domingo … 6 = sábado */
  dia: number
  /** 0–23 */
  hora: number
  valor: number
}

type HeatmapChartProps = {
  data: HeatmapDatum[]
  /** nome da medida no tooltip ("pageviews", "eventos"…) */
  label: string
  valueFormatter?: (value: number) => string
  className?: string
}

/* Semana exibida de segunda a domingo (leitura pt-BR) */
const ORDEM_DIAS = [1, 2, 3, 4, 5, 6, 0]
const NOME_DIA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const HORAS_ROTULADAS = [0, 6, 12, 18]

/* Sequencial = UM hue por alfa: claro→escuro no light, discreto→brilhante no
   dark, sem regra por tema. 5 degraus + zero (regra do DS p/ sequencial). */
const ALFAS = [0.14, 0.3, 0.5, 0.74, 1]

function nivel(valor: number, max: number) {
  if (valor <= 0 || max <= 0) return -1
  return Math.min(ALFAS.length - 1, Math.floor((valor / max) * ALFAS.length))
}

/**
 * Heatmap dia-da-semana × hora para picos de uso.
 * Células com gap de 2px (separador é a superfície, não borda), tooltip por
 * célula, rótulos com token de texto.
 */
export function HeatmapChart({
  data,
  label,
  valueFormatter = formatCompact,
  className,
}: HeatmapChartProps) {
  const { grade, max } = useMemo(() => {
    const grade = new Map<string, number>()
    let max = 0
    for (const d of data) {
      const chave = `${d.dia}-${d.hora}`
      const v = (grade.get(chave) ?? 0) + d.valor
      grade.set(chave, v)
      if (v > max) max = v
    }
    return { grade, max }
  }, [data])

  return (
    <ChartReveal direction="left" className={className}>
      <div
        role="img"
        aria-label={`Heatmap de ${label} por dia da semana e hora`}
        className="flex flex-col gap-2"
      >
        <div className="grid grid-cols-[auto_1fr] gap-2">
          {/* rótulos dos dias */}
          <div className="grid grid-rows-7 gap-0.5">
            {ORDEM_DIAS.map((dia) => (
              <span
                key={dia}
                className="text-muted-foreground flex items-center pr-1 text-[11px] leading-none"
              >
                {NOME_DIA[dia]}
              </span>
            ))}
          </div>

          {/* células */}
          <div className="grid grid-rows-7 gap-0.5">
            {ORDEM_DIAS.map((dia) => (
              <div key={dia} className="grid grid-cols-24 gap-0.5">
                {Array.from({ length: 24 }, (_, hora) => {
                  const valor = grade.get(`${dia}-${hora}`) ?? 0
                  const n = nivel(valor, max)
                  return (
                    <Tooltip key={hora}>
                      <TooltipTrigger asChild>
                        <div
                          tabIndex={-1}
                          className={cn(
                            'aspect-square min-h-2.5 rounded-[3px]',
                            n < 0 && 'bg-muted/60',
                          )}
                          style={
                            n >= 0
                              ? {
                                  background: `color-mix(in oklab, var(--color-data-1) ${ALFAS[n] * 100}%, transparent)`,
                                }
                              : undefined
                          }
                        />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="font-mono tabular-nums">
                        {NOME_DIA[dia]} {String(hora).padStart(2, '0')}h ·{' '}
                        {valueFormatter(valor)} {label}
                      </TooltipContent>
                    </Tooltip>
                  )
                })}
              </div>
            ))}
          </div>
        </div>

        {/* eixo de horas + legenda de intensidade */}
        <div className="grid grid-cols-[auto_1fr] gap-2">
          <div aria-hidden className="w-[26px]" />
          <div className="flex items-center justify-between">
            <div className="grid w-full grid-cols-24 gap-0.5">
              {Array.from({ length: 24 }, (_, hora) => (
                <span
                  key={hora}
                  className="text-muted-foreground text-center text-[10px] leading-none"
                >
                  {HORAS_ROTULADAS.includes(hora) ? `${hora}h` : ''}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="text-muted-foreground flex items-center justify-end gap-1.5 text-[11px]">
          menos
          {ALFAS.map((alfa) => (
            <span
              key={alfa}
              className="size-2.5 rounded-[3px]"
              style={{
                background: `color-mix(in oklab, var(--color-data-1) ${alfa * 100}%, transparent)`,
              }}
            />
          ))}
          mais
        </div>
      </div>
    </ChartReveal>
  )
}
