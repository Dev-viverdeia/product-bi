import { describe, expect, it } from 'vitest'

import {
  formatCompact,
  formatCurrency,
  formatCurrencyCompact,
  formatDataHora,
  formatDateShort,
  formatDecimal,
  formatDuracao,
  formatInt,
  formatMesAno,
  formatMonthShort,
  formatPercent,
  formatSignedPercent,
} from '@/lib/format'

/**
 * Formatação em pt-BR é contrato de leitura: vírgula decimal, ponto de milhar e
 * abreviação em português. Um número certo escrito no formato errado é lido
 * errado — "1.284" em en-US é mil vezes menor que em pt-BR.
 *
 * As saídas de Intl vêm com espaço não-quebrável (NBSP e NNBSP) em moeda e em
 * abreviação. Os testes normalizam para espaço comum: o que está sob teste é o
 * formato, não o code point do espaço, que varia com a versão do ICU.
 */
// U+00A0 NBSP e U+202F NNBSP como escape: o ESLint proíbe espaço irregular no
// fonte, e literal aqui ficaria invisível na revisão
const semNbsp = (s: string) => s.replace(/[\u00A0\u202F]/g, ' ')

describe('números', () => {
  it('formata inteiro com ponto de milhar', () => {
    expect(formatInt(1284)).toBe('1.284')
    expect(formatInt(1284567)).toBe('1.284.567')
  })

  it('arredonda decimal para uma casa com vírgula', () => {
    expect(formatDecimal(2.94)).toBe('2,9')
    expect(formatDecimal(44.6)).toBe('44,6')
  })

  it('abrevia em português, não em inglês', () => {
    expect(semNbsp(formatCompact(1284))).toBe('1,3 mil')
    expect(semNbsp(formatCompact(4200000))).toBe('4,2 mi')
  })
})

describe('moeda', () => {
  it('formata em real sem centavos', () => {
    expect(semNbsp(formatCurrency(4200))).toBe('R$ 4.200')
  })

  it('abrevia valores grandes mantendo o símbolo', () => {
    expect(semNbsp(formatCurrencyCompact(4200000))).toBe('R$ 4,2 mi')
  })
})

describe('percentual', () => {
  it('multiplica por 100 e usa vírgula', () => {
    expect(formatPercent(0.042)).toBe('4,2%')
  })

  it('mostra o sinal nos deltas', () => {
    expect(formatSignedPercent(0.042)).toBe('+4,2%')
  })

  it('usa o sinal de menos tipográfico, não o hífen', () => {
    // U+2212 MINUS SIGN — alinha melhor que o hífen em número tabular
    expect(formatSignedPercent(-0.018)).toBe('−1,8%')
    expect(formatSignedPercent(-0.018)).not.toContain('-')
  })

  it('não põe sinal no zero', () => {
    expect(formatSignedPercent(0)).toBe('0%')
  })
})

describe('datas', () => {
  it('abrevia o mês sem ponto', () => {
    expect(formatMonthShort('2026-03-01')).toBe('mar')
  })

  it('formata mês/ano com duas casas de ano', () => {
    expect(formatMesAno('2026-03-01')).toBe('mar/26')
  })

  it('formata dia e mês mantendo o "de" do pt-BR', () => {
    // vai para o eixo de tempo e também para prosa ("desde 3 de jul, quando…"),
    // então o "de" fica; o ponto da abreviação sai
    expect(semNbsp(formatDateShort('2026-03-08'))).toBe('8 de mar')
    expect(formatDateShort('2026-03-08')).not.toContain('.')
  })

  it('ancora ao meio-dia para não escorregar de dia por fuso', () => {
    // sem a âncora T12:00:00, "2026-03-01" viraria 28/fev em fuso negativo
    expect(formatDateShort('2026-03-01')).toContain('1')
    expect(formatMonthShort('2026-03-01')).toBe('mar')
  })

  it('aceita timestamp completo, não só data', () => {
    expect(formatMesAno('2026-03-01T15:30:00+00:00')).toBe('mar/26')
  })
})

describe('formatDataHora', () => {
  it('mostra data e hora em horário de Brasília', () => {
    // 18:30 UTC = 15:30 BRT
    expect(semNbsp(formatDataHora('2026-08-08T18:30:00.040512+00:00'))).toBe('8 de ago, 15:30')
  })

  it('fixa o fuso em vez de usar o do navegador', () => {
    // mesmo instante escrito em outro offset tem que dar a mesma hora BRT,
    // senão o indicador contradiz as colunas *_brt do resto da tela
    expect(formatDataHora('2026-08-08T18:30:00+00:00')).toBe(
      formatDataHora('2026-08-08T20:30:00+02:00'),
    )
  })

  it('atravessa a virada do dia sem escorregar', () => {
    // 02:00 UTC de 09/08 ainda é 23:00 de 08/08 em Brasília
    expect(semNbsp(formatDataHora('2026-08-09T02:00:00+00:00'))).toBe('8 de ago, 23:00')
  })
})

describe('formatDuracao', () => {
  it('usa minutos abaixo de uma hora', () => {
    expect(formatDuracao(0.5)).toBe('30 minutos')
    expect(formatDuracao(1 / 60)).toBe('1 minuto')
  })

  it('usa horas até um dia', () => {
    expect(formatDuracao(1)).toBe('1 hora')
    expect(formatDuracao(8.2)).toBe('8 horas')
    expect(formatDuracao(23.4)).toBe('23 horas')
  })

  it('vira dias a partir de 24h — o leitor não deveria dividir por 24', () => {
    expect(formatDuracao(24)).toBe('1 dia')
    expect(formatDuracao(46.9)).toBe('2 dias')
  })

  it('nunca devolve zero nem negativo', () => {
    // relógio do banco à frente do cliente produziria duração negativa
    expect(formatDuracao(0)).toBe('1 minuto')
    expect(formatDuracao(-3)).toBe('1 minuto')
  })
})
