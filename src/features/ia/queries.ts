import { useQuery } from '@tanstack/react-query'

import type { Periodo } from '@/components/filters/periodo-filtro'
import { supabase } from '@/lib/supabase'

async function rpc<T>(promise: PromiseLike<{ data: T | null; error: { message: string } | null }>) {
  const { data, error } = await promise
  if (error) throw new Error(error.message)
  return data
}

export function useIaKpis(dias: Periodo) {
  return useQuery({
    queryKey: ['ia', 'kpis', dias],
    queryFn: async () => {
      const rows = await rpc(supabase.rpc('bi_ia_kpis', { p_dias: dias }))
      return rows?.[0] ?? null
    },
  })
}

export function useIaAdocao(dias: Periodo) {
  return useQuery({
    queryKey: ['ia', 'adocao', dias],
    queryFn: async () => (await rpc(supabase.rpc('bi_ia_adocao', { p_dias: dias }))) ?? [],
  })
}

export function useConsultorRecorrencia(dias: Periodo) {
  return useQuery({
    queryKey: ['ia', 'recorrencia', dias],
    queryFn: async () =>
      (await rpc(supabase.rpc('bi_consultor_recorrencia', { p_dias: dias }))) ?? [],
  })
}

export function useConsultorModos() {
  return useQuery({
    queryKey: ['ia', 'modos'],
    queryFn: async () => (await rpc(supabase.rpc('bi_consultor_modos'))) ?? [],
  })
}

export function useBuilderSteps() {
  return useQuery({
    queryKey: ['ia', 'builder-steps'],
    queryFn: async () =>
      (await rpc(supabase.rpc('bi_builder_steps', { p_dias: 90 }))) ?? [],
  })
}

export function useIaImpactoRetencao() {
  return useQuery({
    queryKey: ['ia', 'impacto-retencao'],
    queryFn: async () => (await rpc(supabase.rpc('bi_ia_impacto_retencao'))) ?? [],
  })
}
