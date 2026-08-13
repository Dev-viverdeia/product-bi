import { useDataReferencia } from '@/features/resumo/queries'
import { formatDateShort } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * Até quando o dado vai — ao lado dos controles do módulo.
 *
 * Não é enfeite. Toda janela da tela ancora em `marts.data_referencia()`, que é
 * o último dia com dado carregado, e não em `now()`. Sem esta linha o leitor não
 * tem como saber se "últimos 30 dias" terminam hoje ou no dia em que o pipeline
 * parou — e é exatamente aí que um delta passa a medir a parada em vez do
 * cliente.
 *
 * O ponto verde é status ao vivo, o único caso em que o DS admite bolinha: ele
 * afirma "conferido, o dado é de hoje". Quando o dado atrasa, o ponto some e
 * quem grita é o `AlertaPipeline` na barra — dois avisos para o mesmo problema
 * treinariam o leitor a ignorar os dois.
 */
export function FrescorDoDado({ className }: { className?: string }) {
  const { data, isPending, isError } = useDataReferencia()

  // Silêncio enquanto carrega e quando falha: afirmar frescor sem ter conferido
  // é pior que não afirmar nada, e a falha já tem dono na barra do topo.
  if (isPending || isError || !data) return null

  const hoje = new Date().toISOString().slice(0, 10)
  const doDia = data >= hoje

  return (
    <p
      className={cn(
        'text-muted-foreground flex items-center gap-2 text-sm whitespace-nowrap',
        className,
      )}
    >
      {doDia ? <span aria-hidden className="bg-success size-1.5 rounded-full" /> : null}
      dados até {formatDateShort(data)}
    </p>
  )
}
