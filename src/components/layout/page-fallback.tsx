import { Skeleton } from '@/components/ui/skeleton'

/**
 * Espera de rota com carregamento sob demanda.
 *
 * Reproduz o esqueleto de um módulo típico (faixa de KPIs + dois gráficos) em
 * vez de um spinner: o layout não pula quando o conteúdo chega, e a espera
 * comunica o que está vindo. Sem texto — a rota ainda não sabe o próprio nome.
 */
export function PageFallback() {
  return (
    <div className="space-y-4" role="status" aria-label="Carregando o módulo">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-lg" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-72 rounded-lg" />
        <Skeleton className="h-72 rounded-lg" />
      </div>
    </div>
  )
}
