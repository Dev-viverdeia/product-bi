import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router'
import { AlertCircleIcon, ArrowRightIcon } from 'lucide-react'

import { PARAM_ABA } from '@/components/layout/aba-do-modulo'
import { StatusPill, type TomDeStatus } from '@/components/ui-marca/status-pill'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { Periodo } from '@/lib/periodo'
import { formatDateShort, formatInt } from '@/lib/format'
import { AMOSTRA_MINIMA, rotuloPapel, type Recorte } from '@/lib/segmento'
import { preencherGabarito } from '@/features/resumo/gabarito'
import {
  useAchados,
  useDataReferencia,
  type Achado,
  type TelaComResumo,
} from '@/features/resumo/queries'

/** Teto de achados na leitura. Acima disso vira lista e ninguém lê até o fim. */
const MAXIMO_DE_ACHADOS = 3

const TOM: Record<string, { tom: TomDeStatus; rotulo: string }> = {
  critico: { tom: 'critico', rotulo: 'risco alto' },
  atencao: { tom: 'atencao', rotulo: 'atenção' },
  neutro: { tom: 'neutro', rotulo: 'observação' },
}

const PLANO: Record<string, string> = {
  starter: 'Starter',
  pro: 'Pro',
  enterprise: 'Enterprise',
  sem_plano: 'sem plano',
}

/**
 * Seleção: no máximo três, no máximo um por família.
 *
 * Sem o corte por família a leitura diz "retenção" três vezes com palavras
 * diferentes. A ordem já vem do banco, por múltiplo do próprio limiar de cada
 * regra — é o que torna comparáveis regras de unidades diferentes.
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

/** Uma seção por achado: o fato, o que ele quer dizer, e o que fazer. */
function Achado({ achado, ordem }: { achado: Achado; ordem: number }) {
  const [params] = useSearchParams()
  const { tom, rotulo } = TOM[achado.severidade] ?? TOM.neutro!

  const destino = useMemo(() => {
    const proximos = new URLSearchParams(params)
    proximos.set(PARAM_ABA, achado.ancora_aba ?? 'graficos')
    return `?${proximos.toString()}`
  }, [params, achado.ancora_aba])

  return (
    <section className="border-border/70 border-t pt-6 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-muted-foreground num text-xs">{formatInt(ordem)}</span>
        <h3 className="text-lg font-medium tracking-tight">{achado.titulo}</h3>
        <StatusPill tom={tom}>{rotulo}</StatusPill>
      </div>

      {/* Medida de leitura: prosa em coluna larga cansa antes do fim do
          parágrafo, e este texto existe para ser lido inteiro. */}
      <div className="mt-3 max-w-[68ch] space-y-3">
        <p className="text-[15px] leading-relaxed font-medium">
          {preencherGabarito(achado.gabarito, achado.parametros)}
        </p>
        {achado.gabarito_leitura ? (
          <p className="text-muted-foreground text-[15px] leading-relaxed">
            {preencherGabarito(achado.gabarito_leitura, achado.parametros)}
          </p>
        ) : null}

        <div className="border-border bg-muted/40 rounded-md border px-4 py-3">
          <p className="text-muted-foreground mb-1 text-xs font-medium">O que fazer</p>
          <p className="text-[15px] leading-relaxed">
            {preencherGabarito(achado.gabarito_acao, achado.parametros)}
          </p>
        </div>

        <Link
          to={destino}
          replace
          onClick={() => {
            // A troca de aba remonta o conteúdo, então o alvo só existe no
            // quadro seguinte — daí o rAF em vez de rolar na hora.
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
    </section>
  )
}

/**
 * A leitura escrita de uma tela — a aba irmã dos gráficos.
 *
 * Três regras que não são estéticas:
 *
 * - **Nada aqui é redigido na hora.** Cada frase vem de um gabarito versionado
 *   no catálogo do banco, preenchido com os números que os gráficos da aba ao
 *   lado desenham. Não há modelo de linguagem no caminho: direcionamento é
 *   afirmação, e afirmação não revisada não chega ao leitor.
 * - **A leitura tem permissão de não ter o que dizer.** Um texto que sempre
 *   acha algo vira ruído e queima a credibilidade da tela inteira.
 * - **O que foi suprimido aparece, com o motivo.** Esconder a supressão
 *   contradiz a régua da casa exatamente onde ela mais importa.
 */
export function AnaliseDaTela({
  tela,
  periodo,
  recorte,
}: {
  tela: TelaComResumo
  /** omitir nas telas sem seletor de período — cada achado declara a própria janela */
  periodo?: Periodo
  /** omitir nas telas sem o recorte por persona e plano */
  recorte?: Recorte
}) {
  const achados = useAchados(tela, periodo, recorte)
  const referencia = useDataReferencia()

  const { visiveis, suprimidos, abaixoDoCorte, avaliadas } = useMemo(
    () => selecionar(achados.data ?? []),
    [achados.data],
  )

  // O escopo só afirma o que a tela de fato controla. Anunciar "todos os papéis"
  // onde não existe filtro de papel descreve um recorte que o leitor não pode
  // mudar — e sugere que os outros existem em algum lugar.
  const escopo = [
    periodo === undefined ? null : `últimos ${formatInt(periodo)} dias`,
    recorte === undefined ? null : (recorte.papel ? rotuloPapel(recorte.papel) : 'todos os papéis'),
    recorte === undefined
      ? null
      : recorte.plano
        ? (PLANO[recorte.plano] ?? recorte.plano)
        : 'todos os planos',
    referencia.data ? `dados até ${formatDateShort(referencia.data)}` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  const apuracao = !achados.isLoading && !achados.isError

  return (
    <Card className="glass-card">
      {/*
        Duas colunas a partir de lg: os achados à esquerda, numa medida de
        leitura fixa, e o aparato à direita — o que não dá para afirmar e como
        se apurou. A separação não é só de espaço: um é o conteúdo, o outro é a
        prestação de contas, e misturá-los na mesma coluna faz o leitor
        atravessar régua para chegar ao próximo achado. Abaixo de lg empilha, e
        o aparato vai para o fim, que é onde ele pertence quando não cabe ao
        lado.
      */}
      <CardContent className="grid gap-10 py-2 lg:grid-cols-[minmax(0,68ch)_minmax(0,1fr)] lg:gap-14">
        <div className="space-y-8">
          <header className="space-y-1">
            <h2 className="text-xl font-medium tracking-tight">O que os dados dizem</h2>
            <p className="text-muted-foreground text-sm">{escopo}</p>
          </header>

          {achados.isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-5 w-72 rounded-md" />
            <Skeleton className="h-4 w-full rounded-md" />
            <Skeleton className="h-4 w-5/6 rounded-md" />
            <Skeleton className="h-16 w-full rounded-md" />
          </div>
        ) : achados.isError ? (
          <p className="text-muted-foreground flex items-center gap-2 text-[15px]">
            <AlertCircleIcon className="size-4 shrink-0" aria-hidden />
            Não foi possível avaliar as regras desta tela.
          </p>
        ) : visiveis.length === 0 ? (
          <div className="space-y-3">
            <p className="text-[15px] leading-relaxed font-medium">
              Nada fora do padrão neste recorte.
            </p>
            <p className="text-muted-foreground text-[15px] leading-relaxed">
              {avaliadas === 1
                ? 'A regra desta tela foi avaliada'
                : `As ${formatInt(avaliadas)} regras desta tela foram avaliadas`}{' '}
              e nenhuma cruzou o limiar. Isto não é um atestado de que está tudo bem: a
              leitura cobre as perguntas que alguém previu, e só essas. Elas estão
              listadas em{' '}
              <Link to="/regras" className="underline underline-offset-4">
                regras do resumo
              </Link>
              .
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {visiveis.map((achado, i) => (
              <Achado key={achado.regra} achado={achado} ordem={i + 1} />
            ))}
          </div>
        )}
        </div>

        <aside className="space-y-8 lg:pt-14">
        {suprimidos.length > 0 && apuracao ? (
          <section className="space-y-2">
            <h3 className="text-base font-medium tracking-tight">O que não dá para afirmar</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {suprimidos.length === 1
                ? 'Uma pergunta foi avaliada e não produziu resposta sustentada.'
                : `${formatInt(suprimidos.length)} perguntas foram avaliadas e não produziram resposta sustentada.`}{' '}
              Ficam aqui em vez de sumir: onde o dado não sustenta, a tela declara.
            </p>
            <ul className="mt-3 space-y-2">
              {suprimidos.map((s) => (
                <li key={s.regra} className="text-sm leading-relaxed">
                  <span className="font-medium">{s.titulo}</span>
                  <span className="text-muted-foreground"> — {s.motivo}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {apuracao ? (
          <section className="space-y-2">
            <h3 className="text-base font-medium tracking-tight">Como isto foi apurado</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Nenhuma frase acima foi escrita na hora. Cada uma vem de um gabarito
              versionado no banco, preenchido com os mesmos números que os gráficos da aba
              ao lado desenham — não há uma segunda conta em lugar nenhum. Percentual só
              aparece com pelo menos {formatInt(AMOSTRA_MINIMA)} clientes no denominador, e
              diferença entre dois grupos só vira achado quando passa de dois erros padrão
              da própria estimativa.
            </p>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Nesta carga, {formatInt(avaliadas)}{' '}
              {avaliadas === 1 ? 'regra foi avaliada' : 'regras foram avaliadas'}:{' '}
              {formatInt(visiveis.length)} em tela, {formatInt(suprimidos.length)} sem
              lastro
              {abaixoDoCorte > 0 ? `, ${formatInt(abaixoDoCorte)} abaixo do corte` : ''}.{' '}
              <Link to="/regras" className="underline underline-offset-4">
                Ver o catálogo completo
              </Link>
              .
            </p>
          </section>
        ) : null}
        </aside>
      </CardContent>
    </Card>
  )
}
