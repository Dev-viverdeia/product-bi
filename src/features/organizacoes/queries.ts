import { useQuery } from '@tanstack/react-query'

import { rpc } from '@/lib/rpc'
import { supabase } from '@/lib/supabase'

export function useOrgsKpis() {
  return useQuery({
    queryKey: ['orgs', 'kpis'],
    queryFn: async () => {
      const rows = await rpc(supabase.rpc('bi_orgs_kpis'))
      return rows?.[0] ?? null
    },
  })
}

export function useOrgsRisco() {
  return useQuery({
    queryKey: ['orgs', 'risco'],
    queryFn: async () => (await rpc(supabase.rpc('bi_orgs_risco', { p_limite: 25 }))) ?? [],
  })
}

export function useEfeitoMaster() {
  return useQuery({
    queryKey: ['orgs', 'efeito-master'],
    queryFn: async () => (await rpc(supabase.rpc('bi_orgs_efeito_master'))) ?? [],
  })
}

export function useOrgsOcupacao() {
  return useQuery({
    queryKey: ['orgs', 'ocupacao'],
    queryFn: async () => (await rpc(supabase.rpc('bi_orgs_ocupacao'))) ?? [],
  })
}

export function useValorNaoConsumido() {
  return useQuery({
    queryKey: ['orgs', 'valor-nao-consumido'],
    queryFn: async () => (await rpc(supabase.rpc('bi_valor_nao_consumido'))) ?? [],
  })
}
