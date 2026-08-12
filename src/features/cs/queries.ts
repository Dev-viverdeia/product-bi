import { useQuery } from '@tanstack/react-query'

import type { Periodo } from '@/components/filters/periodo-filtro'
import { rpc } from '@/lib/rpc'
import { supabase } from '@/lib/supabase'

export type { Periodo }

/**
 * Origem destes dados é o Pulse (plataforma de CS), espelhado em `marts`.
 * Enquanto a carga não for automática, `useFrescorCs` é o que permite a tela
 * declarar de quando é o dado em vez de fingir que é de agora.
 */
export function useFrescorCs() {
  return useQuery({
    queryKey: ['cs', 'frescor'],
    queryFn: async () => (await rpc(supabase.rpc('bi_cs_frescor'))) ?? [],
  })
}

export function useCsKpis(dias: Periodo) {
  return useQuery({
    queryKey: ['cs', 'kpis', dias],
    queryFn: async () => {
      const rows = await rpc(supabase.rpc('bi_cs_kpis', { p_dias: dias }))
      return rows?.[0] ?? null
    },
  })
}

export function useAtendimentoMensal() {
  return useQuery({
    queryKey: ['cs', 'atendimento-mensal'],
    queryFn: async () => (await rpc(supabase.rpc('bi_cs_atendimento_mensal'))) ?? [],
  })
}

export function useAtendimentoIaHumano(dias: Periodo) {
  return useQuery({
    queryKey: ['cs', 'ia-humano', dias],
    queryFn: async () =>
      (await rpc(supabase.rpc('bi_cs_atendimento_ia_humano', { p_dias: dias }))) ?? [],
  })
}

export function useAtendimentoPorAtendente(dias: Periodo) {
  return useQuery({
    queryKey: ['cs', 'por-atendente', dias],
    queryFn: async () =>
      (await rpc(supabase.rpc('bi_cs_atendimento_por_atendente', { p_dias: dias }))) ?? [],
  })
}

export function useAtendimentoPorCanal(dias: Periodo) {
  return useQuery({
    queryKey: ['cs', 'por-canal', dias],
    queryFn: async () =>
      (await rpc(supabase.rpc('bi_cs_atendimento_por_canal', { p_dias: dias }))) ?? [],
  })
}

// A cobertura da atribuição atendimento ↔ empresa saiu: o contrato `bi_pulse`
// não entrega empresa no ticket, e a RPC que existia lia um espelho que não
// existe mais. O time do Pulse vai expor `organization_id` na view (match por
// telefone, ~81%, só o unívoco) — quando chegar, o hook volta lendo o contrato
// em vez de uma derivação nossa.

export function useDisparosMensal() {
  return useQuery({
    queryKey: ['cs', 'disparos-mensal'],
    queryFn: async () => (await rpc(supabase.rpc('bi_cs_disparos_mensal'))) ?? [],
  })
}

export function useDisparosPorCanal(dias: Periodo) {
  return useQuery({
    queryKey: ['cs', 'disparos-canal', dias],
    queryFn: async () =>
      (await rpc(supabase.rpc('bi_cs_disparos_por_canal', { p_dias: dias }))) ?? [],
  })
}

export function useCancelamentoMensal() {
  return useQuery({
    queryKey: ['cs', 'cancelamento-mensal'],
    queryFn: async () => (await rpc(supabase.rpc('bi_cs_cancelamento_mensal'))) ?? [],
  })
}

export function useCancelamentoOrigem() {
  return useQuery({
    queryKey: ['cs', 'cancelamento-origem'],
    queryFn: async () => (await rpc(supabase.rpc('bi_cs_cancelamento_origem'))) ?? [],
  })
}

export function useCancelamentoDesfecho() {
  return useQuery({
    queryKey: ['cs', 'cancelamento-desfecho'],
    queryFn: async () => (await rpc(supabase.rpc('bi_cs_cancelamento_desfecho'))) ?? [],
  })
}

export function useRetencaoCs() {
  return useQuery({
    queryKey: ['cs', 'retencao'],
    queryFn: async () => (await rpc(supabase.rpc('bi_cs_retencao'))) ?? [],
  })
}

export function useFunilCs(quadro: string) {
  return useQuery({
    queryKey: ['cs', 'funil', quadro],
    queryFn: async () => (await rpc(supabase.rpc('bi_cs_funil', { p_quadro: quadro }))) ?? [],
  })
}
