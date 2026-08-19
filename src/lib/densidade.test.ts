import { describe, expect, it } from 'vitest'

import { NIVEIS, type NivelDeAnalise } from '@/lib/escada'
import {
  TELAS_DE_PRODUTO,
  TELAS_NA_DENSIDADE,
  TETO_POR_TELA,
  avaliarDensidade,
  excecoesDeclaradas,
  type MedidaDeTela,
} from '@/lib/densidade'

/**
 * A régua de densidade, medida no fonte.
 *
 * O par da `escada.test.ts`: lá se verifica se a tela é rasa, aqui se ela é
 * legível. Mesmo mecanismo (`import.meta.glob` do fonte) pelo mesmo motivo —
 * é um app de navegador, e ler arquivo pelo Vite evita arrastar os tipos do
 * Node para dentro do type-check da aplicação.
 *
 * ⚠️ O glob aponta para `features/**` porque é onde vivem as dez telas. A
 * `AbaDeDados` NÃO entra na conta: ela mora em `components/` e os cards dela
 * são a prova dos degraus, não degraus — foi por contá-los que a escada media
 * 19 descritivos onde o DOM entregava 107.
 */

const paginas = Object.entries(
  import.meta.glob('../features/**/*-page.tsx', {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>,
).map(([caminho, fonte]) => ({ caminho: caminho.replace('../', ''), fonte }))

const CARD = /<(?:ChartCard|TabelaCard)\b/g

/** Blocos `<SecaoDeAnalise …> … </SecaoDeAnalise>`. Seções não aninham. */
function secoesDe(fonte: string): string[] {
  const blocos: string[] = []
  for (const m of fonte.matchAll(/<SecaoDeAnalise\b/g)) {
    const fim = fonte.indexOf('</SecaoDeAnalise>', m.index)
    if (fim !== -1) blocos.push(fonte.slice(m.index, fim))
  }
  return blocos
}

/** `descricao` de seção, como literal ou como template. */
function descricaoDe(bloco: string): string {
  return (
    /descricao="((?:[^"\\]|\\.)*)"/.exec(bloco)?.[1] ??
    /descricao=\{`((?:[^`\\]|\\.)*)`\}/.exec(bloco)?.[1] ??
    /descricao=\{[^}]*?`((?:[^`\\]|\\.)*)`/.exec(bloco)?.[1] ??
    ''
  )
}

function medir(fonte: string): MedidaDeTela {
  const secoes = secoesDe(fonte)
  const prosaPorSecao = secoes.map((b) => descricaoDe(b).length).filter((n) => n > 0)
  return {
    cards: (fonte.match(CARD) ?? []).length,
    cardsPorSecao: secoes.map((b) => (b.match(CARD) ?? []).length),
    prosaPorSecao,
    picoPorSecao: secoes.map((b) => {
      const niveis = [...b.matchAll(/nivel="([a-z]+)"/g)]
        .map((m) => NIVEIS.indexOf(m[1] as NivelDeAnalise))
        .filter((i) => i >= 0)
      return niveis.length > 0 ? Math.max(...niveis) : -1
    }),
    descritivos: (fonte.match(/nivel="descritivo"/g) ?? []).length,
    colunas: (fonte.match(/<TableHead\b/g) ?? []).length,
  }
}

const produto = TELAS_DE_PRODUTO.map((caminho) => {
  const p = paginas.find((x) => x.caminho === caminho)
  return { caminho, fonte: p?.fonte ?? '', medida: medir(p?.fonte ?? '') }
})

describe('régua de densidade', () => {
  it('as dez telas de produto existem no disco', () => {
    expect(produto.filter((p) => p.fonte.length > 0)).toHaveLength(TELAS_DE_PRODUTO.length)
  })

  const sobRegra = produto.filter((p) => TELAS_NA_DENSIDADE.includes(p.caminho))

  it('a lista de telas na régua bate com o disco', () => {
    expect(sobRegra.map((p) => p.caminho).sort()).toEqual([...TELAS_NA_DENSIDADE].sort())
  })

  it.each(sobRegra)('$caminho cumpre a régua', ({ fonte, medida }) => {
    expect(avaliarDensidade(medida, fonte)).toEqual([])
  })

  /*
    A catraca ao contrário, e ela vale para as DEZ — inclusive as oito que ainda
    não entraram na régua absoluta. Em 130 commits a contagem de cards caiu uma
    única vez; sem um passo que impeça somar, a faxina de hoje é desfeita em
    seis meses sem ninguém decidir isso.

    Baixar um teto em `densidade.ts` é de graça. Subir exige editar o arquivo e
    escrever por quê — que é a pergunta que nenhuma fase anterior fez.
  */
  it.each(produto)('$caminho não passa do teto de hoje', ({ caminho, medida }) => {
    const teto = TETO_POR_TELA[caminho]!
    expect({ cards: medida.cards, colunas: medida.colunas }).toEqual({
      cards: Math.min(medida.cards, teto.cards),
      colunas: Math.min(medida.colunas, teto.colunas),
    })
  })

  /*
    O teto não pode ficar acima do real: quando uma tela encolhe, o teto desce
    junto, senão a catraca vira folga acumulada e para de segurar qualquer
    coisa. É o mesmo raciocínio da lista de adoção — dívida visível vale mais
    que régua frouxa.
  */
  it.each(produto)('$caminho tem teto colado no placar', ({ caminho, medida }) => {
    expect(TETO_POR_TELA[caminho]).toEqual({ cards: medida.cards, colunas: medida.colunas })
  })
})

describe('exceção declarada', () => {
  it('lê as regras dispensadas e o motivo', () => {
    const fonte = `{/* DENSIDADE_DECLARADA: cardsPorSecaoNoMinimo, prescritivoNaoSoNoFim —
      "Saúde do rastreio" é meta-card. */}`
    const [e] = excecoesDeclaradas(fonte)
    expect(e?.regras).toEqual(['cardsPorSecaoNoMinimo', 'prescritivoNaoSoNoFim'])
    expect(e?.motivo).toMatch(/meta-card/)
  })

  /*
    Sem motivo escrito a exceção NÃO vale. Senão a marca vira um jeito silencioso
    de desligar a régua — que é como a `escada` já foi burlada sem ninguém
    perceber, contando o arquivo errado.
  */
  it('não vale sem motivo escrito', () => {
    const base: MedidaDeTela = {
      cards: 3,
      cardsPorSecao: [1, 2],
      prosaPorSecao: [100, 100],
      // Prescritivo na PRIMEIRA seção de propósito: este fixture existe para
      // exercitar uma regra só, e com a ação no fim ele reprovaria por duas —
      // o teste passaria pelo motivo errado.
      picoPorSecao: [3, 1],
      descritivos: 1,
      colunas: 0,
    }
    expect(avaliarDensidade(base, '{/* DENSIDADE_DECLARADA: cardsPorSecaoNoMinimo */}')).toEqual([
      expect.stringContaining('cardsPorSecaoNoMinimo'),
    ])
    expect(
      avaliarDensidade(base, '{/* DENSIDADE_DECLARADA: cardsPorSecaoNoMinimo — é meta-card. */}'),
    ).toEqual([])
  })
})

describe('avaliarDensidade', () => {
  const ok: MedidaDeTela = {
    cards: 6,
    cardsPorSecao: [3, 3],
    prosaPorSecao: [180, 200],
    picoPorSecao: [3, 2],
    descritivos: 1,
    colunas: 8,
  }

  it('aprova uma tela dentro da régua', () => {
    expect(avaliarDensidade(ok)).toEqual([])
  })

  it('reprova pilha de cards', () => {
    expect(avaliarDensidade({ ...ok, cards: 12 })[0]).toMatch(/12 cards/)
  })

  it('reprova seção que não agrupa nada', () => {
    expect(avaliarDensidade({ ...ok, cardsPorSecao: [1, 5] })[0]).toMatch(/um card só/)
  })

  it('reprova prosa de seção acima de três linhas', () => {
    expect(avaliarDensidade({ ...ok, prosaPorSecao: [460] })[0]).toMatch(/460/)
  })

  it('reprova tela sem denominador visível', () => {
    expect(avaliarDensidade({ ...ok, descritivos: 0 })[0]).toMatch(/nenhum denominador/)
  })

  it('reprova tela que abre pelo "quanto"', () => {
    expect(avaliarDensidade({ ...ok, picoPorSecao: [0, 3] })[0]).toMatch(/primeira seção só descreve/)
  })

  it('reprova tela em que a ação só aparece no fim', () => {
    expect(avaliarDensidade({ ...ok, picoPorSecao: [1, 3] })[0]).toMatch(/ação fecha a tela/)
  })

  it('aceita a ação no fim quando ela também aparece antes', () => {
    expect(avaliarDensidade({ ...ok, picoPorSecao: [3, 3] })).toEqual([])
  })
})
