import type { ReactNode } from 'react'
import { useReducedMotion } from 'motion/react'
import * as motion from 'motion/react-client'

import { useAbaAtiva } from '@/components/layout/aba-do-modulo'

const EASE = [0.16, 1, 0.3, 1] as const // --via-ease-out

/**
 * Painéis das abas de um módulo — **sem a fileira de abas**.
 *
 * Um módulo de BI acumula muitos blocos, e empilhados num scroll único eles
 * competem: quem abre "Clientes" para agir sobre quem está saindo passa por
 * quatro gráficos de retenção antes de chegar na lista. As abas separam por
 * pergunta, não por tipo de visualização.
 *
 * KPIs, controles de recorte e avisos de limitação do dado ficam FORA daqui,
 * acima: são contexto do módulo inteiro. Trocar de aba não pode custar o número
 * de referência, e ressalva escondida atrás de aba é ressalva que ninguém lê.
 *
 * ⚠️ **A fileira de abas saiu daqui e foi para a barra do topo** (`AppBarra`),
 * onde a ativa é a `AbaCanal`. Aqui ficou só o painel. O estado é o mesmo
 * objeto — `useAbaAtiva` lê da URL — então não há duas fontes: a barra desenha
 * a seleção e este componente desenha o conteúdo dela. Reintroduzir uma
 * `TabsList` aqui daria duas fileiras de abas na mesma tela.
 */
export function ModuloTabs({
  rota,
  conteudos,
  className,
}: {
  /** rota do módulo; as abas vêm de `nav-items.ts`, fonte única */
  rota: string
  /** conteúdo por valor de aba */
  conteudos: Record<string, ReactNode>
  className?: string
}) {
  const { abas, ativa } = useAbaAtiva(rota)
  const reduzido = useReducedMotion()

  if (abas.length === 0) return null

  const painel = conteudos[ativa]

  return (
    <div
      role="tabpanel"
      aria-label={abas.find((aba) => aba.valor === ativa)?.titulo}
      className={className}
    >
      {reduzido ? (
        painel
      ) : (
        <motion.div
          // `key` na aba: sem ela o motion reaproveita o nó e a troca de painel
          // acontece sem transição nenhuma
          key={ativa}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, ease: EASE }}
        >
          {painel}
        </motion.div>
      )}
    </div>
  )
}
