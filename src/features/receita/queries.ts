import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'

async function rpc<T>(promise: PromiseLike<{ data: T | null; error: { message: string } | null }>) {
  const { data, error } = await promise
  if (error) throw new Error(error.message)
  return data
}

export function useReceitaKpis() {
  return useQuery({
    queryKey: ['receita', 'kpis'],
    queryFn: async () => {
      const rows = await rpc(supabase.rpc('bi_receita_kpis'))
      return rows?.[0] ?? null
    },
  })
}

export function useReceitaMensal() {
  return useQuery({
    queryKey: ['receita', 'mensal'],
    queryFn: async () => (await rpc(supabase.rpc('bi_receita_mensal'))) ?? [],
  })
}

export function useSaudeCobranca() {
  return useQuery({
    queryKey: ['receita', 'saude-cobranca'],
    queryFn: async () => (await rpc(supabase.rpc('bi_receita_saude_cobranca'))) ?? [],
  })
}

export function useLtvCohort() {
  return useQuery({
    queryKey: ['receita', 'ltv-cohort'],
    queryFn: async () => (await rpc(supabase.rpc('bi_ltv_cohort'))) ?? [],
  })
}

export function useUsoVsReceita() {
  return useQuery({
    queryKey: ['receita', 'uso-vs-receita'],
    queryFn: async () => (await rpc(supabase.rpc('bi_uso_vs_receita'))) ?? [],
  })
}
