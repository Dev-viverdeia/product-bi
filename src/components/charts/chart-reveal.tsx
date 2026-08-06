import type { ReactNode } from 'react'
import { useReducedMotion } from 'motion/react'
import * as motion from 'motion/react-client'

type ChartRevealProps = {
  /** left: séries temporais/barras horizontais · up: colunas · scale: donut */
  direction?: 'left' | 'up' | 'scale'
  children: ReactNode
  className?: string
  'aria-hidden'?: boolean
}

const EASE = [0.16, 1, 0.3, 1] as const // --via-ease-out

/**
 * Entrada de gráfico dirigida pelo motion (time-based) em vez do controlador
 * de animação do Recharts (frame-based): sobrevive a rAF-throttling de aba
 * oculta — o Recharts congela no frame em que parou; o motion ressincroniza
 * pelo relógio e completa. Também convive com strokeDasharray customizado,
 * que o draw-in nativo do Recharts corrompe.
 */
export function ChartReveal({
  direction = 'left',
  children,
  className,
  'aria-hidden': ariaHidden,
}: ChartRevealProps) {
  const reducedMotion = useReducedMotion()

  if (reducedMotion) {
    return (
      <div className={className} aria-hidden={ariaHidden}>
        {children}
      </div>
    )
  }

  if (direction === 'scale') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.7, ease: EASE }}
        className={className}
        aria-hidden={ariaHidden}
      >
        {children}
      </motion.div>
    )
  }

  const hidden =
    direction === 'left' ? 'inset(0 100% 0 0)' : 'inset(100% 0 0 0)'

  return (
    <motion.div
      initial={{ clipPath: hidden, opacity: 0 }}
      animate={{ clipPath: 'inset(0 0 0 0)', opacity: 1 }}
      transition={{
        clipPath: { duration: 0.8, ease: EASE },
        opacity: { duration: 0.3, ease: 'easeOut' },
      }}
      className={className}
      aria-hidden={ariaHidden}
    >
      {children}
    </motion.div>
  )
}
