import type { ReactNode } from 'react'
import { AlertCircleIcon, ChartColumnIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

type ChartCardProps = {
  title: string
  description?: string
  /** slot à direita do header (filtro local, menu de exportação…) */
  action?: ReactNode
  isLoading?: boolean
  isError?: boolean
  onRetry?: () => void
  isEmpty?: boolean
  emptyMessage?: string
  /** refetch mantém o frame: gráfico anterior fica visível com opacidade reduzida */
  isRefreshing?: boolean
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
  action,
  isLoading = false,
  isError = false,
  onRetry,
  isEmpty = false,
  emptyMessage = 'Sem dados para o período selecionado.',
  isRefreshing = false,
  className,
  contentClassName,
  children,
}: ChartCardProps) {
  return (
    <Card className={cn('glass-card gap-4', className)}>
      {/* Empilha no mobile: ação ao lado do título espreme a descrição em 375px */}
      <CardHeader className="flex flex-col items-start gap-3 sm:flex-row sm:justify-between">
        <div className="space-y-1">
          <CardTitle className="text-base">{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </CardHeader>

      <CardContent className={cn('min-h-[220px]', contentClassName)}>
        {isLoading ? (
          <div className="flex h-full min-h-[220px] flex-col gap-3">
            <Skeleton className="h-full min-h-[180px] w-full rounded-md" />
            <Skeleton className="mx-auto h-3 w-40 rounded-md" />
          </div>
        ) : isError ? (
          <div className="flex h-full min-h-[220px] flex-col items-center justify-center gap-3 text-center">
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
          <div className="flex h-full min-h-[220px] flex-col items-center justify-center gap-3 text-center">
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
