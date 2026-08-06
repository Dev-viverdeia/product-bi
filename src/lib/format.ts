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

/** "2026-03-08" → "8 mar" */
export function formatDateShort(isoDate: string) {
  const date = new Date(`${isoDate.slice(0, 10)}T12:00:00`)
  return date
    .toLocaleDateString(locale, { day: 'numeric', month: 'short' })
    .replace('.', '')
}
