import { Button } from '@/components/ui/button'

export type Periodo = 7 | 30 | 90

const OPCOES: { valor: Periodo; rotulo: string }[] = [
  { valor: 7, rotulo: '7 dias' },
  { valor: 30, rotulo: '30 dias' },
  { valor: 90, rotulo: '90 dias' },
]

/** Filtro de período — uma linha, acima dos gráficos; escopa a página inteira. */
export function PeriodoFiltro({
  valor,
  onChange,
}: {
  valor: Periodo
  onChange: (periodo: Periodo) => void
}) {
  return (
    <div role="group" aria-label="Período de análise" className="flex gap-1">
      {OPCOES.map((opcao) => (
        <Button
          key={opcao.valor}
          size="sm"
          variant={valor === opcao.valor ? 'secondary' : 'ghost'}
          aria-pressed={valor === opcao.valor}
          onClick={() => onChange(opcao.valor)}
        >
          {opcao.rotulo}
        </Button>
      ))}
    </div>
  )
}
