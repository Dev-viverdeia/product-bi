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

export function useClientesEmRisco() {
  return useQuery({
    queryKey: ['clientes', 'em-risco'],
    queryFn: async () =>
      (await rpc(supabase.rpc('bi_clientes_em_risco', { p_limite: 30 }))) ?? [],
  })
}

export function useAhaMoment() {
  return useQuery({
    queryKey: ['clientes', 'aha-moment'],
    queryFn: async () => (await rpc(supabase.rpc('bi_aha_moment'))) ?? [],
  })
}

export function useChurnResumo() {
  return useQuery({
    queryKey: ['clientes', 'churn-resumo'],
    queryFn: async () => {
      const rows = await rpc(supabase.rpc('bi_churn_resumo'))
      return rows?.[0] ?? null
    },
  })
}

export function useChurnModulos() {
  return useQuery({
    queryKey: ['clientes', 'churn-modulos'],
    queryFn: async () => (await rpc(supabase.rpc('bi_churn_modulos'))) ?? [],
  })
}

export function useChurnUltimoModulo() {
  return useQuery({
    queryKey: ['clientes', 'churn-ultimo-modulo'],
    queryFn: async () => (await rpc(supabase.rpc('bi_churn_ultimo_modulo'))) ?? [],
  })
}
