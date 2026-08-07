import { useQuery } from '@tanstack/react-query'

import type { Periodo } from '@/components/filters/periodo-filtro'
import { supabase } from '@/lib/supabase'

async function rpc<T>(promise: PromiseLike<{ data: T | null; error: { message: string } | null }>) {
  const { data, error } = await promise
  if (error) throw new Error(error.message)
  return data
}

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
      (await rpc(supabase.rpc('bi_raio_x_telas', { p_dias: dias, p_limite: 20 }))) ?? [],
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
