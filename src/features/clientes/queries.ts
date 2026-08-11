import { useQuery } from '@tanstack/react-query'

import type { Periodo } from '@/components/filters/periodo-filtro'
import { LIMITE_LISTA, rpc } from '@/lib/rpc'
import { argsSegmento, type Plano, type Recorte } from '@/lib/segmento'
import { supabase } from '@/lib/supabase'

export function useEngajamento(dias: Periodo, recorte: Recorte) {
  return useQuery({
    queryKey: ['clientes', 'engajamento', dias, recorte.papel, recorte.plano],
    queryFn: async () => {
      const rows = await rpc(
        supabase.rpc('bi_engajamento_clientes', { p_dias: dias, ...argsSegmento(recorte) }),
      )
      return rows?.[0] ?? null
    },
  })
}

export function useRetencaoCohort(recorte: Recorte) {
  return useQuery({
    queryKey: ['clientes', 'retencao-cohort', recorte.papel, recorte.plano],
    queryFn: async () =>
      (await rpc(supabase.rpc('bi_retencao_cohort', argsSegmento(recorte)))) ?? [],
  })
}

/**
 * A comparação de retenção entre papéis. Recebe só o plano de propósito:
 * o card mostra os 3 papéis lado a lado, então filtrar por papel aqui não
 * recortaria — apagaria a comparação.
 */
export function useRetencaoPorPapel(plano: Plano | null) {
  return useQuery({
    queryKey: ['clientes', 'retencao-por-papel', plano],
    queryFn: async () =>
      (await rpc(supabase.rpc('bi_retencao_por_papel', { p_plano: plano ?? undefined }))) ?? [],
  })
}

export function useDiasAtivosDistribuicao(dias: Periodo, recorte: Recorte) {
  return useQuery({
    queryKey: ['clientes', 'dias-ativos', dias, recorte.papel, recorte.plano],
    queryFn: async () =>
      (await rpc(
        supabase.rpc('bi_dias_ativos_distribuicao', { p_dias: dias, ...argsSegmento(recorte) }),
      )) ?? [],
  })
}

export function useAmplitudeModulos(dias: Periodo, recorte: Recorte) {
  return useQuery({
    queryKey: ['clientes', 'amplitude', dias, recorte.papel, recorte.plano],
    queryFn: async () =>
      (await rpc(
        supabase.rpc('bi_amplitude_modulos', { p_dias: dias, ...argsSegmento(recorte) }),
      )) ?? [],
  })
}

export function useRetencaoPorAmplitude(recorte: Recorte) {
  return useQuery({
    queryKey: ['clientes', 'retencao-amplitude', recorte.papel, recorte.plano],
    queryFn: async () =>
      (await rpc(supabase.rpc('bi_retencao_por_amplitude', argsSegmento(recorte)))) ?? [],
  })
}

export function usePowerUsers(dias: Periodo, recorte: Recorte) {
  return useQuery({
    queryKey: ['clientes', 'power-users', dias, recorte.papel, recorte.plano],
    queryFn: async () =>
      (await rpc(
        supabase.rpc('bi_power_users', {
          p_dias: dias,
          p_limite: LIMITE_LISTA,
          ...argsSegmento(recorte),
        }),
      )) ?? [],
  })
}

export function useClientesEmRisco(recorte: Recorte) {
  return useQuery({
    queryKey: ['clientes', 'em-risco', recorte.papel, recorte.plano],
    queryFn: async () =>
      (await rpc(
        supabase.rpc('bi_clientes_em_risco', {
          p_limite: LIMITE_LISTA,
          ...argsSegmento(recorte),
        }),
      )) ?? [],
  })
}

export function useAhaMoment(recorte: Recorte) {
  return useQuery({
    queryKey: ['clientes', 'aha-moment', recorte.papel, recorte.plano],
    queryFn: async () =>
      (await rpc(supabase.rpc('bi_aha_moment', argsSegmento(recorte)))) ?? [],
  })
}

export function useChurnResumo(recorte: Recorte) {
  return useQuery({
    queryKey: ['clientes', 'churn-resumo', recorte.papel, recorte.plano],
    queryFn: async () => {
      const rows = await rpc(supabase.rpc('bi_churn_resumo', argsSegmento(recorte)))
      return rows?.[0] ?? null
    },
  })
}

export function useChurnModulos(recorte: Recorte) {
  return useQuery({
    queryKey: ['clientes', 'churn-modulos', recorte.papel, recorte.plano],
    queryFn: async () =>
      (await rpc(supabase.rpc('bi_churn_modulos', argsSegmento(recorte)))) ?? [],
  })
}

export function useChurnUltimoModulo(recorte: Recorte) {
  return useQuery({
    queryKey: ['clientes', 'churn-ultimo-modulo', recorte.papel, recorte.plano],
    queryFn: async () =>
      (await rpc(supabase.rpc('bi_churn_ultimo_modulo', argsSegmento(recorte)))) ?? [],
  })
}
