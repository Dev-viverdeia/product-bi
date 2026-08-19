import { describe, expect, it } from 'vitest'

import { MAXIMO_DE_ACHADOS, selecionar } from '@/features/resumo/selecao'
import type { Achado } from '@/features/resumo/queries'

function achado(regra: string, familia: string, suprimida = false): Achado {
  return {
    regra,
    familia,
    severidade: 'atencao',
    titulo: regra,
    gabarito: '',
    gabarito_leitura: '',
    gabarito_acao: '',
    parametros: {},
    score: 1,
    suprimida,
    motivo: suprimida ? 'sem amostra' : null,
    ancora_aba: 'graficos',
    ancora_id: null,
  } as unknown as Achado
}

describe('selecionar', () => {
  it('respeita o teto', () => {
    const todos = ['a', 'b', 'c', 'd', 'e'].map((r, i) => achado(r, `familia${i}`))
    expect(selecionar(todos).visiveis).toHaveLength(MAXIMO_DE_ACHADOS)
  })

  it('não repete família — senão a leitura diz retenção três vezes', () => {
    const todos = [
      achado('a', 'retencao'),
      achado('b', 'retencao'),
      achado('c', 'alcance'),
    ]
    expect(selecionar(todos).visiveis.map((a) => a.regra)).toEqual(['a', 'c'])
  })

  it('conta o que ficou abaixo do corte, para a tela poder declarar', () => {
    const todos = ['a', 'b', 'c', 'd'].map((r, i) => achado(r, `familia${i}`))
    expect(selecionar(todos).abaixoDoCorte).toBe(1)
  })

  it('separa suprimido de cortado — são coisas diferentes', () => {
    const r = selecionar([achado('a', 'x'), achado('b', 'y', true)])
    expect(r.visiveis.map((a) => a.regra)).toEqual(['a'])
    expect(r.suprimidos.map((a) => a.regra)).toEqual(['b'])
    expect(r.abaixoDoCorte).toBe(0)
  })
})

/**
 * As duas abas leem a MESMA seleção, verificado no fonte.
 *
 * ⚠️ Elas já divergiram, e em silêncio. A função morava dentro de
 * `AnaliseDaTela` e o `PlanoDaTela` filtrava por conta própria — em Clientes
 * isso dava 3 achados numa aba e 6 sugestões na outra, com a mesma RPC e o
 * mesmo cache. O custo não era estético: a aba `Plano` propunha AÇÃO cujo FATO
 * não aparecia na aba ao lado, que é a mesma família de defeito que o motor tem
 * contrato de CI para impedir do lado do banco.
 *
 * E o `PlanoDaTela` afirmava por escrito que lia "o mesmo achado que a aba
 * Análise, com a mesma régua" — a tela dizia de si algo falso.
 */
const fontes = Object.entries(
  import.meta.glob('./*.tsx', {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>,
).map(([caminho, fonte]) => ({ caminho: caminho.replace('./', ''), fonte }))

describe('as duas abas usam a mesma seleção', () => {
  const abas = fontes.filter((f) => ['analise-tela.tsx', 'plano-da-tela.tsx'].includes(f.caminho))

  it('as duas abas existem no disco', () => {
    expect(abas.map((a) => a.caminho).sort()).toEqual(['analise-tela.tsx', 'plano-da-tela.tsx'])
  })

  it.each(abas)('$caminho importa a seleção compartilhada', ({ fonte }) => {
    expect(fonte).toMatch(/import \{ selecionar \} from '@\/features\/resumo\/selecao'/)
  })

  it.each(abas)('$caminho não filtra achado por conta própria', ({ fonte }) => {
    // `filter((a) => !a.suprimida)` fora da seleção é exatamente como o Plano
    // passou a mostrar seis onde a Análise mostrava três.
    //
    // ⚠️ O parêntese em volta de `[a-z]` é o que faz a regra existir. A primeira
    // versão escrevia `\([a-z]\) => !\1` sem grupo de captura, e `\1` apontava
    // para nada: a asserção nunca casava e o teste passava mesmo com o filtro
    // de volta no arquivo — conferido injetando. Quem pegou foi o
    // type-checker (TS1534), não o teste. Verde por acidente, de novo.
    expect(fonte).not.toMatch(/filter\(\(([a-z])\) => !\1\.suprimida\)/)
  })
})
