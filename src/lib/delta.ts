/**
 * Delta relativo vs período anterior; indefinido quando não computável.
 *
 * `anterior` nulo = janela não comparável — o caso do pageview, rastreado só
 * desde 03/07/2026: comparar contra uma janela anterior a essa data mede
 * instrumentação, não crescimento. Foi exatamente esse o defeito de
 * "Pageviews +313,3%" na Visão Geral (§2.3 da auditoria), então a regra é
 * devolver `undefined` e a UI omitir o delta — nunca 0%, que se lê como
 * "estável" e é mentira diferente.
 */
export function calcularDelta(
  atual: number,
  anterior: number | null,
): number | undefined {
  if (anterior == null || anterior <= 0) return undefined
  return (atual - anterior) / anterior
}

/** Prop `delta` do KpiCard, ou undefined quando não há comparação honesta. */
export function deltaOuNada(atual: number, anterior: number | null, vs: string) {
  const value = calcularDelta(atual, anterior)
  return value === undefined ? undefined : { value, vs }
}
