import { useQuery } from '@tanstack/react-query'

import type { Periodo } from '@/components/filters/periodo-filtro'
import { rpc } from '@/lib/rpc'
import { argsSegmento, type Recorte } from '@/lib/segmento'
import { supabase } from '@/lib/supabase'

/** Telas que já têm motor de achados. CS entra depois — tem pendência em aberto. */
export type TelaComResumo =
  | 'visao-geral'
  | 'clientes'
  | 'entrada'
  | 'formacoes'
  | 'solucoes'
  | 'ia'
  | 'organizacoes'
  | 'jornada'
  | 'receita'

const RPC_POR_TELA = {
  'visao-geral': 'bi_achados_visao_geral',
  clientes: 'bi_achados_clientes',
  entrada: 'bi_achados_entrada',
  formacoes: 'bi_achados_formacoes',
  solucoes: 'bi_achados_solucoes',
  ia: 'bi_achados_ia',
  organizacoes: 'bi_achados_organizacoes',
  jornada: 'bi_achados_jornada',
  receita: 'bi_achados_receita',
} as const

export type Achado = {
  regra: string
  familia: string
  severidade: string
  titulo: string
  /** o fato, com o número e a régua */
  gabarito: string
  /** o que o fato quer dizer — e o que ele não quer dizer */
  gabarito_leitura: string
  /** o que fazer a respeito */
  gabarito_acao: string
  parametros: Record<string, unknown> | null
  score: number
  suprimida: boolean
  motivo: string | null
  ancora_aba: string | null
  ancora_id: string
}

/**
 * Achados de uma tela.
 *
 * `dias` e `recorte` são opcionais porque nem toda tela tem os dois controles:
 * Receita e Organizações não têm seletor de período, e só Clientes tem o
 * recorte por persona. Quando o argumento não vem, ele não é enviado — a RPC
 * usa o próprio padrão e a tela não passa a afirmar um escopo que não oferece.
 */
export function useAchados(tela: TelaComResumo, dias?: Periodo, recorte?: Recorte) {
  return useQuery({
    queryKey: ['resumo', tela, dias ?? null, recorte?.papel ?? null, recorte?.plano ?? null],
    queryFn: async () => {
      const rows = await rpc(
        supabase.rpc(RPC_POR_TELA[tela], {
          ...(dias === undefined ? {} : { p_dias: dias }),
          ...(recorte === undefined ? {} : argsSegmento(recorte)),
        }),
      )
      return (rows ?? []) as unknown as Achado[]
    },
  })
}

/**
 * Data do último dia com dado carregado.
 *
 * O bloco de resumo carimba isso sempre, não só quando o pipeline para: um
 * texto que afirma coisas sobre "o período" precisa dizer de quando é o
 * período, ou o leitor assume que é de agora.
 */
export function useDataReferencia() {
  return useQuery({
    queryKey: ['resumo', 'data-referencia'],
    refetchInterval: 5 * 60 * 1000,
    queryFn: async () => await rpc(supabase.rpc('bi_data_referencia')),
  })
}

export function useRegras() {
  return useQuery({
    queryKey: ['resumo', 'regras'],
    staleTime: Infinity,
    queryFn: async () => (await rpc(supabase.rpc('bi_regras'))) ?? [],
  })
}
