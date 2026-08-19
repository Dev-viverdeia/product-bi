import type { ReactNode } from 'react'
import { AlertCircleIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { CardCabecalho, type CardCabecalhoProps } from '@/components/ui-marca/card-cabecalho'
import type { NivelDeAnalise } from '@/lib/escada'
import { cn } from '@/lib/utils'

type TabelaCardProps = CardCabecalhoProps & {
  isLoading?: boolean
  isError?: boolean
  onRetry?: () => void
  /**
   * Refetch mantém o frame: a tabela anterior fica visível, esmaecida.
   *
   * É o par obrigatório do `placeholderData: keepPreviousData` global. Quem
   * segura dado velho precisa DIZER que é velho — sem este canal a linha da
   * janela anterior fica na tela com cara de linha da janela atual.
   */
  isRefreshing?: boolean
  /** linhas do esqueleto — aproxime do tamanho real para a tela não pular */
  linhasEsqueleto?: number
  /** alvo da âncora do bloco de resumo ("ver o card que prova") */
  id?: string
  /** degrau da escada de profundidade — vira `data-nivel` e o CI verifica */
  nivel?: NivelDeAnalise
  className?: string
  children: ReactNode
}

/**
 * Moldura padrão de tabela — o par do ChartCard.
 *
 * Existe por dois motivos. O primeiro é o cabeçalho: as tabelas abriam com
 * título grande e um parágrafo de descrição enquanto os gráficos ao lado já
 * abriam com ícone, rótulo curto e número. Duas gramáticas no mesmo mosaico.
 *
 * O segundo é que o estado de carregando/erro estava reescrito à mão em oito
 * páginas, cada uma com sua contagem de esqueletos. Aqui é um lugar só.
 */
export function TabelaCard({
  isLoading = false,
  isError = false,
  onRetry,
  isRefreshing = false,
  linhasEsqueleto = 6,
  id,
  nivel,
  className,
  children,
  ...cabecalho
}: TabelaCardProps) {
  return (
    <Card id={id} data-nivel={nivel} className={cn('glass-card gap-3', className)}>
      <CardCabecalho {...cabecalho} />

      <CardContent
        className={cn(
          'min-w-0 transition-opacity',
          isRefreshing && 'pointer-events-none opacity-60',
        )}
      >
        {isLoading ? (
          <div className="space-y-2" aria-hidden>
            {Array.from({ length: linhasEsqueleto }, (_, i) => (
              <Skeleton key={i} className="h-9 w-full rounded-md" />
            ))}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
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
        ) : (
          children
        )}
      </CardContent>
    </Card>
  )
}
