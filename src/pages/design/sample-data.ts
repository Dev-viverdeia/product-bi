/* Dados de exemplo do showcase — determinísticos, formato realista. */

import type { CategoryDatum, DonutDatum, TimeSeriesPoint } from '@/components/charts'

export const receitaMensal: TimeSeriesPoint[] = [
  { x: '2025-09-01', receita: 182_000 },
  { x: '2025-10-01', receita: 198_500 },
  { x: '2025-11-01', receita: 224_000 },
  { x: '2025-12-01', receita: 261_300 },
  { x: '2026-01-01', receita: 243_800 },
  { x: '2026-02-01', receita: 258_100 },
  { x: '2026-03-01', receita: 289_400 },
  { x: '2026-04-01', receita: 301_200 },
  { x: '2026-05-01', receita: 296_700 },
  { x: '2026-06-01', receita: 318_900 },
  { x: '2026-07-01', receita: 342_600 },
  { x: '2026-08-01', receita: 357_100 },
]

export const usuariosMensal: TimeSeriesPoint[] = [
  { x: '2026-01-01', novos: 420, recorrentes: 2_180 },
  { x: '2026-02-01', novos: 465, recorrentes: 2_310 },
  { x: '2026-03-01', novos: 512, recorrentes: 2_495 },
  { x: '2026-04-01', novos: 488, recorrentes: 2_640 },
  { x: '2026-05-01', novos: 531, recorrentes: 2_720 },
  { x: '2026-06-01', novos: 597, recorrentes: 2_880 },
  { x: '2026-07-01', novos: 642, recorrentes: 3_050 },
  { x: '2026-08-01', novos: 618, recorrentes: 3_210 },
]

// `satisfies` e não anotação: com `: CategoryDatum[]` o `value` de cada linha
// alarga para `number | null` — o tipo do kit, que aceita supressão — e os
// headlines do showcase, que somam e comparam, deixam de compilar. `satisfies`
// confere a conformidade e preserva o literal.
export const sessoesPorCanal = [
  { category: 'Orgânico', value: 12_400 },
  { category: 'Direto', value: 8_900 },
  { category: 'Social', value: 6_200 },
  { category: 'E-mail', value: 4_100 },
  { category: 'Pago', value: 2_800 },
] satisfies CategoryDatum[]

export const receitaPorProduto = [
  { category: 'Formação Viver de IA', value: 148_000 },
  { category: 'Comunidade', value: 96_500 },
  { category: 'Mentoria em grupo', value: 61_200 },
  { category: 'Eventos', value: 32_400 },
  { category: 'Consultoria', value: 19_000 },
] satisfies CategoryDatum[]

/**
 * O estado de valor suprimido do `CategoryBarChart`: a faixa existe, tem
 * amostra, e mesmo assim não tem taxa — porque a régua da própria função a
 * suprimiu. Está aqui porque é o defeito real que Formações publicou: com
 * `?? 0` na página, esta última faixa virava uma coluna de "0,0%" e o card
 * afirmava um precipício que o dado nega.
 */
export const conclusaoPorDuracao = [
  { category: 'Até 5 min (124 aulas)', value: 0.7694 },
  { category: '5–10 min (135 aulas)', value: 0.7433 },
  { category: '10–20 min (89 aulas)', value: 0.6895 },
  { category: '20–30 min (15 aulas)', value: 0.6287 },
  {
    category: '30–60 min (2 aulas)',
    value: null,
    motivoSemValor: 'amostra de 2 aulas, mínimo de 10',
  },
] satisfies CategoryDatum[]

export const assinaturasPorPlano: DonutDatum[] = [
  { name: 'Anual', value: 1_420 },
  { name: 'Mensal', value: 890 },
  { name: 'Trimestral', value: 410 },
  { name: 'Corporativo', value: 180 },
  { name: 'Educacional', value: 96 },
  { name: 'Legado', value: 44 },
]

export const kpis = {
  receita: {
    value: 357_100,
    delta: 0.042,
    trend: [182, 198.5, 224, 261.3, 243.8, 258.1, 289.4, 301.2, 296.7, 318.9, 342.6, 357.1],
  },
  usuariosAtivos: {
    value: 3_828,
    delta: 0.058,
    trend: [2.4, 2.6, 2.78, 3.0, 3.13, 3.25, 3.48, 3.61, 3.55, 3.69, 3.79, 3.83],
  },
  conversao: {
    value: 0.034,
    delta: 0.006,
    trend: [2.8, 2.9, 3.1, 3.0, 3.2, 3.1, 3.3, 3.2, 3.4, 3.3, 3.5, 3.4],
  },
  churn: {
    value: 0.021,
    delta: -0.004,
    trend: [3.1, 3.0, 2.8, 2.9, 2.7, 2.6, 2.5, 2.6, 2.4, 2.3, 2.2, 2.1],
  },
}
