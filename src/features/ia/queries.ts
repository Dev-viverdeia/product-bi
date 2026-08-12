import { useQuery } from '@tanstack/react-query'

import type { Periodo } from '@/components/filters/periodo-filtro'
import { LIMITE_LISTA, rpc } from '@/lib/rpc'
import { supabase } from '@/lib/supabase'

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

/**
 * O comparativo, o diagnóstico e a lista de ação que faltavam na tela.
 *
 * `useModoDeEntrada` lê a PRIMEIRA conversa de cada pessoa, não todas: usar
 * todas mediria a preferência de quem já ficou, que é outra pergunta.
 */
export function useModoDeEntrada() {
  return useQuery({
    queryKey: ['ia', 'modo-de-entrada'],
    queryFn: async () => (await rpc(supabase.rpc('bi_ia_modo_de_entrada'))) ?? [],
  })
}

export function useProfundidadeConversa() {
  return useQuery({
    queryKey: ['ia', 'profundidade-conversa'],
    queryFn: async () => (await rpc(supabase.rpc('bi_ia_profundidade_conversa'))) ?? [],
  })
}

export function useExperimentaramESumiram() {
  return useQuery({
    queryKey: ['ia', 'experimentaram-e-sumiram'],
    queryFn: async () =>
      (await rpc(supabase.rpc('bi_ia_experimentaram_e_sumiram', { p_limite: LIMITE_LISTA }))) ??
      [],
  })
}
