/* Formatadores pt-BR compartilhados por gráficos, KPIs e tabelas. */

const locale = 'pt-BR'

const compact = new Intl.NumberFormat(locale, {
  notation: 'compact',
  maximumFractionDigits: 1,
})

const integer = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 })

const currency = new Intl.NumberFormat(locale, {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
})

const currencyCompact = new Intl.NumberFormat(locale, {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
})

const percent = new Intl.NumberFormat(locale, {
  style: 'percent',
  maximumFractionDigits: 1,
})

/** 1.284 → "1,3 mil" · 4200000 → "4,2 mi" */
export function formatCompact(value: number) {
  return compact.format(value)
}

/** 1284 → "1.284" */
export function formatInt(value: number) {
  return integer.format(value)
}

const decimal = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 })

/** 2.94 → "2,9" */
export function formatDecimal(value: number) {
  return decimal.format(value)
}

/** 4200 → "R$ 4.200" */
export function formatCurrency(value: number) {
  return currency.format(value)
}

/** 4200000 → "R$ 4,2 mi" */
export function formatCurrencyCompact(value: number) {
  return currencyCompact.format(value)
}

/** 0.042 → "4,2%" */
export function formatPercent(value: number) {
  return percent.format(value)
}

/** 0.042 → "+4,2%" · -0.018 → "−1,8%" (sinal sempre visível, para deltas) */
export function formatSignedPercent(value: number) {
  const abs = percent.format(Math.abs(value))
  if (value === 0) return abs
  return value > 0 ? `+${abs}` : `−${abs}`
}

/** "2026-03-01" → "mar" */
export function formatMonthShort(isoDate: string) {
  const date = new Date(`${isoDate.slice(0, 10)}T12:00:00`)
  return date
    .toLocaleDateString(locale, { month: 'short' })
    .replace('.', '')
}

/** "2026-03-01" → "mar/26" */
export function formatMesAno(isoDate: string) {
  const date = new Date(`${isoDate.slice(0, 10)}T12:00:00`)
  return date
    .toLocaleDateString(locale, { month: 'short', year: '2-digit' })
    .replace('. de ', '/')
    .replace('.', '')
}

/**
 * "2026-03-08" → "8 de mar"
 *
 * Mantém o "de" do pt-BR: além do eixo de tempo, alimenta prosa como
 * "desde 3 de jul, quando a navegação passou a ser rastreada" — sem o "de" o
 * texto fica telegráfico.
 */
export function formatDateShort(isoDate: string) {
  const date = new Date(`${isoDate.slice(0, 10)}T12:00:00`)
  return date
    .toLocaleDateString(locale, { day: 'numeric', month: 'short' })
    .replace('.', '')
}

/**
 * Timestamp completo → "8 de ago, 15:30" em horário de Brasília.
 *
 * O fuso é fixado de propósito. Todo o resto do BI usa colunas `*_brt`
 * pré-computadas no banco; se este formatador usasse o fuso do navegador, quem
 * abrisse de outro fuso veria uma hora que contradiz o resto da tela.
 */
const dataHora = new Intl.DateTimeFormat(locale, {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'America/Sao_Paulo',
})

export function formatDataHora(iso: string) {
  return dataHora.format(new Date(iso)).replace('.', '')
}

/**
 * Horas decimais → duração que se lê sem fazer conta: 0,5 → "30 minutos" ·
 * 8,2 → "8 horas" · 46,9 → "2 dias".
 *
 * "46,9h" obriga o leitor a dividir por 24 para entender se o dado é de ontem
 * ou da semana passada — que é justamente a pergunta que ele está fazendo.
 */
export function formatDuracao(horas: number) {
  const h = Math.max(horas, 0)

  if (h < 1) {
    const minutos = Math.max(Math.round(h * 60), 1)
    return `${minutos} ${minutos === 1 ? 'minuto' : 'minutos'}`
  }
  if (h < 24) {
    const arredondado = Math.round(h)
    return `${arredondado} ${arredondado === 1 ? 'hora' : 'horas'}`
  }
  const dias = Math.round(h / 24)
  return `${dias} ${dias === 1 ? 'dia' : 'dias'}`
}
