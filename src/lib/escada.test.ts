import { describe, expect, it } from 'vitest'

import { NIVEIS, avaliarComposicao, type Composicao, type NivelDeAnalise } from '@/lib/escada'

/**
 * A escada de profundidade, verificada no fonte.
 *
 * "As análises estão rasas" era julgamento, e julgamento não entra em CI. Aqui
 * a composição de cada tela é contada e comparada com a régua — o que era
 * gosto vira condição de merge.
 */

const paginas = Object.entries(
  import.meta.glob('../features/**/*-page.tsx', {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>,
).map(([caminho, fonte]) => ({
  caminho: caminho.replace('../', ''),
  fonte,
}))

/*
  Telas que já subiram a escada.

  Curta de propósito: cada nome aqui é uma tela cuja composição foi refeita, não
  uma promessa. As demais aparecem no relatório abaixo com o placar atual, para
  que a dívida fique visível em vez de esquecida.
*/
const TELAS_NA_REGUA = [
  'features/visao-geral/visao-geral-page.tsx',
  'features/clientes/clientes-page.tsx',
  'features/entrada/entrada-page.tsx',
  'features/formacoes/formacoes-page.tsx',
  'features/solucoes/solucoes-page.tsx',
  'features/ia/ia-page.tsx',
  'features/organizacoes/organizacoes-page.tsx',
  'features/jornada/jornada-page.tsx',
]

function composicaoDe(fonte: string): Composicao {
  const zero = Object.fromEntries(NIVEIS.map((n) => [n, 0])) as Composicao
  for (const m of fonte.matchAll(/nivel="([a-z]+)"/g)) {
    const nivel = m[1] as NivelDeAnalise
    if (nivel in zero) zero[nivel] += 1
  }
  return zero
}

describe('escada de profundidade', () => {
  const sobRegra = paginas.filter((p) => TELAS_NA_REGUA.includes(p.caminho))

  it('a lista de telas na régua bate com o disco', () => {
    expect(sobRegra.map((p) => p.caminho).sort()).toEqual([...TELAS_NA_REGUA].sort())
  })

  it.each(sobRegra)('$caminho cumpre a régua de composição', ({ fonte }) => {
    const falhas = avaliarComposicao(composicaoDe(fonte))
    expect(falhas).toEqual([])
  })

  it('todo card de tela na régua declara o nível', () => {
    for (const { caminho, fonte } of sobRegra) {
      const cards = (fonte.match(/<(?:ChartCard|TabelaCard)\b/g) ?? []).length
      const declarados = (fonte.match(/nivel="/g) ?? []).length
      expect({ caminho, cards, declarados }).toEqual({ caminho, cards, declarados: cards })
    }
  })
})

describe('avaliarComposicao', () => {
  const base: Composicao = { descritivo: 2, comparativo: 2, diagnostico: 2, prescritivo: 1 }

  it('aprova a composição mínima', () => {
    expect(avaliarComposicao(base)).toEqual([])
  })

  it('reprova parede de contagem', () => {
    expect(avaliarComposicao({ ...base, descritivo: 8 })[0]).toMatch(/8 cards descritivos/)
  })

  it('reprova tela sem diagnóstico', () => {
    expect(avaliarComposicao({ ...base, diagnostico: 0 })[0]).toMatch(/0 diagnósticos/)
  })

  it('reprova tela que não produz ação', () => {
    expect(avaliarComposicao({ ...base, prescritivo: 0 })[0]).toMatch(/0 prescritivos/)
  })
})
