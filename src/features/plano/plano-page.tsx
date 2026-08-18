import { useMemo } from 'react'
import { Link } from 'react-router'
import { ArrowRightIcon } from 'lucide-react'

import { PARAM_ABA } from '@/components/layout/aba-do-modulo'
import { CabecalhoDeModulo } from '@/components/layout/cabecalho-de-modulo'
import { moduloDaTela } from '@/components/layout/nav-items'
import { KpiCard, KpiGrid } from '@/components/charts'
import { StatusPill } from '@/components/ui-marca/status-pill'
import { Skeleton } from '@/components/ui/skeleton'
import { formatInt } from '@/lib/format'
import { lerSeveridade } from '@/lib/severidade'
import { preencherGabarito } from '@/features/resumo/gabarito'
import { usePlanoDeAcao, type AchadoDoPlano } from '@/features/plano/queries'

/**
 * Um item do plano.
 *
 * Mesma anatomia de três degraus da análise por tela — o fato, a leitura, a
 * ação — porque é o mesmo achado. O que muda é o que o item precisa carregar
 * a mais: **de qual módulo ele veio**, já que aqui o leitor não tem o contexto
 * da tela em volta.
 */
function ItemDoPlano({ achado, ordem }: { achado: AchadoDoPlano; ordem: number }) {
  const { tom, rotulo } = lerSeveridade(achado.severidade)
  const modulo = moduloDaTela(achado.tela)

  // O destino leva à tela, à aba certa e ao card que prova. Sem a aba, o link
  // abriria na análise escrita e o gráfico ficaria a um clique de distância
  // que ninguém dá.
  const destino = modulo
    ? `${modulo.to}?${PARAM_ABA}=${achado.ancora_aba ?? 'graficos'}`
    : null

  return (
    <li className="border-border/70 border-t pt-6 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-muted-foreground num text-xs">{formatInt(ordem)}</span>
        <h3 className="text-lg font-medium tracking-tight">{achado.titulo}</h3>
        <StatusPill tom={tom}>{rotulo}</StatusPill>
        <span className="text-muted-foreground text-xs">{modulo?.title ?? achado.tela}</span>
      </div>

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

        {destino ? (
          <Link
            to={destino}
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex items-center gap-1 text-sm underline-offset-4 transition-colors hover:underline focus-visible:ring-2 focus-visible:outline-none"
          >
            Abrir em {modulo?.title}
            <ArrowRightIcon className="size-3.5" aria-hidden />
          </Link>
        ) : null}
      </div>
    </li>
  )
}

/**
 * O plano de ação — a camada de cima das três.
 *
 * Quatro regras que não são estéticas:
 *
 * - **Nada é calculado aqui.** Cada item é um achado que já saiu do calculador
 *   da própria tela, com a régua daquela tela e o número que o card daquela
 *   tela mostra. Esta página junta e ordena; ela não é uma segunda conta.
 * - **A ordem é a mensagem, não a presença.** `score` é múltiplo do limiar de
 *   cada regra, e é isso que torna comparável regra de unidade diferente. Já a
 *   PRESENÇA na lista vale pouco enquanto o motor estiver saturado — e ele
 *   está, o que a própria página declara.
 * - **Sem seletor de período**, porque o plano atravessa telas com janelas
 *   diferentes. Cada frase carrega a própria régua.
 * - **O que foi suprimido aparece com o motivo**, como na análise por tela.
 */
export function PlanoDeAcaoPage() {
  const plano = usePlanoDeAcao()

  const { publicaveis, suprimidos, criticos, modulos } = useMemo(() => {
    const todos = plano.data ?? []
    const pub = todos.filter((a) => !a.suprimida)
    return {
      publicaveis: pub,
      suprimidos: todos.filter((a) => a.suprimida),
      criticos: pub.filter((a) => a.severidade === 'critico').length,
      modulos: new Set(pub.map((a) => a.tela)).size,
    }
  }, [plano.data])

  const avaliadas = (plano.data ?? []).length
  // Um motor que quase sempre acha algo rankeia bem e filtra mal. O número fica
  // na tela porque ele muda como esta lista deve ser lida.
  const saturacao = avaliadas > 0 ? publicaveis.length / avaliadas : null

  return (
    <div className="space-y-4">
      <CabecalhoDeModulo />

      <KpiGrid>
        <KpiCard
          label="Achados publicáveis"
          value={plano.data ? publicaveis.length : null}
          format={formatInt}
          isLoading={plano.isLoading}
          isError={plano.isError}
        />
        <KpiCard
          label="Em risco alto"
          value={plano.data ? criticos : null}
          format={formatInt}
          isLoading={plano.isLoading}
          isError={plano.isError}
        />
        <KpiCard
          label="Módulos com achado"
          value={plano.data ? modulos : null}
          format={formatInt}
          isLoading={plano.isLoading}
          isError={plano.isError}
        />
        <KpiCard
          label="Regras avaliadas"
          value={plano.data ? avaliadas : null}
          format={formatInt}
          isLoading={plano.isLoading}
          isError={plano.isError}
        />
      </KpiGrid>

      {/*
        DOCUMENTO, não seção com mosaico. A primeira versão embrulhava esta
        lista numa `SecaoDeAnalise`, que põe os filhos dentro de um `BentoGrid`
        de 12 colunas — e um `<div>` cru ali vira item de UMA coluna a partir de
        `md`. No celular passava; no desktop a página desmontava numa tira.

        A gramática certa é a da aba `Análise`: leitura à esquerda em medida
        fixa, prestação de contas à direita. É a mesma natureza de conteúdo.
      */}
      <div className="grid gap-10 lg:grid-cols-[minmax(0,72ch)_minmax(16rem,26rem)] lg:gap-14">
        <div className="space-y-8">
          <header className="space-y-1">
            <h2 className="text-xl font-medium tracking-tight">O que atacar primeiro</h2>
            <p className="text-muted-foreground text-sm">
              Ordenado por gravidade medida — cada achado vale um múltiplo do limiar da própria
              regra, que é o que torna comparáveis regras de unidades diferentes.
            </p>
          </header>

          {plano.isLoading ? (
            <div className="space-y-6">
              {[0, 1, 2].map((i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-6 w-2/3 rounded-md" />
                  <Skeleton className="h-4 w-full rounded-md" />
                  <Skeleton className="h-16 w-4/5 rounded-md" />
                </div>
              ))}
            </div>
          ) : plano.isError ? (
            <p className="text-muted-foreground text-[15px]">
              Não foi possível carregar o plano de ação.
            </p>
          ) : publicaveis.length === 0 ? (
            <p className="text-[15px] leading-relaxed">
              Nada fora do padrão nas {formatInt(avaliadas)} regras avaliadas. O plano tem
              permissão de não ter o que dizer — e é isso que dá crédito às vezes em que ele
              tem.
            </p>
          ) : (
            <ol className="space-y-8">
              {publicaveis.map((achado, i) => (
                <ItemDoPlano key={`${achado.tela}-${achado.regra}`} achado={achado} ordem={i + 1} />
              ))}
            </ol>
          )}
        </div>

        <aside className="space-y-6 text-sm lg:pt-1">
          <section className="space-y-2">
            <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Como esta lista foi montada
            </h3>
            <p className="text-muted-foreground max-w-[52ch] leading-relaxed">
              Cada item sai do motor determinístico da tela de origem — sem modelo de linguagem
              no caminho. O número da frase é o mesmo que o card daquela tela desenha, porque o
              calculador chama a mesma consulta com os mesmos argumentos.
            </p>
          </section>

          {saturacao != null && saturacao > 0.8 ? (
            <section className="space-y-2">
              <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                O motor está saturado
              </h3>
              <p className="max-w-[52ch] leading-relaxed">
                <strong className="font-medium">
                  {formatInt(publicaveis.length)} das {formatInt(avaliadas)} regras dispararam.
                </strong>{' '}
                <span className="text-muted-foreground">
                  Um catálogo calibrado para achar quase sempre rankeia bem e filtra mal — então
                  a <em>ordem</em> desta lista vale mais que a presença de um item nela.
                  Recalibrar os limiares é decisão em aberto, e enquanto isso ela fica declarada
                  aqui em vez de passar por completude.
                </span>
              </p>
            </section>
          ) : null}

          {suprimidos.length > 0 ? (
            <section className="space-y-2">
              <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                {formatInt(suprimidos.length)} suprimido(s), com o motivo
              </h3>
              <ul className="text-muted-foreground max-w-[52ch] space-y-1.5 leading-relaxed">
                {suprimidos.map((a) => (
                  <li key={`${a.tela}-${a.regra}`}>
                    <span className="text-foreground">{a.titulo}</span> —{' '}
                    {a.motivo ?? 'sem amostra suficiente'} ({moduloDaTela(a.tela)?.title ?? a.tela})
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="space-y-2">
            <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              O que este plano não faz
            </h3>
            <p className="text-muted-foreground max-w-[52ch] leading-relaxed">
              Ele relata; não gere. Não há dono, prazo nem status por achado, e nenhum item
              promete efeito atribuível — não existe experimentação em nenhuma das fontes, então
              "fizemos isto e melhorou" não seria uma afirmação que este BI consegue sustentar.
            </p>
          </section>
        </aside>
      </div>
    </div>
  )
}
