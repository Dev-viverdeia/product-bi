import { useQuery } from '@tanstack/react-query'

import type { Periodo } from '@/lib/periodo'
import { LIMITE_LISTA, rpc } from '@/lib/rpc'
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

/**
 * Tempo até a 1ª ação, separado por quem comprou e quem foi convidado.
 *
 * Substituiu `bi_tempo_primeiro_valor` no card: a distribuição sozinha contava
 * quanto e escondia o corte que importa. O convidado não demora mais que o
 * comprador — ele não aparece.
 */
export function usePrimeiraAcaoPorOrigem() {
  return useQuery({
    queryKey: ['entrada', 'primeira-acao-origem'],
    queryFn: async () =>
      (await rpc(supabase.rpc('bi_entrada_primeira_acao_por_origem'))) ?? [],
  })
}

export function useEfeitoOnboarding() {
  return useQuery({
    queryKey: ['entrada', 'efeito-onboarding'],
    queryFn: async () =>
      (await rpc(supabase.rpc('bi_entrada_efeito_onboarding'))) ?? [],
  })
}

export function useAceiteConvite() {
  return useQuery({
    queryKey: ['entrada', 'aceite-convite'],
    queryFn: async () =>
      (await rpc(supabase.rpc('bi_entrada_aceite_convite'))) ?? [],
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
      (await rpc(supabase.rpc('bi_masters_top_convidadores', { p_limite: LIMITE_LISTA }))) ?? [],
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
      (await rpc(supabase.rpc('bi_erros_por_tela', { p_dias: dias, p_limite: LIMITE_LISTA }))) ?? [],
  })
}
