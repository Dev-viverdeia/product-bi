import { describe, expect, it } from 'vitest'

/**
 * O documento de duas colunas é UM só, verificado no fonte.
 *
 * ⚠️ Ele já foi três. `AnaliseDaTela` e `PlanoDaTela` montavam
 * `grid-cols-[minmax(0,68ch)_minmax(16rem,26rem)]` cada uma por sua conta — o
 * comentário de uma delas dizia, por escrito, "a MESMA gramática da aba
 * Análise" — e a aba de apuração do `/plano` usava `lg:grid-cols-2`, meio a
 * meio. Três gramáticas para a mesma página.
 *
 * Isso não é preciosismo de estilo: gramática repetida à mão é gramática que
 * deriva, e neste mesmo par de arquivos a deriva já publicou 3 achados de um
 * lado e 6 do outro, com a mesma RPC. O cabeçalho do aparato também tinha
 * divergido — `text-base font-medium` numa aba, `text-xs uppercase` na outra.
 *
 * A régua de largura mora num lugar só (`documento.tsx`, com a conta escrita),
 * e o teste abaixo existe para que ela continue morando lá.
 */

const fontes = Object.entries(
  import.meta.glob(['./*.tsx', '../plano/*.tsx'], {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>,
  // ⚠️ Âncora no início: `replace('./', '')` cru come o ponto do `../plano/…`
  // e o caminho vira `.plano/…`, que não casa com lista nenhuma.
).map(([caminho, fonte]) => ({ caminho: caminho.replace(/^\.\//, ''), fonte }))

/** Quem renderiza o documento de achados: as duas abas e o /plano. */
const CONSUMIDORES = [
  'analise-tela.tsx',
  'plano-da-tela.tsx',
  '../plano/plano-page.tsx',
]

describe('o documento de duas colunas é um só', () => {
  const consumidores = fontes.filter((f) => CONSUMIDORES.includes(f.caminho))

  it('os três consumidores existem no disco', () => {
    expect(consumidores.map((c) => c.caminho).sort()).toEqual([...CONSUMIDORES].sort())
  })

  it.each(consumidores)('$caminho monta pela peça compartilhada', ({ fonte }) => {
    expect(fonte).toMatch(/<DocumentoDeAchados\b/)
  })

  /*
    Nenhum deles pode voltar a escrever a própria grade de duas colunas. A regex
    casa `grid-cols-2` e `grid-cols-[…]` em classe de utilitário — que são as
    duas formas que existiam aqui antes.
  */
  it.each(consumidores)('$caminho não monta grade de duas colunas à mão', ({ fonte }) => {
    const proprias = fonte.match(/\b(?:lg|xl|md):grid-cols-(?:2\b|\[)/g) ?? []
    expect(proprias).toEqual([])
  })
})

describe('a régua de largura mora no documento', () => {
  const documento = fontes.find((f) => f.caminho === 'documento.tsx')

  it('a peça existe', () => {
    expect(documento).toBeDefined()
  })

  /*
    O apoio nunca pode ficar mais largo que a leitura, e a faixa em que isso
    quebrou foi 1024–1135px: o grid distribui a folga IGUALMENTE a partir das
    bases, então o apoio (base 16rem) chega ao teto antes de a leitura sair do
    zero. Em `lg` a trilha do apoio é FIXA justamente para não competir — se
    alguém a trocar por um `minmax` ali, a inversão volta.
  */
  it('em lg a trilha do apoio é fixa, não elástica', () => {
    expect(documento!.fonte).toMatch(/lg:grid-cols-\[minmax\(0,1fr\)_16rem\]/)
  })

  it('em xl a leitura tem teto de medida de leitura', () => {
    expect(documento!.fonte).toMatch(/xl:grid-cols-\[minmax\(0,68ch\)_minmax\(16rem,26rem\)\]/)
  })
})
