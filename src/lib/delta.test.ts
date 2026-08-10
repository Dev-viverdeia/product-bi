import { describe, expect, it } from 'vitest'

import { calcularDelta, deltaOuNada } from '@/lib/delta'

/**
 * Estes testes guardam a correção da §2.3 da auditoria: a Visão Geral mostrava
 * "Pageviews +313,3%" comparando 30 dias instrumentados contra 6. A regra que
 * saiu daquilo é que janela incomparável não vira número — vira ausência de
 * número. Se alguém "consertar" isso para devolver 0, o teste quebra.
 */
describe('calcularDelta', () => {
  it('calcula a variação relativa quando há base de comparação', () => {
    expect(calcularDelta(150, 100)).toBe(0.5)
    expect(calcularDelta(80, 100)).toBeCloseTo(-0.2)
    expect(calcularDelta(100, 100)).toBe(0)
  })

  it('devolve undefined quando a janela anterior não é comparável', () => {
    // o caso do pageview antes de 03/07/2026: a RPC devolve null de propósito
    expect(calcularDelta(5000, null)).toBeUndefined()
  })

  it('devolve undefined quando o anterior é zero — não Infinity nem 100%', () => {
    // divisão por zero viraria Infinity e a UI renderizaria "∞%"
    expect(calcularDelta(500, 0)).toBeUndefined()
  })

  it('devolve undefined para anterior negativo, que não é base válida', () => {
    expect(calcularDelta(10, -50)).toBeUndefined()
  })

  it('não confunde anterior nulo com anterior zero — ambos suprimem', () => {
    expect(calcularDelta(1, null)).toBe(calcularDelta(1, 0))
  })
})

describe('deltaOuNada', () => {
  it('monta a prop do KpiCard quando a comparação é honesta', () => {
    expect(deltaOuNada(150, 100, 'vs. 30d anteriores')).toEqual({
      value: 0.5,
      vs: 'vs. 30d anteriores',
    })
  })

  it('omite a prop inteira quando não há comparação — não devolve value: 0', () => {
    expect(deltaOuNada(5000, null, 'vs. 30d anteriores')).toBeUndefined()
    expect(deltaOuNada(5000, 0, 'vs. 30d anteriores')).toBeUndefined()
  })
})
