import { useQuery } from '@tanstack/react-query'

import type { Periodo } from '@/components/filters/periodo-filtro'
import { rpc } from '@/lib/rpc'
import { supabase } from '@/lib/supabase'

export function useEntradaKpis(dias: Periodo) {
  return useQuery({
    queryKey: ['entrada', 'kpis', dias],
    queryFn: async () => {
      const rows = await rpc(supabase.rpc('bi_entrada_kpis', { p_dias: dias }))
      return rows?.[0] ?? null
    },
  })
}

export function useFunilEntrada(dias: Periodo) {
  return useQuery({
    queryKey: ['entrada', 'funil', dias],
    queryFn: async () =>
      (await rpc(supabase.rpc('bi_funil_entrada', { p_dias: dias }))) ?? [],
  })
}

export function useTempoPrimeiroValor() {
  return useQuery({
    queryKey: ['entrada', 'tempo-primeiro-valor'],
    queryFn: async () =>
      (await rpc(supabase.rpc('bi_tempo_primeiro_valor'))) ?? [],
  })
}

export function useOnboardingAbandono() {
  return useQuery({
    queryKey: ['entrada', 'onboarding-abandono'],
    queryFn: async () =>
      (await rpc(supabase.rpc('bi_onboarding_abandono'))) ?? [],
  })
}

export function useMastersResumo() {
  return useQuery({
    queryKey: ['entrada', 'masters-resumo'],
    queryFn: async () => {
      const rows = await rpc(supabase.rpc('bi_masters_convites_resumo'))
      return rows?.[0] ?? null
    },
  })
}

export function useMastersTopConvidadores() {
  return useQuery({
    queryKey: ['entrada', 'masters-top'],
    queryFn: async () =>
      (await rpc(supabase.rpc('bi_masters_top_convidadores', { p_limite: 12 }))) ?? [],
  })
}

export function useErrosLogin(dias: Periodo) {
  return useQuery({
    queryKey: ['entrada', 'erros-login', dias],
    queryFn: async () =>
      (await rpc(supabase.rpc('bi_erros_login', { p_dias: dias }))) ?? [],
  })
}

export function useErrosPorTela(dias: Periodo) {
  return useQuery({
    queryKey: ['entrada', 'erros-tela', dias],
    queryFn: async () =>
      (await rpc(supabase.rpc('bi_erros_por_tela', { p_dias: dias, p_limite: 12 }))) ?? [],
  })
}
