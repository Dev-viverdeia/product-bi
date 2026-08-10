/**
 * Tinta de intensidade para célula de tabela densa: quanto maior o valor, mais
 * saturada a célula. Mesma técnica da grade de cohort.
 *
 * Um hue só, por alfa de `--data-1` — funciona nos dois temas por construção e
 * não gasta uma cor de série num elemento que não é série.
 *
 * O nome é "intensidade", não "funil", de propósito: a tinta diz *quanto*, não
 * *queda*. Em tabela que não é funil — conclusão por aba de implementação, onde
 * as etapas são independentes — chamar isso de funil é o que faz o leitor
 * enxergar erro onde só há aba pulada.
 */
export function fundoIntensidade(pct: number | null) {
  if (pct == null) return undefined
  const alfa = Math.min(pct, 1) * 0.45
  return {
    background: `color-mix(in oklab, var(--color-data-1) ${Math.round(alfa * 100)}%, transparent)`,
  }
}
