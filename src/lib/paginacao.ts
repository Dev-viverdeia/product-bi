/**
 * Regras de paginação das listas nominais, separadas da UI para poderem ser
 * testadas — a decisão "mostra ou não mostra controle" é lógica, não pintura.
 */

/** 12 por página: acima disso a tabela passa da dobra e o cabeçalho sai de vista. */
export const POR_PAGINA = 12

/**
 * Busca e paginação só aparecem quando pagam o próprio espaço.
 * Caixa de busca sobre 6 linhas é ruído: o olho acha mais rápido que a mão digita.
 */
export function precisaControles(total: number, porPagina = POR_PAGINA) {
  return total > porPagina
}

/** Página válida mesmo depois de uma busca encurtar a lista. */
export function fatiar(total: number, pagina: number, porPagina = POR_PAGINA) {
  const totalPaginas = Math.max(Math.ceil(total / porPagina), 1)
  const atual = Math.min(Math.max(pagina, 0), totalPaginas - 1)
  const inicio = atual * porPagina
  return { totalPaginas, atual, inicio, fim: Math.min(inicio + porPagina, total) }
}
