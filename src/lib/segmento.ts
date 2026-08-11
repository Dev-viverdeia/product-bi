import { formatInt } from '@/lib/format'

/**
 * Recorte transversal por persona/plano — contrato em docs/roadmap-bi.md
 * (seção Transversal). O recorte restringe o CONJUNTO DE CLIENTES e vale para
 * as métricas centrais de cada módulo; é sempre pelo papel/plano ATUAL, porque
 * a dim não guarda histórico.
 */

export const PARAM_PAPEL = 'papel'
export const PARAM_PLANO = 'plano'

/**
 * Os três papéis cobrem 99,2% dos clientes. Os sete restantes não viram opção
 * de filtro: recorte que nasce suprimido não é oferta — e "Todos" os inclui.
 */
export const PAPEIS = [
  { valor: 'hands_on', rotulo: 'Hands-on' },
  { valor: 'master_user', rotulo: 'Master' },
  { valor: 'membro_club', rotulo: 'Membro do Club' },
] as const

/** 'sem_plano' agrupa quem tem plano nulo na dim — grupo real, não erro. */
export const PLANOS = [
  { valor: 'starter', rotulo: 'Starter' },
  { valor: 'pro', rotulo: 'Pro' },
  { valor: 'enterprise', rotulo: 'Enterprise' },
  { valor: 'sem_plano', rotulo: 'Sem plano' },
] as const

export type Papel = (typeof PAPEIS)[number]['valor']
export type Plano = (typeof PLANOS)[number]['valor']

/** Recorte ativo repassado às RPCs; null = todos. */
export type Recorte = { papel: Papel | null; plano: Plano | null }

/**
 * Argumentos de RPC do recorte. `undefined` (e não null) porque o supabase-js
 * omite a chave do corpo e a função usa o próprio default — null explícito
 * também funcionaria, mas o typegen declara os parâmetros como opcionais.
 */
export function argsSegmento({ papel, plano }: Recorte) {
  return { p_papel: papel ?? undefined, p_plano: plano ?? undefined }
}

/**
 * Piso de amostra do contrato: percentual, taxa e média só com denominador
 * ≥ 30. Espelha o literal das RPCs (migration 20260811190000) — quem suprime é
 * o banco; esta constante existe para a tela DECLARAR a supressão, nunca para
 * recalcular a régua no cliente.
 */
export const AMOSTRA_MINIMA = 30

/** Valor vindo da URL só entra se for um papel do contrato. */
export function papelDaUrl(bruto: string | null): Papel | null {
  return PAPEIS.find((p) => p.valor === bruto)?.valor ?? null
}

/** Rótulo pt-BR de um papel; devolve o valor cru se não for do contrato. */
export function rotuloPapel(valor: string): string {
  return PAPEIS.find((p) => p.valor === valor)?.rotulo ?? valor
}

/** Valor vindo da URL só entra se for um plano do contrato. */
export function planoDaUrl(bruto: string | null): Plano | null {
  return PLANOS.find((p) => p.valor === bruto)?.valor ?? null
}

/**
 * Propaga o recorte ativo para um link interno — o recorte é do app, não da
 * tela, então navegar entre módulos não pode zerá-lo em silêncio.
 */
export function comSegmento(to: string, params: URLSearchParams): string {
  const seg = new URLSearchParams()
  const papel = papelDaUrl(params.get(PARAM_PAPEL))
  const plano = planoDaUrl(params.get(PARAM_PLANO))
  if (papel) seg.set(PARAM_PAPEL, papel)
  if (plano) seg.set(PARAM_PLANO, plano)
  const query = seg.toString()
  if (!query) return to
  return to.includes('?') ? `${to}&${query}` : `${to}?${query}`
}

/** Mensagem única de supressão — o mesmo texto em todo tile que declarar. */
export function notaAmostra(amostra: number | null | undefined): string {
  return amostra != null
    ? `amostra de ${formatInt(amostra)} (mínimo ${AMOSTRA_MINIMA})`
    : `amostra abaixo do mínimo de ${AMOSTRA_MINIMA}`
}
