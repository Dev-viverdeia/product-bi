import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router'
import { AlertCircleIcon, ArrowRightIcon, LightbulbIcon } from 'lucide-react'

import { PARAM_ABA } from '@/components/layout/modulo-tabs'
import { StatusPill, type TomDeStatus } from '@/components/ui-marca/status-pill'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { Periodo } from '@/components/filters/periodo-filtro'
import { formatDateShort, formatInt } from '@/lib/format'
import type { Recorte } from '@/lib/segmento'
import { cn } from '@/lib/utils'
import { preencherGabarito } from '@/features/resumo/gabarito'
import {
  useAchados,
  useDataReferencia,
  type Achado,
  type TelaComResumo,
} from '@/features/resumo/queries'

/** Teto de achados na tela. Acima disso o bloco vira lista e ninguém lê. */
const MAXIMO_DE_ACHADOS = 3

const TOM: Record<string, { tom: TomDeStatus; rotulo: string }> = {
  critico: { tom: 'critico', rotulo: 'risco alto' },
  atencao: { tom: 'atencao', rotulo: 'atenção' },
  neutro: { tom: 'neutro', rotulo: 'observação' },
}

/**
 * Escolhe o que aparece: no máximo três, e no máximo um por família.
 *
 * Sem o corte por família a tela diz "retenção" três vezes com palavras
 * diferentes. A ordem já vem do banco, por múltiplo do próprio limiar de cada
 * regra — que é o que torna regras de unidades diferentes comparáveis.
 */
function selecionar(achados: Achado[]) {
  const candidatos = achados.filter((a) => !a.suprimida)
  const visiveis: Achado[] = []
  for (const achado of candidatos) {
    if (visiveis.length >= MAXIMO_DE_ACHADOS) break
    if (visiveis.some((v) => v.familia === achado.familia)) continue
    visiveis.push(achado)
  }
  return {
    visiveis,
    suprimidos: achados.filter((a) => a.suprimida),
    abaixoDoCorte: candidatos.length - visiveis.length,
    avaliadas: achados.length,
  }
}

function Ancora({ achado }: { achado: Achado }) {
  const [params] = useSearchParams()

  const destino = useMemo(() => {
    const proximos = new URLSearchParams(params)
    if (achado.ancora_aba) proximos.set(PARAM_ABA, achado.ancora_aba)
    return `?${proximos.toString()}#${achado.ancora_id}`
  }, [params, achado.ancora_aba, achado.ancora_id])

  return (
    <Link
      to={destino}
      replace
      onClick={() => {
        // A troca de aba desmonta e remonta o conteúdo, então o alvo só existe
        // no quadro seguinte — daí o rAF em vez de rolar na hora.
        requestAnimationFrame(() =>
          document
            .getElementById(achado.ancora_id)
            ?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
        )
      }}
      className="text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex items-center gap-1 text-xs underline-offset-4 transition-colors hover:underline focus-visible:ring-2 focus-visible:outline-none"
    >
      Ver o card que prova
      <ArrowRightIcon className="size-3" aria-hidden />
    </Link>
  )
}

/**
 * Bloco "Resumo e direcionamento" — o topo de toda tela de produto.
 *
 * Três regras que não são estéticas:
 *
 * - **Nada aqui é redigido na hora.** Cada frase vem de um gabarito versionado
 *   no catálogo do banco, preenchido com os números que os cards desta mesma
 *   tela desenham. Não há modelo de linguagem no caminho: direcionamento é
 *   afirmação, e afirmação não revisada não chega ao leitor.
 * - **O bloco tem permissão de não ter o que dizer.** Um resumo que sempre
 *   acha algo vira ruído e queima a credibilidade da tela inteira. Quando
 *   nenhuma regra cruza o limiar, ele diz isso — e diz também que não está
 *   certificando ausência de problema, porque só sabe o que alguém previu.
 * - **O que foi suprimido aparece.** Esconder a supressão contradiz a régua da
 *   casa exatamente onde ela mais importa.
 */
export function ResumoCard({
  tela,
  periodo,
  recorte,
  className,
}: {
  tela: TelaComResumo
  periodo: Periodo
  recorte: Recorte
  className?: string
}) {
  const achados = useAchados(tela, periodo, recorte)
  const referencia = useDataReferencia()

  const { visiveis, suprimidos, abaixoDoCorte, avaliadas } = useMemo(
    () => selecionar(achados.data ?? []),
    [achados.data],
  )

  const carimbo = referencia.data ? `dados de ${formatDateShort(referencia.data)}` : null

  return (
    <Card className={cn('brand-card', className)}>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-medium">
            <LightbulbIcon className="size-4 shrink-0" aria-hidden />
            Resumo e direcionamento
          </p>
          {carimbo ? <p className="text-muted-foreground num text-xs">{carimbo}</p> : null}
        </div>

        {achados.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-64 rounded-md" />
            <Skeleton className="h-4 w-full rounded-md" />
            <Skeleton className="h-4 w-3/4 rounded-md" />
          </div>
        ) : achados.isError ? (
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <AlertCircleIcon className="size-4 shrink-0" aria-hidden />
            Não foi possível avaliar as regras desta tela.
          </p>
        ) : visiveis.length === 0 ? (
          <div className="space-y-2 text-sm">
            <p className="font-medium">Nada fora do padrão no período.</p>
            <p className="text-muted-foreground">
              {avaliadas === 1
                ? 'A regra desta tela foi avaliada'
                : `As ${formatInt(avaliadas)} regras desta tela foram avaliadas`}
              {carimbo ? ` nos ${carimbo}` : ''} e nenhuma cruzou o limiar. Este bloco não
              certifica ausência de problema — ele cobre as perguntas listadas em{' '}
              <Link to="/regras" className="underline underline-offset-4">
                regras do resumo
              </Link>
              .
            </p>
          </div>
        ) : (
          <ul className="space-y-4">
            {visiveis.map((achado) => (
              <li key={achado.regra} className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill tom={TOM[achado.severidade]?.tom ?? 'neutro'}>
                    {TOM[achado.severidade]?.rotulo ?? 'observação'}
                  </StatusPill>
                  <span className="text-sm font-medium">{achado.titulo}</span>
                </div>
                <p className="text-sm leading-relaxed">
                  {preencherGabarito(achado.gabarito, achado.parametros)}
                </p>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {preencherGabarito(achado.gabarito_acao, achado.parametros)}
                </p>
                <Ancora achado={achado} />
              </li>
            ))}
          </ul>
        )}

        {suprimidos.length > 0 && !achados.isLoading && !achados.isError ? (
          <div className="border-border space-y-1 border-t pt-3">
            <p className="text-xs font-medium">Não dá para afirmar</p>
            <ul className="text-muted-foreground space-y-0.5 text-xs">
              {suprimidos.map((s) => (
                <li key={s.regra}>
                  {s.titulo} — {s.motivo}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {!achados.isLoading && !achados.isError ? (
          <p className="text-muted-foreground num text-xs">
            {formatInt(avaliadas)} regras avaliadas · {formatInt(visiveis.length)} em tela ·{' '}
            {formatInt(suprimidos.length)} sem lastro · {formatInt(abaixoDoCorte)} abaixo do corte
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
