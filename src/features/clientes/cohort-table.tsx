import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatInt, formatMesAno, formatPercent } from '@/lib/format'
import { cn } from '@/lib/utils'

export type CohortLinha = {
  cohort_mes: string
  clientes: number
  ret_7d: number | null
  ret_30d: number | null
  ret_90d: number | null
  ret_180d: number | null
}

/* Tinta da célula: sequencial de um hue por alfa (mesma técnica do heatmap).
   Escala fixa 0–60% de retenção → alfa 0–0.55, p/ comparabilidade entre linhas. */
function fundoCelula(valor: number | null) {
  if (valor == null) return undefined
  const alfa = Math.min(valor / 0.6, 1) * 0.55
  return { background: `color-mix(in oklab, var(--color-data-1) ${Math.round(alfa * 100)}%, transparent)` }
}

function CelulaRetencao({ valor }: { valor: number | null }) {
  return (
    <TableCell
      className={cn('num text-right', valor == null && 'text-muted-foreground')}
      style={fundoCelula(valor)}
    >
      {valor == null ? '—' : formatPercent(valor)}
    </TableCell>
  )
}

/**
 * Grade de retenção por cohort — tabela densa PLANA (regra do DS: sem vidro).
 * "—" = janela ainda não completa (não é queda).
 */
export function CohortTable({ linhas }: { linhas: CohortLinha[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Cohort</TableHead>
          <TableHead className="text-right">Clientes</TableHead>
          <TableHead className="text-right">7 dias</TableHead>
          <TableHead className="text-right">30 dias</TableHead>
          <TableHead className="text-right">90 dias</TableHead>
          <TableHead className="text-right">180 dias</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {linhas.map((linha) => (
          <TableRow key={linha.cohort_mes}>
            <TableCell className="font-medium">{formatMesAno(linha.cohort_mes)}</TableCell>
            <TableCell className="num text-right">{formatInt(linha.clientes)}</TableCell>
            <CelulaRetencao valor={linha.ret_7d} />
            <CelulaRetencao valor={linha.ret_30d} />
            <CelulaRetencao valor={linha.ret_90d} />
            <CelulaRetencao valor={linha.ret_180d} />
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
