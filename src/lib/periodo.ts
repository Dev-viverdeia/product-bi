/**
 * Contrato do período de análise.
 *
 * Fora do componente porque três coisas diferentes precisam dele: o controle
 * que desenha, as queries que passam `p_dias` e o hook que lê a URL. Com o
 * contrato dentro do componente, quem só quer o tipo arrasta JSX junto — e o
 * fast-refresh do Vite reclama de arquivo que exporta componente e valor.
 */

export type Periodo = 7 | 30 | 90

export const PERIODO_PADRAO: Periodo = 30

export const PERIODOS = [
  { valor: '7', rotulo: '7 dias' },
  { valor: '30', rotulo: '30 dias' },
  { valor: '90', rotulo: '90 dias' },
] as const

/**
 * Lê o período da URL.
 *
 * Valor fora da lista cai no padrão em vez de quebrar: a URL é editável por
 * qualquer um, e `?periodo=999` não pode virar argumento de consulta ao banco.
 */
export function periodoDaUrl(bruto: string | null): Periodo {
  const n = Number(bruto)
  return PERIODOS.some((opcao) => Number(opcao.valor) === n) ? (n as Periodo) : PERIODO_PADRAO
}
