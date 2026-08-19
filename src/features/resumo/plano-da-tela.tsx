import { Link, useSearchParams } from 'react-router'
import { AlertCircleIcon, ArrowRightIcon } from 'lucide-react'

import { PARAM_ABA } from '@/components/layout/aba-do-modulo'
import { AcordeaoDeAchados } from '@/components/ui-marca/acordeao-de-achados'
import { Skeleton } from '@/components/ui/skeleton'
import { formatInt } from '@/lib/format'
import type { Periodo } from '@/lib/periodo'
import type { Recorte } from '@/lib/segmento'
import { lerSeveridade } from '@/lib/severidade'
import { preencherGabarito } from '@/features/resumo/gabarito'
import { useAchados, temRegra, type Achado } from '@/features/resumo/queries'

/**
 * O que abre quando o leitor clica: o fato que motiva a sugestão.
 *
 * Aqui a ordem se INVERTE em relação à aba `Análise`. Lá o resumo visível é o
 * fato e a ação fica no detalhe; nesta aba o leitor veio atrás do que fazer,
 * então a ação é o resumo e o número passa a ser a justificativa. É o mesmo
 * achado, com o peso trocado — nunca um número diferente.
 */
function JustificativaDoAchado({ achado }: { achado: Achado }) {
  const [params] = useSearchParams()

  const proximos = new URLSearchParams(params)
  proximos.set(PARAM_ABA, achado.ancora_aba ?? 'graficos')

  return (
    <>
      <p className="text-[15px] leading-relaxed">
        <span className="font-medium">Por quê: </span>
        {preencherGabarito(achado.gabarito, achado.parametros)}
      </p>

      {achado.gabarito_leitura ? (
        <p className="text-muted-foreground text-[15px] leading-relaxed">
          {preencherGabarito(achado.gabarito_leitura, achado.parametros)}
        </p>
      ) : null}

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
    </>
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
      <div className="max-w-[68ch] space-y-3">
        <p className="text-[15px] leading-relaxed">
          Esta tela ainda não tem regra no catálogo do motor, então não há sugestão calculada
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

  const todos = achados.data ?? []
  const publicaveis = todos.filter((a) => !a.suprimida)
  const suprimidos = todos.filter((a) => a.suprimida)

  return (
    /*
      SEM card, e em duas colunas a partir de xl — a MESMA gramática da aba
      `Análise`, que é a irmã desta. A primeira versão embrulhava tudo numa
      moldura branca própria: a aba ao lado é documento e esta era bloco, então
      trocar de aba trocava a natureza da página, e a linha de sugestão herdava
      dois paddings para exibir texto.

      À esquerda a sugestão, em medida de leitura. À direita a prestação de
      contas: o que foi suprimido e o que este bloco NÃO faz.
    */
    <div className="grid gap-10 xl:grid-cols-[minmax(0,68ch)_minmax(16rem,26rem)] xl:gap-14">
      <div className="space-y-8">
        <header className="space-y-1">
          <h2 className="text-xl font-medium tracking-tight">O que fazer a respeito</h2>
          <p className="text-muted-foreground text-sm">
            {achados.isLoading
              ? 'Calculando…'
              : `${formatInt(publicaveis.length)} sugest${
                  publicaveis.length === 1 ? 'ão' : 'ões'
                } para esta tela, em ordem de gravidade medida`}
          </p>
        </header>

        {achados.isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-5 w-72 rounded-md" />
            <Skeleton className="h-4 w-full rounded-md" />
            <Skeleton className="h-16 w-full rounded-md" />
          </div>
        ) : achados.isError ? (
          <p className="text-muted-foreground flex items-center gap-2 text-[15px]">
            <AlertCircleIcon className="size-4 shrink-0" aria-hidden />
            Não foi possível carregar as sugestões.
          </p>
        ) : publicaveis.length === 0 ? (
          <p className="text-[15px] leading-relaxed">
            Nada fora do padrão nas {formatInt(todos.length)} regras avaliadas desta tela. O bloco
            tem permissão de não ter o que sugerir — e é isso que dá crédito às vezes em que ele
            tem.
          </p>
        ) : (
          <AcordeaoDeAchados
            achados={publicaveis.map((achado) => ({
              id: achado.regra,
              titulo: achado.titulo,
              severidade: lerSeveridade(achado.severidade),
              // fechado, a linha visível é a AÇÃO — é o que se procura aqui
              resumo: preencherGabarito(achado.gabarito_acao, achado.parametros),
              detalhe: <JustificativaDoAchado achado={achado} />,
            }))}
          />
        )}
      </div>

      <aside className="space-y-6 text-sm xl:pt-1">
        <section className="space-y-2">
          <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            O que este bloco não faz
          </h3>
          <p className="text-muted-foreground max-w-[52ch] leading-relaxed">
            O BI reporta; ele não gere. Não há dono, prazo nem status, e nenhum item promete
            efeito atribuível — não existe experimentação em nenhuma das três fontes, então
            "fizemos isto e melhorou" não é afirmação que este BI consegue sustentar.
          </p>
          <p className="text-muted-foreground max-w-[52ch] leading-relaxed">
            Nada aqui é recalculado: é o mesmo achado que a aba <em>Análise</em> lê, com a mesma
            régua. Muda o que fica em primeiro plano, nunca o número.
          </p>
        </section>

        {suprimidos.length > 0 ? (
          <section className="space-y-2">
            <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Suprimidas, com o motivo
            </h3>
            <ul className="text-muted-foreground max-w-[52ch] space-y-1.5 leading-relaxed">
              {suprimidos.map((a) => (
                <li key={a.regra}>
                  <span className="text-foreground">{a.titulo}</span> —{' '}
                  {a.motivo ?? 'sem amostra suficiente'}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </aside>
    </div>
  )
}
