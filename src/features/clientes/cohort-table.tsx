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

/* Teto de safras na tela. A RPC devolve da mais recente para a mais antiga e
   ganha uma linha por mês; sem teto, em um ano a grade tem 28 linhas e a
   comparação que importa — as safras recentes — some abaixo da dobra.
   Aqui não entra TabelaLonga de propósito: a leitura é diagonal (safra contra
   janela) e paginar cortaria a comparação no meio. */
const SAFRAS_VISIVEIS = 12

/**
 * Grade de retenção por cohort — tabela densa PLANA (regra do DS: sem vidro).
 * "—" = janela ainda não completa (não é queda).
 */
export function CohortTable({ linhas }: { linhas: CohortLinha[] }) {
  const visiveis = linhas.slice(0, SAFRAS_VISIVEIS)
  const ocultas = linhas.length - visiveis.length

  return (
    <div className="space-y-3">
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
          {visiveis.map((linha) => (
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

      {ocultas > 0 ? (
        <p className="text-muted-foreground text-xs">
          As {SAFRAS_VISIVEIS} safras mais recentes ·{' '}
          {ocultas === 1
            ? '1 safra mais antiga não aparece'
            : `${formatInt(ocultas)} safras mais antigas não aparecem`}
        </p>
      ) : null}
    </div>
  )
}
