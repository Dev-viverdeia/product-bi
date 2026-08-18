import { describe, expect, it } from 'vitest'

import {
  VEREDITOS,
  contarQuebrados,
  evidenciaDoVeredito,
  lerVeredito,
  pilulaDoRastreio,
} from './rastreio'

describe('leitura do veredito de rastreio', () => {
  it('cobre todos os vereditos que o banco pode gravar', () => {
    for (const veredito of VEREDITOS) {
      expect(lerVeredito(veredito)).not.toBeNull()
    }
  })

  /*
    Os três estados precisam ser distinguíveis SEM cor — é regra do DS, e aqui
    é também regra de conteúdo: "parado" virou três coisas diferentes, e o card
    existe justamente para separá-las.
  */
  it('dá rótulo e tom distintos a cada veredito', () => {
    const leituras = VEREDITOS.map((v) => lerVeredito(v)!)
    expect(new Set(leituras.map((l) => l.rotulo)).size).toBe(VEREDITOS.length)
    expect(new Set(leituras.map((l) => l.tom)).size).toBe(VEREDITOS.length)
  })

  it('só "quebrado" é crítico', () => {
    expect(lerVeredito('quebrado')?.tom).toBe('critico')
    expect(lerVeredito('sem_uso')?.tom).toBe('neutro')
    expect(lerVeredito('sem_corroboracao')?.tom).toBe('atencao')
  })

  /*
    Tipo ativo não tem linha em marts.rastreio_corroboracao, então chega null.
    E se um veredito novo aparecer no banco antes de a tela conhecê-lo, o certo
    é não mostrar nada — carimbar o estado com o rótulo errado é pior que o
    silêncio, que é a tese do card inteiro.
  */
  it('devolve null para ausência e para veredito desconhecido', () => {
    expect(lerVeredito(null)).toBeNull()
    expect(lerVeredito(undefined)).toBeNull()
    expect(lerVeredito('')).toBeNull()
    expect(lerVeredito('inventado')).toBeNull()
  })
})

describe('contagem do headline', () => {
  const linhas = [
    { veredito: 'quebrado' },
    { veredito: 'sem_uso' },
    { veredito: 'sem_corroboracao' },
    { veredito: null },
  ]

  /*
    Sem corroboração NÃO entra na conta. connection_accepted é o caso vivo: foi
    medido como quebrado consultando a plataforma direto, mas a fonte
    (member_connections) não está espelhada, então o BI não consegue recomputar
    a prova. Publicar como quebrado seria afirmar o que a tela não sustenta.
  */
  it('conta só o que tem prova de estar quebrado', () => {
    expect(contarQuebrados(linhas)).toBe(1)
  })

  it('é zero quando não há nenhum', () => {
    expect(contarQuebrados([{ veredito: null }, { veredito: 'sem_uso' }])).toBe(0)
    expect(contarQuebrados([])).toBe(0)
  })
})

describe('pílula da linha', () => {
  /*
    O crítico é do veredito, nunca da recência: era assim que a Comunidade
    aparecia vermelha ("parado") e cinza ("sem uso") na mesma linha.
  */
  it('o veredito manda, mesmo com o tipo parado', () => {
    expect(pilulaDoRastreio('parado', 'sem_uso')).toEqual({ rotulo: 'sem uso', tom: 'neutro' })
    expect(pilulaDoRastreio('parado', 'quebrado')).toEqual({
      rotulo: 'rastreio quebrado',
      tom: 'critico',
    })
  })

  it('tipo ativo não tem veredito e fica em dia', () => {
    expect(pilulaDoRastreio('ativo', null)).toEqual({ rotulo: 'em dia', tom: 'bom' })
  })

  it('calou e o cron ainda não passou: a verificar, não erro', () => {
    expect(pilulaDoRastreio('atrasado', null)).toEqual({ rotulo: 'a verificar', tom: 'neutro' })
  })
})

describe('evidência do veredito', () => {
  it('quebrado mostra quanto a fonte registrou depois do silêncio', () => {
    expect(
      evidenciaDoVeredito({
        veredito: 'quebrado',
        fonte: 'marts.fact_progresso_solucao',
        registros_na_fonte: 24643,
      }),
    ).toContain('24643')
  })

  it('sem uso diz que a fonte parou junto', () => {
    expect(
      evidenciaDoVeredito({
        veredito: 'sem_uso',
        fonte: 'plataforma.community_posts (raiz)',
        registros_na_fonte: 0,
      }),
    ).toContain('também parou')
  })

  it('sem corroboração declara a ausência da fonte', () => {
    expect(
      evidenciaDoVeredito({
        veredito: 'sem_corroboracao',
        fonte: null,
        registros_na_fonte: null,
      }),
    ).toContain('nenhuma fonte')
  })

  it('tipo ativo não tem evidência a mostrar', () => {
    expect(evidenciaDoVeredito({ veredito: null, fonte: null, registros_na_fonte: null })).toBeNull()
  })
})
