import { ControleSegmentado } from '@/components/ui-marca/controle-segmentado'
import { PERIODOS, type Periodo } from '@/lib/periodo'

/** Janela de análise da tela inteira. Segmentado: três opções cabem na tela. */
export function PeriodoFiltro({
  valor,
  onChange,
  className,
}: {
  valor: Periodo
  onChange: (periodo: Periodo) => void
  className?: string
}) {
  return (
    <ControleSegmentado
      rotulo="Período de análise"
      valor={String(valor)}
      opcoes={PERIODOS}
      onChange={(proximo) => onChange(Number(proximo) as Periodo)}
      className={className}
    />
  )
}
