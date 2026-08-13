import { useQuery } from '@tanstack/react-query'

import type { Periodo } from '@/lib/periodo'
import { LIMITE_LISTA, rpc } from '@/lib/rpc'
import { supabase } from '@/lib/supabase'

export function useJornadaKpis(dias: Periodo) {
  return useQuery({
    queryKey: ['jornada', 'kpis', dias],
    queryFn: async () => {
      const rows = await rpc(supabase.rpc('bi_jornada_kpis', { p_dias: dias }))
      return rows?.[0] ?? null
    },
  })
}

export function useRaioXTelas(dias: Periodo) {
  return useQuery({
    queryKey: ['jornada', 'raio-x', dias],
    queryFn: async () =>
      (await rpc(supabase.rpc('bi_raio_x_telas', { p_dias: dias, p_limite: LIMITE_LISTA }))) ?? [],
  })
}

export function useFluxoDaTela(tela: string, dias: Periodo) {
  return useQuery({
    queryKey: ['jornada', 'fluxo', tela, dias],
    enabled: Boolean(tela),
    queryFn: async () =>
      (await rpc(supabase.rpc('bi_fluxo_da_tela', { p_tela: tela, p_dias: dias }))) ?? [],
  })
}

export function usePortasEntrada(dias: Periodo) {
  return useQuery({
    queryKey: ['jornada', 'portas-entrada', dias],
    queryFn: async () =>
      (await rpc(supabase.rpc('bi_portas_entrada', { p_dias: dias, p_limite: 10 }))) ?? [],
  })
}

export function usePontosSaida(dias: Periodo) {
  return useQuery({
    queryKey: ['jornada', 'pontos-saida', dias],
    queryFn: async () =>
      (await rpc(supabase.rpc('bi_pontos_saida', { p_dias: dias, p_limite: 10 }))) ?? [],
  })
}

export function useProfundidadeSessao(dias: Periodo) {
  return useQuery({
    queryKey: ['jornada', 'profundidade', dias],
    queryFn: async () =>
      (await rpc(supabase.rpc('bi_profundidade_sessao', { p_dias: dias }))) ?? [],
  })
}

/**
 * As três perguntas que faltavam na tela.
 *
 * Nenhuma aceita período: `marts.fact_navegacao` cobre o que a purga da
 * plataforma ainda não apagou, e esse intervalo É a janela. Cada uma devolve
 * `janela_inicio`/`janela_fim` para o card declarar de quando fala.
 */
export function useSessoesInfladas() {
  return useQuery({
    queryKey: ['jornada', 'sessoes-infladas'],
    queryFn: async () => (await rpc(supabase.rpc('bi_jornada_sessoes_infladas'))) ?? [],
  })
}

export function usePortaDeEntrada() {
  return useQuery({
    queryKey: ['jornada', 'porta-de-entrada'],
    queryFn: async () => (await rpc(supabase.rpc('bi_jornada_porta_de_entrada'))) ?? [],
  })
}

export function useProfundidadeERetencao() {
  return useQuery({
    queryKey: ['jornada', 'profundidade-retencao'],
    queryFn: async () =>
      (await rpc(supabase.rpc('bi_jornada_profundidade_e_retencao'))) ?? [],
  })
}
