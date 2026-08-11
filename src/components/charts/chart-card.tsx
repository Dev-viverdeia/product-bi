import type { ReactNode } from 'react'
import { AlertCircleIcon, ChartColumnIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { CardCabecalho, type CardCabecalhoProps } from '@/components/ui-marca/card-cabecalho'
import { cn } from '@/lib/utils'

type ChartCardProps = CardCabecalhoProps & {
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
 * Moldura padrão de gráfico: cabeçalho da marca + estados
 * (loading/erro/vazio/refetch). Todo gráfico do produto vive dentro de um
 * ChartCard — nunca solto na página.
 */
export function ChartCard({
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
  ...cabecalho
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
      <CardCabecalho {...cabecalho} />

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
