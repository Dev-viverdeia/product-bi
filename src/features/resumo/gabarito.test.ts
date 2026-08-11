import { describe, expect, it } from 'vitest'

import { marcadoresDe, preencherGabarito } from '@/features/resumo/gabarito'

describe('preencherGabarito', () => {
  it('formata cada marcador em pt-BR pelo tipo declarado', () => {
    const frase = preencherGabarito(
      '{papel_maior:papel} retém {taxa:pct} sobre {n:int} clientes — {gap:pp}, lift de {lift:mult}.',
      { papel_maior: 'master_user', taxa: 0.3711, n: 2518, gap: 18.3, lift: 2.14 },
    )
    expect(frase).toBe('Master retém 37,1% sobre 2.518 clientes — 18,3 pp, lift de 2,1×.')
  })

  it('traduz tipo de evento da plataforma', () => {
    expect(preencherGabarito('{t:evento} lidera.', { t: 'lesson_completed' })).not.toContain(
      'lesson_completed',
    )
  })

  it('mostra sinal na variação', () => {
    expect(preencherGabarito('{d:pctsigned}', { d: 0.042 })).toBe('+4,2%')
    expect(preencherGabarito('{d:pctsigned}', { d: -0.042 })).toBe('−4,2%')
  })

  it('marcador sem valor vira travessão, não some nem vaza a chave', () => {
    const frase = preencherGabarito('{a:pct} contra {b:pct}.', { a: 0.5 })
    expect(frase).toBe('50% contra —.')
    expect(frase).not.toContain('{')
    expect(frase).not.toContain('b')
  })

  it('parametros ausentes não quebram a frase', () => {
    expect(preencherGabarito('{a:int} clientes.', null)).toBe('— clientes.')
  })
})

describe('marcadoresDe', () => {
  it('lista as chaves que a frase espera', () => {
    expect(marcadoresDe('{a:pct} e {b:int} e {c}')).toEqual(['a', 'b', 'c'])
  })
})
