import type { ReactNode } from 'react'
import { AlertCircleIcon, ChartColumnIcon, InfoIcon } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

type ChartCardProps = {
  title: string
  description?: string
  /** ícone do assunto, em quadrado tintado à esquerda do título */
  icon?: LucideIcon
  /** número que responde o card antes do gráfico — o olho pousa aqui primeiro */
  headline?: string
  /** unidade/recorte do headline, em texto pequeno ao lado dele */
  headlineLabel?: string
  /** slot à direita do header (filtro local, menu de exportação…) */
  action?: ReactNode
  isLoading?: boolean
  isError?: boolean
  onRetry?: () => void
  isEmpty?: boolean
  emptyMessage?: string
  /** refetch mantém o frame: gráfico anterior fica visível com opacidade reduzida */
  isRefreshing?: boolean
  /** 'brand' preenche em navy — bloco de destaque do mosaico, um por tela */
  tone?: 'glass' | 'brand'
  className?: string
  contentClassName?: string
  children: ReactNode
}

/**
 * Moldura padrão de gráfico: título + estados (loading/erro/vazio/refetch).
 * Todo gráfico do produto vive dentro de um ChartCard — nunca solto na página.
 */
export function ChartCard({
  title,
  description,
  icon: Icon,
  headline,
  headlineLabel,
  action,
  isLoading = false,
  isError = false,
  onRetry,
  isEmpty = false,
  emptyMessage = 'Sem dados para o período selecionado.',
  isRefreshing = false,
  tone = 'glass',
  className,
  contentClassName,
  children,
}: ChartCardProps) {
  return (
    <Card
      className={cn(
        tone === 'brand' ? 'brand-card' : 'glass-card',
        // único desvio da primitiva: no card de gráfico o cabeçalho encosta no
        // desenho — o headline e a curva são a mesma leitura.
        'gap-3',
        className,
      )}
    >
      {/*
        Gramática do cabeçalho: identidade à esquerda, afordância à direita.

        A versão anterior abria com título em text-base mais uma frase inteira de
        descrição — o topo do card era um parágrafo e o dado só aparecia depois.
        Agora o assunto cabe numa linha (ícone + rótulo) e o headline responde.

        A definição da métrica NÃO foi deletada: ela é parte do dado neste
        projeto, e virou o conteúdo do botão de informação. Cabeçalho limpo, e a
        régua continua a um clique de quem precisa conferir de onde vem o número.
      */}
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <div className="flex items-center gap-2">
            {Icon ? (
              <span className="bg-foreground/6 text-muted-foreground flex size-7 shrink-0 items-center justify-center rounded-md">
                <Icon className="size-4" />
              </span>
            ) : null}
            <CardTitle className="truncate text-sm font-medium">{title}</CardTitle>
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

        <div className="shrink-0">
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

      {/* min-w-0: em flex/grid o filho tem min-width auto, e o ResponsiveContainer
          do Recharts mede o pai antes de encolher — sem isto ele renderiza alguns
          px além da caixa e o gráfico era cortado no mobile pelo overflow-hidden. */}
      <CardContent className={cn('min-h-[200px] min-w-0', contentClassName)}>
        {isLoading ? (
          <div className="flex h-full min-h-[200px] flex-col gap-3">
            <Skeleton className="h-full min-h-[180px] w-full rounded-md" />
            <Skeleton className="mx-auto h-3 w-40 rounded-md" />
          </div>
        ) : isError ? (
          <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-3 text-center">
            <AlertCircleIcon className="text-muted-foreground size-6" />
            <p className="text-muted-foreground text-sm">
              Não foi possível carregar os dados.
            </p>
            {onRetry ? (
              <Button variant="outline" size="sm" onClick={onRetry}>
                Tentar de novo
              </Button>
            ) : null}
          </div>
        ) : isEmpty ? (
          <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-3 text-center">
            <ChartColumnIcon className="text-muted-foreground size-6" />
            <p className="text-muted-foreground text-sm">{emptyMessage}</p>
          </div>
        ) : (
          <div
            className={cn(
              'h-full transition-opacity duration-300',
              isRefreshing && 'pointer-events-none opacity-60',
            )}
          >
            {children}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
