import { useQuery } from '@tanstack/react-query'

import type { Periodo } from '@/components/filters/periodo-filtro'
import { supabase } from '@/lib/supabase'

async function rpc<T>(promise: PromiseLike<{ data: T | null; error: { message: string } | null }>) {
  const { data, error } = await promise
  if (error) throw new Error(error.message)
  return data
}

export function useEngajamento(dias: Periodo) {
  return useQuery({
    queryKey: ['clientes', 'engajamento', dias],
    queryFn: async () => {
      const rows = await rpc(supabase.rpc('bi_engajamento_clientes', { p_dias: dias }))
      return rows?.[0] ?? null
    },
  })
}

export function useRetencaoCohort() {
  return useQuery({
    queryKey: ['clientes', 'retencao-cohort'],
    queryFn: async () => (await rpc(supabase.rpc('bi_retencao_cohort'))) ?? [],
  })
}

export function useDiasAtivosDistribuicao(dias: Periodo) {
  return useQuery({
    queryKey: ['clientes', 'dias-ativos', dias],
    queryFn: async () =>
      (await rpc(supabase.rpc('bi_dias_ativos_distribuicao', { p_dias: dias }))) ?? [],
  })
}

export function useAmplitudeModulos(dias: Periodo) {
  return useQuery({
    queryKey: ['clientes', 'amplitude', dias],
    queryFn: async () =>
      (await rpc(supabase.rpc('bi_amplitude_modulos', { p_dias: dias }))) ?? [],
  })
}

export function useRetencaoPorAmplitude() {
  return useQuery({
    queryKey: ['clientes', 'retencao-amplitude'],
    queryFn: async () =>
      (await rpc(supabase.rpc('bi_retencao_por_amplitude'))) ?? [],
  })
}

export function usePowerUsers(dias: Periodo) {
  return useQuery({
    queryKey: ['clientes', 'power-users', dias],
    queryFn: async () =>
      (await rpc(supabase.rpc('bi_power_users', { p_dias: dias, p_limite: 15 }))) ?? [],
  })
}
