import { Link, useSearchParams } from 'react-router'
import { ArrowRightIcon, ClipboardListIcon } from 'lucide-react'

import { PARAM_ABA } from '@/components/layout/aba-do-modulo'
import { StatusPill } from '@/components/ui-marca/status-pill'
import { Skeleton } from '@/components/ui/skeleton'
import { formatInt } from '@/lib/format'
import type { Periodo } from '@/lib/periodo'
import type { Recorte } from '@/lib/segmento'
import { lerSeveridade } from '@/lib/severidade'
import { preencherGabarito } from '@/features/resumo/gabarito'
import { useAchados, temRegra, type Achado } from '@/features/resumo/queries'

/**
 * Um item da sugestão: o fato que a sustenta, e a ação.
 *
 * A diferença para o mesmo achado na aba `Análise` é de FOCO, não de conteúdo:
 * lá o peso está na leitura ("o que isto significa, e o que não significa"),
 * aqui está na ação. O fato aparece nos dois porque uma sugestão sem o número
 * que a motiva é palpite com cara de recomendação.
 */
function Sugestao({ achado, ordem }: { achado: Achado; ordem: number }) {
  const [params] = useSearchParams()
  const { tom, rotulo } = lerSeveridade(achado.severidade)

  const proximos = new URLSearchParams(params)
  proximos.set(PARAM_ABA, achado.ancora_aba ?? 'graficos')

  return (
    <li className="border-border/70 border-t pt-6 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-muted-foreground num text-xs">{formatInt(ordem)}</span>
        <h3 className="text-lg font-medium tracking-tight">{achado.titulo}</h3>
        <StatusPill tom={tom}>{rotulo}</StatusPill>
      </div>

      <div className="mt-3 max-w-[68ch] space-y-3">
        <div className="border-border bg-muted/40 rounded-md border px-4 py-3">
          <p className="text-muted-foreground mb-1 text-xs font-medium">O que fazer</p>
          <p className="text-[15px] leading-relaxed">
            {preencherGabarito(achado.gabarito_acao, achado.parametros)}
          </p>
        </div>

        <p className="text-muted-foreground text-[15px] leading-relaxed">
          <span className="text-foreground font-medium">Por quê: </span>
          {preencherGabarito(achado.gabarito, achado.parametros)}
        </p>

        <Link
          to={`?${proximos.toString()}`}
          replace
          onClick={() => {
            requestAnimationFrame(() =>
              document
                .getElementById(achado.ancora_id)
                ?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
            )
          }}
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex items-center gap-1 text-sm underline-offset-4 transition-colors hover:underline focus-visible:ring-2 focus-visible:outline-none"
        >
          Ver o gráfico que sustenta
          <ArrowRightIcon className="size-3.5" aria-hidden />
        </Link>
      </div>
    </li>
  )
}

/**
 * A terceira aba de todo módulo: **a sugestão de plano daquela tela**.
 *
 * O padrão de tela é `Gráficos` (o dado) · `Análise` (a leitura) · `Plano` (a
 * sugestão), igual em todos os módulos — decisão do Mateus em 18/ago. Esta é a
 * terceira.
 *
 * Regras que não são estéticas:
 *
 * - **Nada é calculado aqui.** É o mesmo achado do motor determinístico que a
 *   aba `Análise` lê — mesma consulta, mesmo cache, mesma régua. A aba muda o
 *   que fica em primeiro plano, nunca o número.
 * - **Sugestão, não ordem.** O título da aba é "Plano" e o texto é de
 *   sugestão: o BI **reporta**, não gere. Não há dono, prazo nem status, e
 *   nenhum item promete efeito atribuível — não existe experimentação em
 *   nenhuma das três fontes, então "fizemos X e melhorou" não é afirmação que
 *   este BI consegue sustentar.
 * - **Tela sem regra diz isso**, em vez de mostrar erro ou uma aba vazia. É o
 *   caso de CS hoje.
 * - **O que foi suprimido aparece com o motivo**, como nas outras camadas.
 */
export function PlanoDaTela({
  tela,
  periodo,
  recorte,
}: {
  tela: string
  /** omitir nas telas sem seletor de período */
  periodo?: Periodo
  /** omitir nas telas sem o recorte por persona e plano */
  recorte?: Recorte
}) {
  const achados = useAchados(tela, periodo, recorte)

  if (!temRegra(tela)) {
    return (
      <div className="bg-card border-border/60 rounded-lg border p-5 shadow-sm md:p-6">
        <p className="max-w-[68ch] text-[15px] leading-relaxed">
          Esta tela ainda não tem regra no catálogo do motor, então não há sugestão calculada
          para ela.
        </p>
        <p className="text-muted-foreground mt-3 max-w-[68ch] text-[15px] leading-relaxed">
          A aba existe mesmo assim para o padrão ser o mesmo em todo módulo — e para a dívida
          ficar visível na tela em vez de escondida numa exceção de layout. O catálogo aberto
          está em <span className="font-mono text-sm">/regras</span>.
        </p>
      </div>
    )
  }

  const todos = achados.data ?? []
  const publicaveis = todos.filter((a) => !a.suprimida)
  const suprimidos = todos.filter((a) => a.suprimida)

  return (
    <div className="bg-card border-border/60 rounded-lg border p-5 shadow-sm md:p-6">
      {achados.isLoading ? (
        <div className="space-y-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-16 w-full" />
            </div>
          ))}
        </div>
      ) : achados.isError ? (
        <p className="text-muted-foreground text-sm">Não foi possível carregar as sugestões.</p>
      ) : publicaveis.length === 0 ? (
        <p className="max-w-[68ch] text-[15px] leading-relaxed">
          Nada fora do padrão nas {formatInt(todos.length)} regras avaliadas desta tela. O bloco
          tem permissão de não ter o que sugerir — e é isso que dá crédito às vezes em que ele
          tem.
        </p>
      ) : (
        <>
          <div className="mb-5 flex items-center gap-2">
            <ClipboardListIcon aria-hidden className="text-muted-foreground size-4" />
            <p className="text-muted-foreground text-sm">
              {formatInt(publicaveis.length)} sugest{publicaveis.length === 1 ? 'ão' : 'ões'} para
              esta tela, em ordem de gravidade medida
            </p>
          </div>
          <ol className="space-y-6">
            {publicaveis.map((achado, i) => (
              <Sugestao key={achado.regra} achado={achado} ordem={i + 1} />
            ))}
          </ol>
        </>
      )}

      {suprimidos.length > 0 ? (
        <div className="border-border/70 mt-6 max-w-[68ch] border-t pt-4">
          <p className="mb-1 text-sm font-medium">
            {formatInt(suprimidos.length)} suprimida(s), com o motivo:
          </p>
          <ul className="text-muted-foreground list-inside list-disc space-y-1 text-sm">
            {suprimidos.map((a) => (
              <li key={a.regra}>
                {a.titulo} — {a.motivo ?? 'sem amostra suficiente'}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
