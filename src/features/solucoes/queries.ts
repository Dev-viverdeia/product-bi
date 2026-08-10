import { useQuery } from '@tanstack/react-query'

import type { Periodo } from '@/components/filters/periodo-filtro'
import { rpc } from '@/lib/rpc'
import { supabase } from '@/lib/supabase'

export function useSolucoesKpis(dias: Periodo) {
  return useQuery({
    queryKey: ['solucoes', 'kpis', dias],
    queryFn: async () => {
      const rows = await rpc(supabase.rpc('bi_solucoes_kpis', { p_dias: dias }))
      return rows?.[0] ?? null
    },
  })
}

export function useSolucoesRanking() {
  return useQuery({
    queryKey: ['solucoes', 'ranking'],
    queryFn: async () =>
      (await rpc(supabase.rpc('bi_solucoes_ranking', { p_limite: 200 }))) ?? [],
  })
}

export function useCandidatasRemocao() {
  return useQuery({
    queryKey: ['solucoes', 'candidatas-remocao'],
    queryFn: async () =>
      (await rpc(supabase.rpc('bi_solucoes_candidatas_remocao'))) ?? [],
  })
}

export function useConclusaoPorAba() {
  return useQuery({
    queryKey: ['solucoes', 'conclusao-por-aba'],
    queryFn: async () => (await rpc(supabase.rpc('bi_solucoes_conclusao_por_aba'))) ?? [],
  })
}

export function useConversaoTela(dias: Periodo) {
  return useQuery({
    queryKey: ['solucoes', 'conversao-tela', dias],
    queryFn: async () =>
      (await rpc(supabase.rpc('bi_solucoes_conversao_tela', { p_dias: dias }))) ?? [],
  })
}

export function useSolucoesPorCategoria() {
  return useQuery({
    queryKey: ['solucoes', 'por-categoria'],
    queryFn: async () =>
      (await rpc(supabase.rpc('bi_solucoes_por_categoria'))) ?? [],
  })
}
