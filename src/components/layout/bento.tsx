import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

/**
 * Mosaico de 12 colunas com espaçamento único.
 *
 * O gap é UM valor, em todos os eixos e em todas as telas. Antes cada página
 * misturava `space-y-6` entre seções com `gap-4` dentro dos grids, e o olho
 * lia duas escalas de respiro na mesma tela — o mosaico só funciona quando a
 * calha é constante.
 */
export function BentoGrid({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('grid grid-cols-1 gap-4 md:grid-cols-6 xl:grid-cols-12', className)}>
      {children}
    </div>
  )
}

/**
 * Largura em colunas do mosaico (12 no desktop).
 *
 * As classes são literais de propósito: o Tailwind varre o fonte em busca de
 * nomes completos, então `col-span-${n}` montado em runtime não gera CSS.
 * Cada degrau declara também a largura no tablet (6 colunas), porque metade de
 * 12 nem sempre é a proporção certa — um bloco de 4/12 vira 3/6, não 2/6.
 */
const larguras = {
  3: 'md:col-span-3 xl:col-span-3',
  4: 'md:col-span-3 xl:col-span-4',
  6: 'md:col-span-6 xl:col-span-6',
  8: 'md:col-span-6 xl:col-span-8',
  9: 'md:col-span-6 xl:col-span-9',
  12: 'md:col-span-6 xl:col-span-12',
} as const

/**
 * Altura em linhas — é o que cria o bloco alto de coluna inteira do mosaico.
 * Só vale a partir de xl: abaixo disso os blocos empilham e altura fixa
 * cortaria conteúdo.
 */
const alturas = {
  2: 'xl:row-span-2',
  3: 'xl:row-span-3',
} as const

export type BentoSpan = keyof typeof larguras
export type BentoRows = keyof typeof alturas

export function BentoItem({
  span = 12,
  rows,
  children,
  className,
}: {
  span?: BentoSpan
  rows?: BentoRows
  children: ReactNode
  className?: string
}) {
  // `min-w-0` evita o clássico do CSS grid: filho largo (tabela, rótulo de
  // eixo) empurrando a coluna além da fração e estourando a linha.
  //
  // `[&>*]:h-full` é o que faz os blocos de uma linha terminarem juntos. O item
  // do grid já esticava, mas o card dentro dele não — então dois cards lado a
  // lado com quantidades diferentes de conteúdo fechavam em alturas diferentes
  // e a linha do mosaico ficava desencaixada. Aqui em vez de em cada página
  // porque é regra do mosaico, não decisão de tela.
  return (
    <div
      className={cn('min-w-0 [&>*]:h-full', larguras[span], rows && alturas[rows], className)}
    >
      {children}
    </div>
  )
}
