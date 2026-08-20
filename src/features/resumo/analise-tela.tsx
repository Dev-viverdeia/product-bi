import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router'
import { AlertCircleIcon, ArrowRightIcon } from 'lucide-react'

import { PARAM_ABA } from '@/components/layout/aba-do-modulo'
import { AcordeaoDeAchados } from '@/components/ui-marca/acordeao-de-achados'
import { Skeleton } from '@/components/ui/skeleton'
import type { Periodo } from '@/lib/periodo'
import { formatDateShort, formatInt } from '@/lib/format'
import { AMOSTRA_MINIMA, rotuloPapel, type Recorte } from '@/lib/segmento'
import { lerSeveridade } from '@/lib/severidade'
import { DocumentoDeAchados } from '@/features/resumo/documento'
import { preencherGabarito } from '@/features/resumo/gabarito'
import {
  temRegra,
  useAchados,
  useDataReferencia,
  type Achado,
} from '@/features/resumo/queries'
import { selecionar } from '@/features/resumo/selecao'


const PLANO: Record<string, string> = {
  starter: 'Starter',
  pro: 'Pro',
  enterprise: 'Enterprise',
  sem_plano: 'sem plano',
}

/**
 * O que abre quando o leitor clica: a leitura e a ação.
 *
 * O fato NÃO entra aqui — ele é o resumo do acordeão, sempre visível. Repeti-lo
 * dentro do detalhe faria o mesmo número aparecer duas vezes na mesma linha
 * assim que ela abrisse.
 */
function DetalheDoAchado({ achado }: { achado: Achado }) {
  const [params] = useSearchParams()

  const destino = useMemo(() => {
    const proximos = new URLSearchParams(params)
    proximos.set(PARAM_ABA, achado.ancora_aba ?? 'graficos')
    return `?${proximos.toString()}`
  }, [params, achado.ancora_aba])

  return (
    <>
      {achado.gabarito_leitura ? (
        <p className="text-[15px] leading-relaxed">
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
    </>
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
  tela: string
  /** omitir nas telas sem seletor de período — cada achado declara a própria janela */
  periodo?: Periodo
  /** omitir nas telas sem o recorte por persona e plano */
  recorte?: Recorte
}) {
  const achados = useAchados(tela, periodo, recorte)
  const referencia = useDataReferencia()

  // A aba existe em TODA tela desde o padrão de três abas; o motor ainda não
  // cobre todas. Declarar o vazio é melhor que a tela ficar fora do padrão.
  const semRegra = !temRegra(tela)

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

  if (semRegra) {
    return (
      <div className="max-w-[68ch] space-y-3">
        <p className="text-[15px] leading-relaxed">
          Esta tela ainda não tem regra no catálogo do motor, então não há leitura calculada
          para ela.
        </p>
        <p className="text-muted-foreground text-[15px] leading-relaxed">
          A aba existe mesmo assim para o padrão ser o mesmo em todo módulo — e para a dívida
          ficar visível na tela em vez de escondida numa exceção de layout. O catálogo aberto
          está em <span className="font-mono text-sm">/regras</span>.
        </p>
      </div>
    )
  }

  return (
    <DocumentoDeAchados
      titulo="O que os dados dizem"
      escopo={escopo}
      placar={
        apuracao
          ? {
              avaliadas,
              emTela: visiveis.length,
              semLastro: suprimidos.length,
              abaixoDoCorte,
            }
          : undefined
      }
      aparato={
        apuracao ? (
          <>
            {suprimidos.length > 0 ? (
              <section className="space-y-2">
                <h3 className="text-base font-medium tracking-tight">
                  O que não dá para afirmar
                </h3>
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

            <section className="space-y-2">
              <h3 className="text-base font-medium tracking-tight">Como isto foi apurado</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Nenhuma frase acima foi escrita na hora. Cada uma vem de um gabarito
                versionado no banco, preenchido com os mesmos números que os gráficos da
                aba ao lado desenham — não há uma segunda conta em lugar nenhum.
              </p>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Percentual só aparece com pelo menos {formatInt(AMOSTRA_MINIMA)} clientes no
                denominador, e diferença entre dois grupos só vira achado quando passa de
                dois erros padrão da própria estimativa.{' '}
                <Link to="/regras" className="underline underline-offset-4">
                  Ver o catálogo completo
                </Link>
                .
              </p>
            </section>
          </>
        ) : undefined
      }
    >
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
            leitura cobre as perguntas que alguém previu, e só essas. Elas estão listadas
            em{' '}
            <Link to="/regras" className="underline underline-offset-4">
              regras do resumo
            </Link>
            .
          </p>
        </div>
      ) : (
        <AcordeaoDeAchados
          achados={visiveis.map((achado) => ({
            id: achado.regra,
            titulo: achado.titulo,
            severidade: lerSeveridade(achado.severidade),
            // fechado, a linha visível é o FATO: quem passa o olho leva o
            // número embora sem abrir nada
            resumo: preencherGabarito(achado.gabarito, achado.parametros),
            detalhe: <DetalheDoAchado achado={achado} />,
          }))}
        />
      )}
    </DocumentoDeAchados>
  )
}
