import { TableCell } from '@/components/ui/table'
import { formatDecimal, formatInt } from '@/lib/format'

/** Uma linha qualquer devolvida crua pelo banco. */
export type LinhaBruta = Record<string, unknown>

/**
 * Célula da camada de dados: **o tipo do valor decide o formato, nunca o nome
 * da coluna.**
 *
 * Adivinhar semântica pelo nome ("`pct_` é percentual?", "`_em` é data?")
 * erraria em silêncio, que é o modo de falha que este projeto combate em todas
 * as outras camadas. Aqui o contrato é mais estreito e mais honesto: número à
 * direita em mono, booleano em pt-BR, jsonb como JSON, nulo como travessão.
 *
 * Nulo vira travessão e não célula vazia porque, nos marts, nulo costuma ser
 * supressão declarada pelo banco (piso de amostra, guarda de rastreio) — e
 * célula em branco é indistinguível de erro de renderização.
 *
 * Vive num arquivo próprio porque tem dois leitores: a aba `Dados` de cada
 * módulo e a tela `Explorar`. Duas cópias fariam a mesma linha aparecer
 * formatada de dois jeitos dependendo de onde se olha.
 */
export function CelulaBruta({ valor }: { valor: unknown }) {
  if (valor === null || valor === undefined) {
    return <TableCell className="text-muted-foreground">—</TableCell>
  }
  if (typeof valor === 'number') {
    return (
      <TableCell className="num text-right">
        {Number.isInteger(valor) ? formatInt(valor) : formatDecimal(valor)}
      </TableCell>
    )
  }
  if (typeof valor === 'boolean') {
    return <TableCell>{valor ? 'sim' : 'não'}</TableCell>
  }
  if (typeof valor === 'object') {
    return (
      <TableCell className="text-muted-foreground max-w-[28ch] truncate font-mono text-xs">
        {JSON.stringify(valor)}
      </TableCell>
    )
  }
  return <TableCell className="max-w-[40ch] truncate">{String(valor)}</TableCell>
}
