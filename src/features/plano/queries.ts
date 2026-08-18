import { useQuery } from '@tanstack/react-query'

import { rpc } from '@/lib/rpc'
import { supabase } from '@/lib/supabase'
import type { Achado } from '@/features/resumo/queries'

/** Um achado do plano, que é o achado da tela mais a tela de onde ele veio. */
export type AchadoDoPlano = Achado & { tela: string }

/**
 * O plano de ação transversal.
 *
 * **Sem seletor de período, de propósito.** O plano junta telas cujas janelas
 * não são as mesmas — Receita e Organizações não têm seletor, e cada achado já
 * declara a própria régua na frase. Um controle único aqui aplicaria período a
 * quem o ignora e faria a tela afirmar um escopo que ela não oferece; é a
 * mesma razão pela qual `AnaliseDaTela` deixa `periodo` opcional.
 */
export function usePlanoDeAcao() {
  return useQuery({
    queryKey: ['plano-de-acao'],
    queryFn: async () => {
      const rows = await rpc(supabase.rpc('bi_plano_de_acao'))
      return (rows ?? []) as unknown as AchadoDoPlano[]
    },
  })
}
