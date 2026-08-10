import { describe, expect, it } from 'vitest'

import { rpc } from '@/lib/rpc'

/**
 * O helper é o ponto único onde erro de RPC vira exceção. Se ele engolir o erro
 * e devolver null, a tela mostra estado vazio em vez de estado de falha — e
 * "sem dado" se lê como "não tem nada", não como "não deu para saber".
 */
describe('rpc', () => {
  it('devolve o dado quando não há erro', async () => {
    await expect(rpc(Promise.resolve({ data: [{ n: 1 }], error: null }))).resolves.toEqual([
      { n: 1 },
    ])
  })

  it('lança quando a RPC devolve erro', async () => {
    await expect(
      rpc(Promise.resolve({ data: null, error: { message: 'permission denied' } })),
    ).rejects.toThrow('permission denied')
  })

  it('lança mesmo quando vem erro junto com dado parcial', async () => {
    await expect(
      rpc(Promise.resolve({ data: [{ n: 1 }], error: { message: 'statement timeout' } })),
    ).rejects.toThrow('statement timeout')
  })

  it('deixa passar data nulo sem erro — resposta vazia legítima', async () => {
    await expect(rpc(Promise.resolve({ data: null, error: null }))).resolves.toBeNull()
  })
})
