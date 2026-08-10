import { useQuery } from '@tanstack/react-query'

import type { Periodo } from '@/components/filters/periodo-filtro'
import { rpc } from '@/lib/rpc'
import { supabase } from '@/lib/supabase'

export function useFormacoesKpis(dias: Periodo) {
  return useQuery({
    queryKey: ['formacoes', 'kpis', dias],
    queryFn: async () => {
      const rows = await rpc(supabase.rpc('bi_formacoes_kpis', { p_dias: dias }))
      return rows?.[0] ?? null
    },
  })
}

export function useFormacoesUso(dias: Periodo) {
  return useQuery({
    queryKey: ['formacoes', 'uso', dias],
    queryFn: async () =>
      (await rpc(supabase.rpc('bi_formacoes_uso', { p_dias: dias }))) ?? [],
  })
}

export function useDuracaoIdeal() {
  return useQuery({
    queryKey: ['formacoes', 'duracao-ideal'],
    queryFn: async () => (await rpc(supabase.rpc('bi_duracao_ideal'))) ?? [],
  })
}

export function useDropoffPosicao() {
  return useQuery({
    queryKey: ['formacoes', 'dropoff'],
    queryFn: async () => (await rpc(supabase.rpc('bi_dropoff_posicao'))) ?? [],
  })
}

export function useNpsCursos() {
  return useQuery({
    queryKey: ['formacoes', 'nps-cursos'],
    queryFn: async () =>
      (await rpc(supabase.rpc('bi_nps_cursos', { p_min_respostas: 10 }))) ?? [],
  })
}

export function useJornadaCursos() {
  return useQuery({
    queryKey: ['formacoes', 'jornada'],
    queryFn: async () =>
      (await rpc(supabase.rpc('bi_jornada_cursos', { p_min_certificados: 20 }))) ?? [],
  })
}

export function useAssuntos(dias: Periodo) {
  return useQuery({
    queryKey: ['formacoes', 'assuntos', dias],
    queryFn: async () =>
      (await rpc(supabase.rpc('bi_assuntos', { p_dias: dias }))) ?? [],
  })
}
