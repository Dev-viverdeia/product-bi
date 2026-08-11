import { describe, expect, it } from 'vitest'

import {
  comSegmento,
  notaAmostra,
  papelDaUrl,
  planoDaUrl,
} from '@/lib/segmento'

describe('papelDaUrl / planoDaUrl', () => {
  it('aceita apenas valores do contrato', () => {
    expect(papelDaUrl('hands_on')).toBe('hands_on')
    expect(papelDaUrl('master_user')).toBe('master_user')
    expect(papelDaUrl('membro_club')).toBe('membro_club')
    expect(planoDaUrl('starter')).toBe('starter')
    expect(planoDaUrl('sem_plano')).toBe('sem_plano')
  })

  it('descarta papel fora do contrato — os 7 papéis restantes não são opção', () => {
    expect(papelDaUrl('trial')).toBeNull()
    expect(papelDaUrl('formacao')).toBeNull()
    expect(papelDaUrl('qualquer_coisa')).toBeNull()
    expect(papelDaUrl(null)).toBeNull()
    expect(planoDaUrl('gold')).toBeNull()
    expect(planoDaUrl(null)).toBeNull()
  })
})

describe('comSegmento', () => {
  it('sem recorte ativo devolve o link intacto', () => {
    expect(comSegmento('/clientes', new URLSearchParams())).toBe('/clientes')
  })

  it('propaga papel e plano ativos', () => {
    const params = new URLSearchParams('papel=master_user&plano=pro')
    expect(comSegmento('/clientes', params)).toBe(
      '/clientes?papel=master_user&plano=pro',
    )
  })

  it('emenda com & quando o link já tem query (atalho de aba)', () => {
    const params = new URLSearchParams('papel=hands_on')
    expect(comSegmento('/clientes?aba=risco', params)).toBe(
      '/clientes?aba=risco&papel=hands_on',
    )
  })

  it('não propaga lixo da URL — só valores do contrato viajam', () => {
    const params = new URLSearchParams('papel=hacker&plano=starter')
    expect(comSegmento('/', params)).toBe('/?plano=starter')
  })
})

describe('notaAmostra', () => {
  it('declara o tamanho da amostra e o piso, em pt-BR', () => {
    expect(notaAmostra(12)).toBe('amostra de 12 (mínimo 30)')
    expect(notaAmostra(1234)).toBe('amostra de 1.234 (mínimo 30)')
  })

  it('sem denominador conhecido, declara mesmo assim', () => {
    expect(notaAmostra(null)).toBe('amostra abaixo do mínimo de 30')
    expect(notaAmostra(undefined)).toBe('amostra abaixo do mínimo de 30')
  })
})
