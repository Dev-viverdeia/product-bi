/**
 * A escada de profundidade.
 *
 * "As análises estão rasas" era um julgamento, e julgamento não se verifica.
 * A escada torna a coisa mecânica: cada card declara em que degrau opera, e
 * uma tela só está pronta quando a composição bate a régua. O que era gosto
 * vira condição de merge.
 */

export const NIVEIS = ['descritivo', 'comparativo', 'diagnostico', 'prescritivo'] as const

export type NivelDeAnalise = (typeof NIVEIS)[number]

/** O que cada degrau responde, e o que o card precisa ter para ocupá-lo. */
export const DEFINICAO: Record<NivelDeAnalise, { responde: string; exige: string }> = {
  descritivo: {
    responde: 'quanto',
    exige: 'denominador visível',
  },
  comparativo: {
    responde: 'quanto comparado a quê',
    exige: 'dois grupos nomeados ou duas janelas, com a margem declarada',
  },
  diagnostico: {
    responde: 'onde, ou por quê',
    exige: 'taxa com denominador correto e ao menos um confundidor declarado',
  },
  prescritivo: {
    responde: 'o que fazer, sobre quem',
    exige: 'lista acionável, ou ação com o número que a justifica',
  },
}

/**
 * Régua de composição de uma tela.
 *
 * O teto de descritivos é o ponto: sem ele, a tela cumpre o mínimo dos degraus
 * altos e continua sendo uma parede de contagens. Os KPIs do topo não contam —
 * eles são descritivos por natureza e existem para dar referência rápida.
 */
export const REGUA = {
  descritivosNoMaximo: 3,
  comparativosNoMinimo: 2,
  diagnosticosNoMinimo: 2,
  prescritivosNoMinimo: 1,
} as const

export type Composicao = Record<NivelDeAnalise, number>

export function avaliarComposicao(c: Composicao): string[] {
  const falhas: string[] = []
  if (c.descritivo > REGUA.descritivosNoMaximo)
    falhas.push(`${c.descritivo} cards descritivos (teto ${REGUA.descritivosNoMaximo})`)
  if (c.comparativo < REGUA.comparativosNoMinimo)
    falhas.push(`${c.comparativo} comparativos (mínimo ${REGUA.comparativosNoMinimo})`)
  if (c.diagnostico < REGUA.diagnosticosNoMinimo)
    falhas.push(`${c.diagnostico} diagnósticos (mínimo ${REGUA.diagnosticosNoMinimo})`)
  if (c.prescritivo < REGUA.prescritivosNoMinimo)
    falhas.push(`${c.prescritivo} prescritivos (mínimo ${REGUA.prescritivosNoMinimo})`)
  return falhas
}
