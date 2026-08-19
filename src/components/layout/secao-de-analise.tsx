import type { ReactNode } from 'react'

import { BentoGrid } from '@/components/layout/bento'
import { cn } from '@/lib/utils'

/**
 * Contêiner de uma pergunta — o degrau de hierarquia que faltava.
 *
 * Uma tela de BI não é uma pilha de cards: é um punhado de perguntas, cada uma
 * respondida por dois ou três blocos. Sem este contêiner o leitor recebe doze
 * cards em sequência e precisa descobrir sozinho quais conversam entre si; a
 * seção diz "estes três respondem a mesma coisa" antes de qualquer título ser
 * lido.
 *
 * A superfície é `--secao`, um degrau ABAIXO da página. É contra-intuitivo —
 * o instinto é elevar o que agrupa — mas elevar a seção a colocaria no mesmo
 * plano dos cards brancos que ela contém, e aí ela deixaria de ser fundo e
 * viraria mais um objeto. Recuando, ela vira o chão em que os cards pousam.
 *
 * O cabeçalho carrega o controle DA SEÇÃO (um recorte que só vale ali dentro),
 * e não o da tela — recorte de tela inteira vive no `CabecalhoDeModulo`. Mistura
 * os dois e o leitor perde a régua de qual filtro alcança o quê.
 */
export function SecaoDeAnalise({
  titulo,
  descricao,
  icone: Icone,
  controles,
  id,
  children,
  className,
}: {
  titulo: string
  /** régua da seção: o que conta, a janela, a armadilha de leitura */
  descricao?: string
  icone?: React.ComponentType<{ className?: string; strokeWidth?: number }>
  /** controle que vale só dentro desta seção */
  controles?: ReactNode
  /** alvo de âncora — um achado do motor pode apontar para a seção inteira */
  id?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section id={id} className={cn('bg-secao rounded-xl p-4 md:p-5', className)}>
      <header className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {Icone ? <Icone className="text-muted-foreground size-[18px]" strokeWidth={1.75} /> : null}
          {/* line-clamp-2 e não truncate, igual ao `CardCabecalho`: a decisão já
            estava escrita no irmão — "título cortado é título que mente" — e
            invertida aqui. Medido a 375px, 33 dos 43 títulos de seção do produto
            terminavam em reticências. */}
        <h2 className="line-clamp-2 text-lg font-semibold tracking-tight">{titulo}</h2>
        </div>
        {controles ? <div className="ml-auto flex items-center gap-2">{controles}</div> : null}
        {descricao ? (
          // largura total: a régua é frase, não legenda — quebrar ao lado do
          // controle a espremeria numa coluna de 20 caracteres
          <p className="text-muted-foreground w-full max-w-[80ch] text-sm leading-snug">
            {descricao}
          </p>
        ) : null}
      </header>

      <BentoGrid>{children}</BentoGrid>
    </section>
  )
}
