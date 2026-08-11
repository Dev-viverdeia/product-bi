import { describe, expect, it } from 'vitest'

import { fatiar, POR_PAGINA, precisaControles } from '@/lib/paginacao'

describe('precisaControles', () => {
  it('esconde busca e paginação quando a lista cabe numa página', () => {
    // as tabelas curtas do produto: aha (6), funil de entrada (4), abas (6)
    expect(precisaControles(6)).toBe(false)
    expect(precisaControles(POR_PAGINA)).toBe(false)
  })

  it('mostra os controles assim que passa de uma página', () => {
    expect(precisaControles(POR_PAGINA + 1)).toBe(true)
    // clientes em risco: 3.828 linhas
    expect(precisaControles(3828)).toBe(true)
  })
})

describe('fatiar', () => {
  it('calcula a janela da página', () => {
    expect(fatiar(100, 0)).toMatchObject({ inicio: 0, fim: 12, totalPaginas: 9 })
    expect(fatiar(100, 1)).toMatchObject({ inicio: 12, fim: 24 })
  })

  it('não deixa a última página passar do total', () => {
    expect(fatiar(13, 1)).toMatchObject({ inicio: 12, fim: 13 })
  })

  it('recua quando a busca encurta a lista abaixo da página atual', () => {
    // estava na página 8 e o filtro deixou 5 resultados
    expect(fatiar(5, 8)).toMatchObject({ atual: 0, inicio: 0, fim: 5 })
  })

  it('sempre tem ao menos uma página, mesmo sem resultado', () => {
    expect(fatiar(0, 0).totalPaginas).toBe(1)
  })
})
