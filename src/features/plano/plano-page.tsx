import { useMemo } from 'react'
import { Link } from 'react-router'
import { AlertCircleIcon, ArrowRightIcon } from 'lucide-react'

import { PARAM_ABA } from '@/components/layout/aba-do-modulo'
import { CabecalhoDeModulo } from '@/components/layout/cabecalho-de-modulo'
import { ModuloTabs } from '@/components/layout/modulo-tabs'
import { moduloDaTela } from '@/components/layout/nav-items'
import { KpiCard, KpiGrid } from '@/components/charts'
import { AcordeaoDeAchados } from '@/components/ui-marca/acordeao-de-achados'
import { Skeleton } from '@/components/ui/skeleton'
import { formatInt } from '@/lib/format'
import { lerSeveridade } from '@/lib/severidade'
import { preencherGabarito } from '@/features/resumo/gabarito'
import { usePlanoDeAcao, type AchadoDoPlano } from '@/features/plano/queries'

/**
 * O que abre quando o leitor clica num item do plano.
 *
 * A linha fechada já traz o fato; aqui entram a leitura, a ação e o caminho de
 * volta ao card que prova. O módulo de origem fica no cabeçalho da linha,
 * porque sem ele o leitor transversal não sabe de qual tela veio o número.
 */
function DetalheDoItem({ achado }: { achado: AchadoDoPlano }) {
  const modulo = moduloDaTela(achado.tela)
  const destino = modulo ? `${modulo.to}?${PARAM_ABA}=${achado.ancora_aba ?? 'graficos'}` : null

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

      {destino ? (
        <Link
          to={destino}
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex items-center gap-1 text-sm underline-offset-4 transition-colors hover:underline focus-visible:ring-2 focus-visible:outline-none"
        >
          Abrir em {modulo?.title}
          <ArrowRightIcon className="size-3.5" aria-hidden />
        </Link>
      ) : null}
    </>
  )
}

/** Uma faixa de severidade: o que ela significa, e os achados dela por score. */
function FaixaDeAchados({
  achados,
  intro,
  vazio,
  carregando,
  erro,
}: {
  achados: AchadoDoPlano[]
  intro: string
  vazio: string
  carregando: boolean
  erro: boolean
}) {
  if (carregando) {
    return (
      <div className="max-w-[76ch] space-y-6">
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-6 w-2/3 rounded-md" />
            <Skeleton className="h-4 w-full rounded-md" />
            <Skeleton className="h-16 w-4/5 rounded-md" />
          </div>
        ))}
      </div>
    )
  }

  if (erro) {
    return (
      <p className="text-muted-foreground flex items-center gap-2 text-[15px]">
        <AlertCircleIcon className="size-4 shrink-0" aria-hidden />
        Não foi possível carregar o plano de ação.
      </p>
    )
  }

  if (achados.length === 0) {
    return <p className="max-w-[68ch] text-[15px] leading-relaxed">{vazio}</p>
  }

  return (
    <div className="max-w-[80ch] space-y-6">
      <p className="text-muted-foreground text-sm">{intro}</p>
      <AcordeaoDeAchados
        achados={achados.map((achado) => ({
          id: `${achado.tela}-${achado.regra}`,
          titulo: achado.titulo,
          severidade: lerSeveridade(achado.severidade),
          origem: moduloDaTela(achado.tela)?.title ?? achado.tela,
          resumo: preencherGabarito(achado.gabarito, achado.parametros),
          detalhe: <DetalheDoItem achado={achado} />,
        }))}
      />
    </div>
  )
}

/**
 * O plano de ação — a camada de cima das três.
 *
 * Cinco regras que não são estéticas:
 *
 * - **Nada é calculado aqui.** Cada item é um achado que já saiu do calculador
 *   da própria tela, com a régua daquela tela e o número que o card daquela
 *   tela mostra. Esta página junta e ordena; ela não é uma segunda conta.
 * - **Abas por SEVERIDADE, não por módulo.** Trinta e três achados numa lista
 *   só viram rolagem que ninguém termina; e agrupar por módulo devolveria ao
 *   leitor exatamente a pergunta que esta tela existe para responder — "o que
 *   primeiro?". Dentro de cada faixa a ordem continua sendo a do score.
 * - **A ordem é a mensagem, não a presença.** `score` é múltiplo do limiar de
 *   cada regra, e é isso que torna comparável regra de unidade diferente. Já a
 *   PRESENÇA na lista vale pouco enquanto o motor estiver saturado — e ele
 *   está, o que a aba `Como foi apurado` declara.
 * - **Sem seletor de período**, porque o plano atravessa telas com janelas
 *   diferentes. Cada frase carrega a própria régua.
 * - **O que foi suprimido aparece com o motivo**, como na análise por tela.
 */
export function PlanoDeAcaoPage() {
  const plano = usePlanoDeAcao()

  const { publicaveis, suprimidos, criticos, atencao, observacao, modulos } = useMemo(() => {
    const todos = plano.data ?? []
    const pub = todos.filter((a) => !a.suprimida)
    return {
      publicaveis: pub,
      suprimidos: todos.filter((a) => a.suprimida),
      criticos: pub.filter((a) => a.severidade === 'critico'),
      atencao: pub.filter((a) => a.severidade === 'atencao'),
      observacao: pub.filter((a) => a.severidade !== 'critico' && a.severidade !== 'atencao'),
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

      {/* Fora das abas: os KPIs são contexto das quatro. Trocar de faixa não
          pode custar o tamanho do todo. */}
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
          value={plano.data ? criticos.length : null}
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

      <ModuloTabs
        rota="/plano"
        conteudos={{
          prioridade: (
            <FaixaDeAchados
              achados={criticos}
              carregando={plano.isLoading}
              erro={plano.isError}
              intro="Achados a partir do dobro do limiar da própria regra. É por onde começar, e a ordem aqui é a ordem de ataque."
              vazio="Nenhum achado em risco alto no momento. É a única faixa em que o vazio é boa notícia."
            />
          ),
          atencao: (
            <FaixaDeAchados
              achados={atencao}
              carregando={plano.isLoading}
              erro={plano.isError}
              intro="Acima do limiar, mas sem a folga da faixa anterior. Vale acompanhar antes de virar risco alto."
              vazio="Nada nesta faixa no momento."
            />
          ),
          observacao: (
            <FaixaDeAchados
              achados={observacao}
              carregando={plano.isLoading}
              erro={plano.isError}
              intro="Passaram o limiar por pouco. Com o motor saturado, é aqui que mora a maior parte do ruído — leia como contexto, não como fila de trabalho."
              vazio="Nada nesta faixa no momento."
            />
          ),
          apuracao: (
            <div className="grid gap-10 lg:grid-cols-2 lg:gap-14">
              <section className="max-w-[68ch] space-y-3">
                <h2 className="text-xl font-medium tracking-tight">Como esta lista foi montada</h2>
                <p className="text-muted-foreground text-[15px] leading-relaxed">
                  Cada item sai do motor determinístico da tela de origem — sem modelo de
                  linguagem no caminho. O número da frase é o mesmo que o card daquela tela
                  desenha, porque o calculador chama a mesma consulta com os mesmos argumentos.
                </p>
                <p className="text-muted-foreground text-[15px] leading-relaxed">
                  Ordenar telas diferentes na mesma lista só é legítimo porque o score é múltiplo
                  do limiar da própria regra, e não a magnitude bruta. Sem essa normalização a
                  ordem sairia do acaso da escala.
                </p>
                {saturacao != null && saturacao > 0.8 ? (
                  <p className="text-[15px] leading-relaxed">
                    <strong className="font-medium">
                      O motor está saturado: {formatInt(publicaveis.length)} das{' '}
                      {formatInt(avaliadas)} regras dispararam.
                    </strong>{' '}
                    <span className="text-muted-foreground">
                      Um catálogo calibrado para achar quase sempre rankeia bem e filtra mal —
                      então a <em>ordem</em> vale mais que a presença de um item na lista.
                      Recalibrar os limiares é decisão em aberto, e enquanto isso ela fica
                      declarada aqui em vez de passar por completude.
                    </span>
                  </p>
                ) : null}
              </section>

              <section className="max-w-[68ch] space-y-6 text-sm">
                {suprimidos.length > 0 ? (
                  <div className="space-y-2">
                    <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                      {formatInt(suprimidos.length)} suprimido(s), com o motivo
                    </h3>
                    <ul className="text-muted-foreground space-y-1.5 leading-relaxed">
                      {suprimidos.map((a) => (
                        <li key={`${a.tela}-${a.regra}`}>
                          <span className="text-foreground">{a.titulo}</span> —{' '}
                          {a.motivo ?? 'sem amostra suficiente'} (
                          {moduloDaTela(a.tela)?.title ?? a.tela})
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div className="space-y-2">
                  <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                    O que este plano não faz
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Ele relata; não gere. Não há dono, prazo nem status por achado, e nenhum item
                    promete efeito atribuível — não existe experimentação em nenhuma das fontes,
                    então &quot;fizemos isto e melhorou&quot; não seria uma afirmação que este BI
                    consegue sustentar.
                  </p>
                </div>
              </section>
            </div>
          ),
        }}
      />
    </div>
  )
}
