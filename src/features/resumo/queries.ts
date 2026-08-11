import { useQuery } from '@tanstack/react-query'

import type { Periodo } from '@/components/filters/periodo-filtro'
import { rpc } from '@/lib/rpc'
import { argsSegmento, type Recorte } from '@/lib/segmento'
import { supabase } from '@/lib/supabase'

/** Telas que já têm motor de achados. */
export type TelaComResumo = 'visao-geral' | 'clientes'

const RPC_POR_TELA = {
  'visao-geral': 'bi_achados_visao_geral',
  clientes: 'bi_achados_clientes',
} as const

export type Achado = {
  regra: string
  familia: string
  severidade: string
  titulo: string
  gabarito: string
  gabarito_acao: string
  parametros: Record<string, unknown> | null
  score: number
  suprimida: boolean
  motivo: string | null
  ancora_aba: string | null
  ancora_id: string
}

export function useAchados(tela: TelaComResumo, dias: Periodo, recorte: Recorte) {
  return useQuery({
    queryKey: ['resumo', tela, dias, recorte.papel, recorte.plano],
    queryFn: async () => {
      const rows = await rpc(
        supabase.rpc(RPC_POR_TELA[tela], { p_dias: dias, ...argsSegmento(recorte) }),
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
