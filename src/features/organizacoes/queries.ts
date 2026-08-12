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

/**
 * O comparativo e os dois diagnósticos que faltavam.
 *
 * `useOrgsPorTamanho` devolve a taxa agregada (pessoas ativas ÷ pessoas) E a
 * média das organizações. As duas vão para a tela de propósito: média de
 * organização mistura conta de uma pessoa com conta de cem, e conta de uma
 * pessoa só assume 0% ou 100%. Quando as duas concordam, o gradiente não é
 * artefato de agregação — e aqui elas concordam.
 */
export function useOrgsPorTamanho() {
  return useQuery({
    queryKey: ['organizacoes', 'por-tamanho'],
    queryFn: async () => (await rpc(supabase.rpc('bi_orgs_por_tamanho'))) ?? [],
  })
}

export function useOrgsDistribuicao() {
  return useQuery({
    queryKey: ['organizacoes', 'distribuicao-engajamento'],
    queryFn: async () =>
      (await rpc(supabase.rpc('bi_orgs_distribuicao_engajamento'))) ?? [],
  })
}

export function useOrgsQuemParouPrimeiro() {
  return useQuery({
    queryKey: ['organizacoes', 'quem-parou-primeiro'],
    queryFn: async () => (await rpc(supabase.rpc('bi_orgs_quem_parou_primeiro'))) ?? [],
  })
}
