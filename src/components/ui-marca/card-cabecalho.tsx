import type { ReactNode } from 'react'
import { InfoIcon } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { CardHeader, CardTitle } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

export type CardCabecalhoProps = {
  title: string
  /** definição da métrica — vira o conteúdo do botão de informação */
  description?: string
  /** ícone do assunto, em quadrado tintado à esquerda do título */
  icon?: LucideIcon
  /** número que responde o card antes do conteúdo — o olho pousa aqui primeiro */
  headline?: string
  /** unidade/recorte do headline, em texto pequeno ao lado dele */
  headlineLabel?: string
  /** slot à direita (filtro local, seletor…) — substitui o botão de informação */
  action?: ReactNode
}

/**
 * Cabeçalho único dos cards de conteúdo — gráfico e tabela usam este mesmo.
 *
 * **Identidade à esquerda, afordância à direita.** Assunto numa linha (ícone +
 * rótulo curto), headline responde, e a definição da métrica mora no botão de
 * informação: sai do caminho sem sair da tela.
 *
 * Existe como peça separada porque card de gráfico e card de tabela dividiam o
 * mesmo mosaico com cabeçalhos diferentes — título grande com parágrafo de um
 * lado, título curto com número do outro. Duas gramáticas na mesma tela leem
 * como dois produtos.
 */
export function CardCabecalho({
  title,
  description,
  icon: Icon,
  headline,
  headlineLabel,
  action,
}: CardCabecalhoProps) {
  return (
    /* flex-wrap: com action estreita (o botão de informação, 32px) nada muda;
       com action larga — grupo de botões, seletor de tela — ela desce para a
       linha de baixo no mobile em vez de espremer o título até as reticências. */
    <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 space-y-1.5">
        <div className="flex items-center gap-2">
          {Icon ? (
            <span className="bg-foreground/6 text-muted-foreground flex size-7 shrink-0 items-center justify-center rounded-md">
              <Icon className="size-4" />
            </span>
          ) : null}
          {/* line-clamp-2 e não truncate: no desktop nada muda (só age quando
              não cabe), e no estreito o título completa em duas linhas em vez de
              virar reticências. Título cortado é título que mente. */}
          <CardTitle className="line-clamp-2 text-sm font-medium">{title}</CardTitle>
        </div>

        {headline ? (
          <p className="flex items-baseline gap-1.5 pt-0.5">
            <span className="num text-3xl leading-none font-semibold tracking-tight">
              {headline}
            </span>
            {headlineLabel ? (
              <span className="text-muted-foreground text-xs">{headlineLabel}</span>
            ) : null}
          </p>
        ) : null}
      </div>

      {/* `max-w-full` junto do `shrink-0`: sozinho, o shrink-0 proíbe encolher
          MAS não impede exceder a linha, então uma action larga (grupo de
          botões, seletor de tela) estourava a página no mobile mesmo com o
          flex-wrap do pai — ele quebrava a linha e a linha nova continuava larga
          demais. Medido em 375px: 397px de action dentro de 325px de card. */}
      <div className="max-w-full shrink-0">
        {action ??
          (description ? (
            <Tooltip>
              <TooltipTrigger
                aria-label={`Como este número é calculado: ${title}`}
                className="border-foreground/8 text-muted-foreground hover:bg-foreground/6 hover:text-foreground focus-visible:ring-ring flex size-8 items-center justify-center rounded-full border transition-colors focus-visible:ring-2 focus-visible:outline-none"
              >
                <InfoIcon className="size-4" />
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-72 text-xs leading-relaxed">
                {description}
              </TooltipContent>
            </Tooltip>
          ) : null)}
      </div>
    </CardHeader>
  )
}
