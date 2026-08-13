import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

/*
  Coordenadas do ombro, no sistema do viewBox.

  A largura é reescalada pelo CSS (`w-[--aba-abertura]` + `preserveAspectRatio`
  desligado), então estes números são proporção, não pixel. A altura 78 e o
  recuo 7 espelham `--barra-altura` e `--aba-recuo`: é o acoplamento declarado
  no token, e por isso os três valores vivem juntos lá.
*/
const ALTURA = 78
const RECUO = 7
const MEIO = 40 // controle da cúbica — metade da abertura, nos dois pontos

/*
  Tangente HORIZONTAL nas duas pontas. É o que faz a curva entrar sem quina:
  no pé ela encosta rente à borda inferior da barra, no topo emenda no miolo
  reto. Por isso os dois controles ficam no meio da abertura, e não deslocados.
*/
const OMBRO_ESQUERDO = `M0,${ALTURA} C${MEIO},${ALTURA} ${MEIO},${RECUO} 80,${RECUO} L80,${ALTURA} Z`
const OMBRO_DIREITO = `M80,${ALTURA} C${MEIO},${ALTURA} ${MEIO},${RECUO} 0,${RECUO} L0,${ALTURA} Z`

function Ombro({ d }: { d: string }) {
  return (
    <svg
      aria-hidden
      viewBox={`0 0 80 ${ALTURA}`}
      preserveAspectRatio="none"
      className="fill-background block h-full w-[var(--aba-abertura)] shrink-0"
    >
      <path d={d} />
    </svg>
  )
}

/**
 * A aba ativa da barra do módulo.
 *
 * É um **canal da cor da página que atravessa a barra branca de cima a baixo e
 * continua na tela**. O que ela comunica não é destaque, é CONTINUIDADE: aquela
 * é a superfície em que você está, e por isso não tem borda inferior nenhuma.
 *
 * Não é uma língua pendurada para fora da barra. A barra termina reta, e a
 * sensação de "descer e virar tela" vem da continuidade da cor mais o
 * alargamento em S das laterais. Uma versão anterior projetava a aba 24px
 * abaixo da barra e lia como balão de fala.
 *
 * Três peças — ombro · miolo · ombro — para acompanhar qualquer rótulo: entre
 * os ombros a largura é constante, então o miolo é um retângulo simples. Os
 * ombros são SVG porque a forma é uma cúbica de verdade; `radial-gradient` só
 * desenha quarto de círculo e reprovou duas vezes nesta peça.
 *
 * **O alargamento ocupa largura de verdade — sem margem negativa.** Tentar abrir
 * a aba por cima da vizinhança faz o ombro comer o rótulo da marca e a borda da
 * pílula seguinte. Na referência a folga é real, ~85px de cada lado; é o preço
 * da curva e entra no orçamento de largura da barra.
 *
 * Funciona nos dois temas sem regra própria: a aba usa a cor da página, então
 * no escuro ela é o degrau mais escuro e o cromo é que sobe.
 */
export function AbaCanal({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn('relative z-10 flex shrink-0 items-stretch self-stretch', className)}>
      <Ombro d={OMBRO_ESQUERDO} />
      {/* O cinza começa no degrau, não no topo da barra: a faixa branca de
          `--aba-recuo` acima da aba é o que a mantém DENTRO da barra em vez de
          cortá-la de ponta a ponta. */}
      <span className="aba-canal-miolo flex items-center gap-2.5 px-2.5">{children}</span>
      <Ombro d={OMBRO_DIREITO} />
    </span>
  )
}
