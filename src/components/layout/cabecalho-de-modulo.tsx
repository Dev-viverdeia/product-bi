import type { ReactNode } from 'react'
import { useLocation } from 'react-router'

import { moduloDaRota } from '@/components/layout/nav-items'
import { FrescorDoDado } from '@/components/ui-marca/frescor-do-dado'
import { cn } from '@/lib/utils'

/**
 * Título do módulo, sua régua e os controles que escopam a tela inteira.
 *
 * Três decisões que não são de gosto:
 *
 * 1. **Título e régua vêm de `nav-items.ts`**, não da página. Antes cada tela
 *    escrevia a própria régua, e duas telas com a mesma métrica podiam descrever
 *    a janela com palavras diferentes sem ninguém notar. A régua é o contrato de
 *    leitura — o que conta, a janela, a exclusão — e fica sempre visível.
 * 2. **Os controles ficam no PÉ do bloco** (`mt-auto`), não colados no subtítulo.
 *    Alinhados ao rodapé da linha eles a fecham; encostados no texto deixam um
 *    buraco embaixo sempre que houver um painel alto à direita.
 * 3. **O frescor anda com os controles.** Período e recorte dizem QUE fatia se
 *    está olhando; o frescor diz até quando ela vai. Separá-los deixa metade da
 *    régua fora do campo de visão de quem mexe no filtro.
 *
 * `aside` é opcional e ocupa a coluna da direita — é onde o bloco de destaque da
 * tela entra quando existe.
 */
export function CabecalhoDeModulo({
  controles,
  aside,
  className,
}: {
  /** período, recorte e o que mais escopar a tela inteira */
  controles?: ReactNode
  /** bloco de destaque à direita, quando a tela tiver um */
  aside?: ReactNode
  className?: string
}) {
  const { pathname } = useLocation()
  const modulo = moduloDaRota(pathname)

  return (
    <div
      className={cn(
        'mb-5 grid items-stretch gap-5',
        aside ? 'lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)]' : null,
        className,
      )}
    >
      <div className="flex min-w-0 flex-col">
        <h1 className="text-3xl font-semibold tracking-tight md:text-[2.5rem] md:leading-[1.06]">
          {modulo?.title ?? 'Product BI'}
        </h1>
        {modulo?.regua ? (
          <p className="text-muted-foreground mt-3 max-w-[52ch] text-[15px] leading-relaxed">
            {modulo.regua}
          </p>
        ) : null}

        <div className="mt-auto flex flex-wrap items-center gap-3 pt-7">
          {controles}
          <FrescorDoDado />
        </div>
      </div>

      {aside}
    </div>
  )
}
