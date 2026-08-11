import { useQuery } from '@tanstack/react-query'

import type { Periodo } from '@/components/filters/periodo-filtro'
import { rpc } from '@/lib/rpc'
import { argsSegmento, type Recorte } from '@/lib/segmento'
import { supabase } from '@/lib/supabase'

export type { Periodo }

export function useKpis(dias: Periodo, recorte: Recorte) {
  return useQuery({
    queryKey: ['bi', 'kpis', dias, recorte.papel, recorte.plano],
    queryFn: async () => {
      const rows = await rpc(
        supabase.rpc('bi_visao_geral_kpis', { p_dias: dias, ...argsSegmento(recorte) }),
      )
      return rows?.[0] ?? null
    },
  })
}

export function useAtividadeDiaria(dias: Periodo, recorte: Recorte) {
  return useQuery({
    queryKey: ['bi', 'atividade-diaria', dias, recorte.papel, recorte.plano],
    queryFn: async () =>
      (await rpc(
        supabase.rpc('bi_atividade_diaria', { p_dias: dias, ...argsSegmento(recorte) }),
      )) ?? [],
  })
}

export function useHeatmapNavegacao(dias: Periodo, recorte: Recorte) {
  return useQuery({
    queryKey: ['bi', 'heatmap-navegacao', dias, recorte.papel, recorte.plano],
    queryFn: async () =>
      (await rpc(
        supabase.rpc('bi_heatmap_navegacao', { p_dias: dias, ...argsSegmento(recorte) }),
      )) ?? [],
  })
}

export function useEventosPorTipo(dias: Periodo, recorte: Recorte) {
  return useQuery({
    queryKey: ['bi', 'eventos-por-tipo', dias, recorte.papel, recorte.plano],
    queryFn: async () =>
      (await rpc(
        supabase.rpc('bi_eventos_por_tipo', { p_dias: dias, ...argsSegmento(recorte) }),
      )) ?? [],
  })
}

export function useTopTelas(dias: Periodo, recorte: Recorte) {
  return useQuery({
    queryKey: ['bi', 'top-telas', dias, recorte.papel, recorte.plano],
    queryFn: async () =>
      (await rpc(
        supabase.rpc('bi_top_telas', { p_dias: dias, p_limite: 10, ...argsSegmento(recorte) }),
      )) ?? [],
  })
}

/** Ativos decompostos em novos, reativados e retidos — de onde veio o número. */
export function useComposicaoCrescimento(dias: Periodo, recorte: Recorte) {
  return useQuery({
    queryKey: ['bi', 'composicao-crescimento', dias, recorte.papel, recorte.plano],
    queryFn: async () =>
      (await rpc(
        supabase.rpc('bi_composicao_crescimento', { p_dias: dias, ...argsSegmento(recorte) }),
      )) ?? [],
  })
}

/** Ações por módulo, com consumo e compromisso separados. */
export function useAcoesPorModulo(dias: Periodo, recorte: Recorte) {
  return useQuery({
    queryKey: ['bi', 'acoes-por-modulo', dias, recorte.papel, recorte.plano],
    queryFn: async () =>
      (await rpc(
        supabase.rpc('bi_acoes_por_modulo', { p_dias: dias, ...argsSegmento(recorte) }),
      )) ?? [],
  })
}

/**
 * Última data com registro por tipo de evento.
 *
 * Não recebe recorte: rastreio é instrumentação da plataforma, não
 * comportamento de um segmento de cliente.
 */
export function useSaudeRastreio() {
  return useQuery({
    queryKey: ['bi', 'saude-rastreio'],
    queryFn: async () => (await rpc(supabase.rpc('bi_saude_rastreio'))) ?? [],
  })
}

export function useUltimaSincronizacao() {
  return useQuery({
    queryKey: ['bi', 'ultima-sincronizacao'],
    // o pipeline roda a cada 30 min — manter o carimbo fresco
    refetchInterval: 5 * 60 * 1000,
    queryFn: async () => await rpc(supabase.rpc('bi_ultima_sincronizacao')),
  })
}
