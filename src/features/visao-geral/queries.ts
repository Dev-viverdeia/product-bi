import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'

export type Periodo = 7 | 30 | 90

async function rpc<T>(promise: PromiseLike<{ data: T | null; error: { message: string } | null }>) {
  const { data, error } = await promise
  if (error) throw new Error(error.message)
  return data
}

export function useKpis(dias: Periodo) {
  return useQuery({
    queryKey: ['bi', 'kpis', dias],
    queryFn: async () => {
      const rows = await rpc(supabase.rpc('bi_visao_geral_kpis', { p_dias: dias }))
      return rows?.[0] ?? null
    },
  })
}

export function useAtividadeDiaria(dias: Periodo) {
  return useQuery({
    queryKey: ['bi', 'atividade-diaria', dias],
    queryFn: async () =>
      (await rpc(supabase.rpc('bi_atividade_diaria', { p_dias: dias }))) ?? [],
  })
}

export function useHeatmapNavegacao(dias: Periodo) {
  return useQuery({
    queryKey: ['bi', 'heatmap-navegacao', dias],
    queryFn: async () =>
      (await rpc(supabase.rpc('bi_heatmap_navegacao', { p_dias: dias }))) ?? [],
  })
}

export function useEventosPorTipo(dias: Periodo) {
  return useQuery({
    queryKey: ['bi', 'eventos-por-tipo', dias],
    queryFn: async () =>
      (await rpc(supabase.rpc('bi_eventos_por_tipo', { p_dias: dias }))) ?? [],
  })
}

export function useTopTelas(dias: Periodo) {
  return useQuery({
    queryKey: ['bi', 'top-telas', dias],
    queryFn: async () =>
      (await rpc(supabase.rpc('bi_top_telas', { p_dias: dias, p_limite: 10 }))) ?? [],
  })
}

export function useUltimaSincronizacao() {
  return useQuery({
    queryKey: ['bi', 'ultima-sincronizacao'],
    // o pipeline roda a cada 30 min — manter o carimbo fresco
    refetchInterval: 5 * 60 * 1000,
    queryFn: async () => await rpc(supabase.rpc('bi_ultima_sincronizacao')),
  })
}

/** Delta relativo vs período anterior; indefinido quando não computável. */
export function calcularDelta(atual: number, anterior: number): number | undefined {
  if (anterior <= 0) return undefined
  return (atual - anterior) / anterior
}
