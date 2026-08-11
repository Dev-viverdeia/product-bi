import {
  formatDecimal,
  formatInt,
  formatPercent,
  formatSignedPercent,
} from '@/lib/format'
import { labelTipoEvento } from '@/lib/labels-plataforma'
import { rotuloPapel } from '@/lib/segmento'

/**
 * Preenchimento do gabarito de um achado.
 *
 * O motor devolve a frase com marcadores (`{taxa_maior:pct}`) e os valores num
 * objeto à parte. A separação existe por dois motivos:
 *
 * - **O número nunca é escrito pelo texto.** O gabarito não pode conter dígito,
 *   e um teste reprova o contrário. Assim a régua viaja como parâmetro
 *   (`janela_churn: 60`) emitido pela mesma função que calcula o achado — se a
 *   janela mudar no banco, a frase acompanha sozinha.
 * - **A formatação pt-BR mora num lugar só.** Quem formata é `lib/format`, do
 *   mesmo jeito que nos cards; o banco devolve número cru.
 */

const FORMATOS = {
  /** fração 0–1 → "37,1%" */
  pct: (v: unknown) => formatPercent(Number(v)),
  /** fração com sinal → "+4,2%" */
  pctsigned: (v: unknown) => formatSignedPercent(Number(v)),
  /** inteiro com separador de milhar */
  int: (v: unknown) => formatInt(Number(v)),
  /** uma casa decimal */
  dec: (v: unknown) => formatDecimal(Number(v)),
  /** pontos percentuais → "18,3 pp" */
  pp: (v: unknown) => `${formatDecimal(Number(v))} pp`,
  /** multiplicador → "2,1×" */
  mult: (v: unknown) => `${formatDecimal(Number(v))}×`,
  /** tipo de evento da plataforma → rótulo em pt-BR */
  evento: (v: unknown) => labelTipoEvento(String(v)),
  /** papel do contrato → rótulo em pt-BR */
  papel: (v: unknown) => rotuloPapel(String(v)),
} as const

export type FormatoDeGabarito = keyof typeof FORMATOS

const MARCADOR = /\{([a-z_]+)(?::([a-z]+))?\}/g

/**
 * Troca os marcadores pelos valores formatados.
 *
 * Marcador sem valor correspondente vira `—` em vez de sumir ou vazar o nome
 * da chave: uma frase à qual falta um número precisa parecer incompleta, não
 * parecer correta.
 */
export function preencherGabarito(
  gabarito: string,
  parametros: Record<string, unknown> | null | undefined,
): string {
  const valores = parametros ?? {}

  return gabarito.replace(MARCADOR, (_original, chave: string, formato?: string) => {
    const valor = valores[chave]
    if (valor === undefined || valor === null) return '—'

    const formatador = formato ? FORMATOS[formato as FormatoDeGabarito] : undefined
    return formatador ? formatador(valor) : String(valor)
  })
}

/** Nomes de marcador usados no gabarito — para teste e para a página /regras. */
export function marcadoresDe(gabarito: string): string[] {
  return [...gabarito.matchAll(MARCADOR)].map((m) => m[1]!)
}
