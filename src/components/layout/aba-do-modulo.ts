import { useCallback } from 'react'
import { useSearchParams } from 'react-router'

import { abasDaRota } from '@/components/layout/nav-items'
import type { AbaDoModulo } from '@/components/layout/nav-items'

/** nome do parâmetro na URL — usado pela barra do topo e pelos painéis */
export const PARAM_ABA = 'aba'

/**
 * Estado da aba do módulo, lido da URL.
 *
 * Vive na URL (`?aba=`) e não em estado local. Sem isso a aba não é
 * endereçável: não dá para mandar "olha a aba de risco" para alguém, nem para
 * um achado do motor apontar para o gráfico que o sustenta. A troca usa
 * `replace` porque aba é recorte de visão, não navegação — empilhar no
 * histórico faria o botão voltar desfazer cliques de aba em vez de sair do
 * módulo.
 *
 * O hook existe separado do componente porque **duas peças precisam do mesmo
 * estado**: a barra do topo desenha as abas e a página desenha o painel. Com a
 * lógica dentro de um dos dois, o outro teria que reimplementá-la — e no dia em
 * que divergissem, a barra marcaria uma aba e a página mostraria outra.
 */
export function useAbaAtiva(rota: string): {
  abas: AbaDoModulo[]
  ativa: string
  trocar: (valor: string) => void
} {
  const abas = abasDaRota(rota)
  const [params, setParams] = useSearchParams()

  const daUrl = params.get(PARAM_ABA)
  // valor fora da lista cai na primeira aba: a URL é editável por qualquer um
  const ativa = abas.some((aba) => aba.valor === daUrl) ? daUrl! : (abas[0]?.valor ?? '')

  const trocar = useCallback(
    (valor: string) => {
      // preserva os outros parâmetros — período e recorte vivem na mesma URL
      const proximos = new URLSearchParams(params)
      proximos.set(PARAM_ABA, valor)
      setParams(proximos, { replace: true })
    },
    [params, setParams],
  )

  return { abas, ativa, trocar }
}
