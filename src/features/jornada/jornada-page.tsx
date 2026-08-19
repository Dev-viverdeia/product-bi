import { useMemo, useState } from 'react'
import {
  ArrowLeftRightIcon,
  BugIcon,
  DatabaseIcon,
  DoorOpenIcon,
  FootprintsIcon,
  LayersIcon,
  LogOutIcon,
  MonitorIcon,
  RouteIcon,
  ScanSearchIcon,
  TrendingUpIcon,
} from 'lucide-react'
import { BentoItem } from '@/components/layout/bento'
import { CabecalhoDeModulo } from '@/components/layout/cabecalho-de-modulo'
import { ModuloTabs } from '@/components/layout/modulo-tabs'
import { SecaoDeAnalise } from '@/components/layout/secao-de-analise'
import { AbaDeDados } from '@/components/tabela/aba-de-dados'
import { TabelaCard } from '@/components/tabela/tabela-card'
import { TabelaLonga } from '@/components/tabela/tabela-longa'

import { CategoryBarChart, ChartCard, KpiCard, KpiGrid } from '@/components/charts'
import { PeriodoFiltro } from '@/components/filters/periodo-filtro'
import type { Periodo } from '@/lib/periodo'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatDateShort, formatDecimal, formatInt, formatPercent } from '@/lib/format'
import { LIMITE_LISTA } from '@/lib/rpc'
import { AnaliseDaTela } from '@/features/resumo/analise-tela'
import { PlanoDaTela } from '@/features/resumo/plano-da-tela'
import {
  useFluxoDaTela,
  useJornadaKpis,
  usePontosSaida,
  usePortaDeEntrada,
  usePortasEntrada,
  useProfundidadeERetencao,
  useProfundidadeSessao,
  useRaioXTelas,
  useSessoesInfladas,
} from '@/features/jornada/queries'

function tintaPct(pct: number | null, teto = 0.5) {
  if (pct == null) return undefined
  const alfa = Math.min(pct / teto, 1) * 0.45
  return {
    background: `color-mix(in oklab, var(--color-data-1) ${Math.round(alfa * 100)}%, transparent)`,
  }
}

export function JornadaPage() {
  const [periodo, setPeriodo] = useState<Periodo>(30)
  const [telaSelecionada, setTelaSelecionada] = useState('/solucoes')

  const kpis = useJornadaKpis(periodo)
  const raioX = useRaioXTelas(periodo)
  const fluxo = useFluxoDaTela(telaSelecionada, periodo)
  const entradas = usePortasEntrada(periodo)
  const saidas = usePontosSaida(periodo)
  const profundidade = useProfundidadeSessao(periodo)
  const infladas = useSessoesInfladas()
  const porta = usePortaDeEntrada()
  const profundidadeRetencao = useProfundidadeERetencao()

  // Raio-x e fluxo podem vir cortados em LIMITE_LISTA; por isso lidero pela
  // primeira linha (que a ordenação garante) e nunca por um total somado.
  const telaMaisVista = raioX.data?.[0] ?? null
  const destinoLider = fluxo.data?.[0] ?? null
  const portaLider = entradas.data?.[0] ?? null
  // A faixa mais gorda de sessões-monstro é o que o card prescritivo afirma: a
  // fatia minúscula de sessões que carrega uma fatia enorme das telas vistas.
  const sessoesGigantes = useMemo(
    () => (infladas.data ?? []).find((f) => f.ordem === 4) ?? null,
    [infladas.data],
  )
  const linkDireto = useMemo(
    () => (porta.data ?? []).find((p) => p.grupo === 'Por link direto') ?? null,
    [porta.data],
  )
  const portaDaFrente = useMemo(
    () => (porta.data ?? []).find((p) => p.grupo === 'Pela porta da frente') ?? null,
    [porta.data],
  )
  const navegaFundo = useMemo(
    () => (profundidadeRetencao.data ?? []).find((p) => p.grupo.startsWith('Navega fundo')) ?? null,
    [profundidadeRetencao.data],
  )
  const navegaRaso = useMemo(
    () => (profundidadeRetencao.data ?? []).find((p) => p.grupo.startsWith('Navega raso')) ?? null,
    [profundidadeRetencao.data],
  )

  // O card responde "onde a sessão termina com frequência anormal", não "onde
  // termina em volume" — volume segue o tráfego da tela e não distingue a tela
  // que resolve da tela que trava. Por isso a ordem é pela taxa, e é a mesma
  // que o motor de achados usa: as duas leituras vêm das MESMAS dez linhas da
  // RPC (p_limite 10 aqui e no calculador), então o número da análise escrita
  // está sempre desenhado neste gráfico.
  const saidasPorTaxa = useMemo(
    () => [...(saidas.data ?? [])].sort((a, b) => (b.pct_da_tela ?? 0) - (a.pct_da_tela ?? 0)),
    [saidas.data],
  )
  const saidaLider = saidasPorTaxa[0] ?? null

  // Exploração: sessões que passaram de uma tela só.
  //
  // ⚠️ Era calculado aqui, e o pior não era a divisão: a faixa de uma tela era
  // achada por `faixa.startsWith('1')`, que casa "1 tela" E "16+ telas". Só
  // acertava porque o `.find` pega a primeira e a RPC ordena por `ordem` —
  // duas coisas que ninguém prometeu manter. Agora o corte sai do número.
  const exploram = profundidade.data?.[0]?.pct_mais_de_uma_tela ?? null

  return (
    <div className="space-y-4">
      {/* Título, régua e controles saem de `nav-items.ts` — a página não
          reescreve a própria régua. O frescor do dado anda junto dos controles. */}
      <CabecalhoDeModulo controles={<PeriodoFiltro valor={periodo} onChange={setPeriodo} />} />

      {/* Fora das abas: contexto do módulo inteiro. Trocar de aba não pode
          custar o número de referência nem obrigar a reajustar o período. */}
      <KpiGrid>
        <KpiCard
          label="Sessões"
          value={kpis.data?.sessoes ?? null}
          format={formatInt}
          isLoading={kpis.isLoading}
          isError={kpis.isError}
        />
        {/* Média e mediana lado a lado, com o rótulo dizendo qual é qual: a
            distância entre elas É a inflação por sessão-robô que o card das
            sessões-monstro denuncia por escrito. Dois tiles com o mesmo nome e
            números diferentes leriam como defeito. */}
        <KpiCard
          label="Telas por sessão (média)"
          value={kpis.data?.telas_por_sessao ?? null}
          format={formatDecimal}
          isLoading={kpis.isLoading}
          isError={kpis.isError}
        />
        <KpiCard
          label="Telas por sessão (mediana)"
          value={kpis.data?.telas_medianas ?? null}
          format={formatDecimal}
          isLoading={kpis.isLoading}
          isError={kpis.isError}
        />
        <KpiCard
          label="Sessões de tela única"
          value={kpis.data?.pct_uma_tela ?? null}
          format={formatPercent}
          isLoading={kpis.isLoading}
          isError={kpis.isError}
        />
      </KpiGrid>

      <ModuloTabs
        rota="/jornada"
        conteudos={{
          graficos: (
            <div className="space-y-4">
              {/*
                DENSIDADE_DECLARADA: cardsPorSecaoNoMinimo — esta seção tem um
                card só porque o card é META: ele mede quanto da contagem de
                pageview sai de sessão-monstro e, com isso, qualifica de uma vez
                os KPIs do topo, o ranking da seção seguinte e a profundidade da
                última. Não responde à pergunta de nenhuma delas. A fusão que
                parece tentadora é com "Quantas telas o cliente percorre", que
                usa o MESMO eixo (faixa de telas por sessão) — e é por isso que
                seria errada: agruparia por eixo, não por pergunta. A pergunta
                de lá é "quantas telas o cliente percorre"; a daqui é "isto é
                gente?".
              */}
              <SecaoDeAnalise
                titulo="Dá para confiar no ranking de telas"
                icone={DatabaseIcon}
                descricao="Contagem de sessão, não de comportamento — e uma das leituras que ignoram o período do topo: a faixa lê todo o histórico que a purga da plataforma ainda não apagou. O pageview que ela mede é o mesmo que sustenta o ranking abaixo."
              >
                <BentoItem span={12}>
                  <TabelaCard
                    nivel="prescritivo"
                    id="card-sessoes-infladas"
                    icon={BugIcon}
                    title="As sessões que inflam o ranking"
                    headline={
                      sessoesGigantes?.pct_telas != null
                        ? formatPercent(sessoesGigantes.pct_telas)
                        : '—'
                    }
                    headlineLabel={
                      sessoesGigantes
                        ? `das telas vistas saem de ${formatInt(sessoesGigantes.sessoes)} sessões`
                        : undefined
                    }
                    description={
                      sessoesGigantes
                        ? `Sessão de centenas de telas não é hábito de uso — é aba esquecida aberta ou robô · janela: ${formatDateShort(sessoesGigantes.janela_inicio)} a ${formatDateShort(sessoesGigantes.janela_fim)}, todo o histórico que a purga da plataforma ainda não apagou · enquanto essas sessões contarem, o ranking de pageview, as telas por sessão e a duração mediana estão contaminados de uma vez`
                        : 'Sessões por número de telas, em todo o histórico disponível'
                    }
                    isLoading={infladas.isLoading}
                    isRefreshing={infladas.isFetching && !!infladas.data}
                    isError={infladas.isError}
                    onRetry={() => void infladas.refetch()}
                    linhasEsqueleto={4}
                  >
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tamanho da sessão</TableHead>
                          <TableHead className="text-right">Sessões</TableHead>
                          <TableHead className="text-right">% das sessões</TableHead>
                          <TableHead className="text-right">Telas vistas</TableHead>
                          <TableHead className="text-right">% das telas</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(infladas.data ?? []).map((f) => (
                          <TableRow key={f.faixa}>
                            <TableCell className="font-medium">{f.faixa}</TableCell>
                            <TableCell className="num text-right">{formatInt(f.sessoes)}</TableCell>
                            <TableCell className="num text-right">
                              {f.pct_sessoes != null ? formatPercent(f.pct_sessoes) : '—'}
                            </TableCell>
                            <TableCell className="num text-right">{formatInt(f.telas)}</TableCell>
                            <TableCell
                              className="num text-right font-medium"
                              style={tintaPct(f.pct_telas)}
                            >
                              {f.pct_telas != null ? formatPercent(f.pct_telas) : '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TabelaCard>
                </BentoItem>
              </SecaoDeAnalise>

              <SecaoDeAnalise
                titulo="Que telas concentram a navegação, e para onde ela segue"
                icone={MonitorIcon}
                descricao="As duas leituras saem do mesmo pageview do período: o raio-x mede cada tela contra o próprio tráfego; o fluxo, o par origem → destino da tela escolhida no seletor do card."
              >
                <BentoItem span={12}>
                  <TabelaCard
                    nivel="descritivo"
                    id="card-raio-x"
                    icon={ScanSearchIcon}
                    title="Raio-x das telas"
                    headline={telaMaisVista ? formatInt(telaMaisVista.pageviews) : '—'}
                    headlineLabel={
                      telaMaisVista ? `pageviews na líder (${telaMaisVista.tela})` : undefined
                    }
                    description="% entrada = a tela abriu a sessão (deep link ou destino habitual) · % saída = a sessão terminou nela · posição média = em que ponto da navegação ela aparece"
                    isLoading={raioX.isLoading}
                    isRefreshing={raioX.isFetching && !!raioX.data}
                    isError={raioX.isError}
                    onRetry={() => void raioX.refetch()}
                  >
                    <TabelaLonga
                      linhas={raioX.data ?? []}
                      limiteDaFonte={LIMITE_LISTA}
                      chave={(t) => String(t.tela)}
                      buscarEm={(t) => [t.tela]}
                      rotuloBusca="Buscar por tela"
                      cabecalho={
                        <TableRow>
                          <TableHead>Tela</TableHead>
                          <TableHead className="text-right">Pageviews</TableHead>
                          <TableHead className="text-right">Usuários</TableHead>
                          <TableHead className="text-right">% entrada</TableHead>
                          <TableHead className="text-right">% saída</TableHead>
                          <TableHead className="text-right">Posição média</TableHead>
                        </TableRow>
                      }
                      renderLinha={(t) => (
                        <TableRow>
                          <TableCell className="font-mono text-xs">{t.tela}</TableCell>
                          <TableCell className="num text-right">{formatInt(t.pageviews)}</TableCell>
                          <TableCell className="num text-right">{formatInt(t.usuarios)}</TableCell>
                          <TableCell
                            className="num text-right"
                            style={tintaPct(t.pct_entrada, 0.25)}
                          >
                            {t.pct_entrada != null ? formatPercent(t.pct_entrada) : '—'}
                          </TableCell>
                          <TableCell className="num text-right" style={tintaPct(t.pct_saida, 0.3)}>
                            {t.pct_saida != null ? formatPercent(t.pct_saida) : '—'}
                          </TableCell>
                          <TableCell className="num text-right">
                            {t.posicao_media != null ? formatDecimal(t.posicao_media) : '—'}
                          </TableCell>
                        </TableRow>
                      )}
                    />
                  </TabelaCard>
                </BentoItem>

                <BentoItem span={12}>
                  <TabelaCard
                    nivel="diagnostico"
                    icon={ArrowLeftRightIcon}
                    title="Para onde vão a partir de uma tela"
                    headline={destinoLider?.pct != null ? formatPercent(destinoLider.pct) : '—'}
                    headlineLabel={destinoLider ? `vão para ${destinoLider.destino}` : undefined}
                    /* o seletor ocupa a afordância à direita: aqui a escolha da tela
                       é a ação do card, mais útil que o botão de definição */
                    action={
                      <Select value={telaSelecionada} onValueChange={setTelaSelecionada}>
                        <SelectTrigger className="w-full sm:w-64">
                          <SelectValue placeholder="Escolha uma tela" />
                        </SelectTrigger>
                        <SelectContent>
                          {(raioX.data ?? []).map((t) => (
                            <SelectItem key={t.tela} value={t.tela}>
                              {t.tela}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    }
                    isLoading={fluxo.isLoading}
                    isRefreshing={fluxo.isFetching && !!fluxo.data}
                    isError={fluxo.isError}
                    onRetry={() => void fluxo.refetch()}
                  >
                    <TabelaLonga
                      linhas={fluxo.data ?? []}
                      chave={(f) => f.destino}
                      buscarEm={(f) => [f.destino]}
                      rotuloBusca="Buscar destino"
                      // `bi_fluxo_da_tela` tem `limit 10` chumbado no SQL e a
                      // chamada não passa teto nenhum — o corte só existia na
                      // prosa da seção, que a régua de densidade manda encurtar.
                      // A TabelaLonga é mais honesta que a prosa era: ela só
                      // anuncia quando a lista de fato bate no teto.
                      limiteDaFonte={10}
                      vazio="Nenhuma transição registrada a partir desta tela."
                      cabecalho={
                        <TableRow>
                          <TableHead>Destino</TableHead>
                          <TableHead className="text-right">Transições</TableHead>
                          <TableHead className="text-right">% do total</TableHead>
                        </TableRow>
                      }
                      renderLinha={(f) => (
                        <TableRow>
                          <TableCell className="font-mono text-xs">{f.destino}</TableCell>
                          <TableCell className="num text-right">
                            {formatInt(f.transicoes)}
                          </TableCell>
                          <TableCell className="num text-right" style={tintaPct(f.pct)}>
                            {f.pct != null ? formatPercent(f.pct) : '—'}
                          </TableCell>
                        </TableRow>
                      )}
                    />
                  </TabelaCard>
                </BentoItem>
              </SecaoDeAnalise>

              <SecaoDeAnalise
                titulo="Por onde a sessão começa e onde ela termina"
                icone={RouteIcon}
                descricao="As duas pontas da mesma sessão, em unidades diferentes: volume e taxa não ordenam igual, e quem lidera um lado raramente lidera o outro. Ambos cortados nas dez primeiras linhas — nenhum percentual daqui se soma como se fosse o total."
              >
                <BentoItem span={6}>
                  <ChartCard
                    nivel="descritivo"
                    id="card-portas-entrada"
                    icon={DoorOpenIcon}
                    title="Portas de entrada"
                    headline={portaLider ? formatInt(portaLider.sessoes) : '—'}
                    headlineLabel={portaLider ? `sessões abrem em ${portaLider.tela}` : undefined}
                    description="Primeira tela da sessão — por onde o cliente realmente chega"
                    isLoading={entradas.isLoading}
                    isRefreshing={entradas.isFetching && !!entradas.data}
                    isError={entradas.isError}
                    onRetry={() => void entradas.refetch()}
                    isEmpty={entradas.data?.length === 0}
                  >
                    <CategoryBarChart
                      layout="bar"
                      label="Sessões"
                      data={(entradas.data ?? []).map((e) => ({
                        category: e.tela,
                        value: e.sessoes,
                      }))}
                      valueFormatter={formatInt}
                      className="h-[320px]"
                    />
                  </ChartCard>
                </BentoItem>

                <BentoItem span={6}>
                  <ChartCard
                    nivel="diagnostico"
                    id="card-pontos-saida"
                    icon={LogOutIcon}
                    title="Onde a sessão morre"
                    headline={
                      saidaLider?.pct_da_tela != null ? formatPercent(saidaLider.pct_da_tela) : '—'
                    }
                    headlineLabel={
                      saidaLider ? `das visitas a ${saidaLider.tela} terminam ali` : undefined
                    }
                    description="Taxa de encerramento da própria tela · sessões com 2+ telas, telas com 100+ encerramentos — régua diferente da coluna % saída do raio-x, que conta todas as sessões"
                    isLoading={saidas.isLoading}
                    isRefreshing={saidas.isFetching && !!saidas.data}
                    isError={saidas.isError}
                    onRetry={() => void saidas.refetch()}
                    isEmpty={saidas.data?.length === 0}
                  >
                    <CategoryBarChart
                      layout="bar"
                      label="Encerram a sessão"
                      data={saidasPorTaxa.map((s) => ({
                        category: s.tela,
                        // `bi_pontos_saida` tem `having count(*) >= 100`: o
                        // denominador nunca é zero, então a taxa nunca falta.
                        value: s.pct_da_tela,
                        nota: `${formatInt(s.saidas)} sessões terminadas`,
                      }))}
                      valueFormatter={formatPercent}
                      className="h-[320px]"
                    />
                  </ChartCard>
                </BentoItem>
              </SecaoDeAnalise>

              <SecaoDeAnalise
                titulo="Quantas telas o cliente percorre, e o que isso prediz"
                icone={FootprintsIcon}
                descricao="Os três medem profundidade de navegação, mas só a distribuição responde ao período do topo — os dois recortes comparativos leem janelas fixas do histórico. Taxa de um card contra taxa de outro é comparação entre populações diferentes."
              >
                <BentoItem span={12}>
                  <ChartCard
                    tone="brand"
                    nivel="descritivo"
                    icon={LayersIcon}
                    title="Profundidade das sessões"
                    headline={exploram != null ? formatPercent(exploram) : '—'}
                    headlineLabel="das sessões passam de uma tela"
                    description="Quantas telas o cliente visita por sessão — mede exploração vs visita pontual"
                    isLoading={profundidade.isLoading}
                    isRefreshing={profundidade.isFetching && !!profundidade.data}
                    isError={profundidade.isError}
                    onRetry={() => void profundidade.refetch()}
                    isEmpty={profundidade.data?.length === 0}
                  >
                    <CategoryBarChart
                      label="Sessões"
                      data={(profundidade.data ?? []).map((p) => ({
                        category: p.faixa,
                        value: p.sessoes,
                      }))}
                      valueFormatter={formatInt}
                      className="h-[260px]"
                    />
                  </ChartCard>
                </BentoItem>

                <BentoItem span={6}>
                  <TabelaCard
                    nivel="comparativo"
                    id="card-porta-de-entrada"
                    icon={ArrowLeftRightIcon}
                    title="Quem chega por link direto não navega"
                    headline={
                      linkDireto?.pct_tela_unica != null
                        ? formatPercent(linkDireto.pct_tela_unica)
                        : '—'
                    }
                    headlineLabel={
                      portaDaFrente?.pct_tela_unica != null
                        ? `terminam na 1ª tela, contra ${formatPercent(portaDaFrente.pct_tela_unica)} de quem entra pela porta da frente`
                        : 'das sessões por link direto terminam na 1ª tela'
                    }
                    description={
                      linkDireto
                        ? `Porta da frente = a sessão abriu em /, /login ou /convite · margem de ${formatDecimal(linkDireto.margem_pp)} pp · sessão de tela única vinda de link direto também descreve quem veio ver uma coisa específica e viu — o card não separa isso de quem desistiu`
                        : 'Porta da frente = a sessão abriu em /, /login ou /convite'
                    }
                    isLoading={porta.isLoading}
                    isRefreshing={porta.isFetching && !!porta.data}
                    isError={porta.isError}
                    onRetry={() => void porta.refetch()}
                    linhasEsqueleto={2}
                  >
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Como a sessão começou</TableHead>
                          <TableHead className="text-right">Sessões</TableHead>
                          <TableHead className="text-right">Terminam na 1ª</TableHead>
                          <TableHead className="text-right">Telas (mediana)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(porta.data ?? []).map((p) => (
                          <TableRow key={p.grupo}>
                            <TableCell className="font-medium">{p.grupo}</TableCell>
                            <TableCell className="num text-right">{formatInt(p.sessoes)}</TableCell>
                            <TableCell
                              className="num text-right font-medium"
                              style={tintaPct(p.pct_tela_unica)}
                            >
                              {p.pct_tela_unica != null ? formatPercent(p.pct_tela_unica) : '—'}
                            </TableCell>
                            <TableCell className="num text-right">
                              {formatDecimal(p.mediana_telas)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TabelaCard>
                </BentoItem>

                <BentoItem span={6}>
                  <TabelaCard
                    nivel="comparativo"
                    id="card-profundidade-retencao"
                    icon={TrendingUpIcon}
                    title="Navegar fundo prediz seguir ativo"
                    headline={
                      navegaFundo?.pct_ativo != null ? formatPercent(navegaFundo.pct_ativo) : '—'
                    }
                    headlineLabel={
                      navegaRaso?.pct_ativo != null
                        ? `seguem ativos, contra ${formatPercent(navegaRaso.pct_ativo)} de quem navegou raso`
                        : 'de quem navegou fundo segue ativo'
                    }
                    description={
                      navegaFundo
                        ? `Navegação medida de ${formatDateShort(navegaFundo.janela_inicio)} a ${formatDateShort(navegaFundo.janela_fim)}; atividade medida nos 30 dias até o último dia com dado — janelas disjuntas de propósito, para o comportamento não ser lido depois do resultado · margem de ${formatDecimal(navegaFundo.margem_pp)} pp · associação, não causa: navegar fundo também descreve quem já chegou engajado`
                        : 'Navegação na primeira semana registrada; atividade nos últimos 30 dias com dado'
                    }
                    isLoading={profundidadeRetencao.isLoading}
                    isRefreshing={profundidadeRetencao.isFetching && !!profundidadeRetencao.data}
                    isError={profundidadeRetencao.isError}
                    onRetry={() => void profundidadeRetencao.refetch()}
                    linhasEsqueleto={2}
                  >
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Como navegou na 1ª semana</TableHead>
                          <TableHead className="text-right">Clientes</TableHead>
                          <TableHead className="text-right">Ativos hoje</TableHead>
                          <TableHead className="text-right">Taxa</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(profundidadeRetencao.data ?? []).map((p) => (
                          <TableRow key={p.grupo}>
                            <TableCell className="font-medium">{p.grupo}</TableCell>
                            <TableCell className="num text-right">
                              {formatInt(p.clientes)}
                            </TableCell>
                            <TableCell className="num text-right">{formatInt(p.ativos)}</TableCell>
                            <TableCell className="num text-right font-medium">
                              {p.pct_ativo != null ? formatPercent(p.pct_ativo) : '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TabelaCard>
                </BentoItem>
              </SecaoDeAnalise>

              {/* As linhas cruas fecham a aba do dado: as MESMAS queries que os
                  cards acima desenham, passadas já resolvidas. Nenhuma consulta
                  nova — se a lista refizesse a leitura, ela poderia divergir do
                  gráfico logo acima. */}
              <AbaDeDados
                fontes={[
                  {
                    rpc: 'bi_jornada_kpis',
                    titulo: 'Os quatro KPIs do topo da tela',
                    descricao:
                      'uma linha só · média e mediana de telas por sessão vêm juntas, e a distância entre elas é a inflação que as sessões-monstro causam',
                    linhas: kpis.data ? [kpis.data] : [],
                    isLoading: kpis.isLoading,
                    isError: kpis.isError,
                    onRetry: () => void kpis.refetch(),
                  },
                  {
                    rpc: 'bi_jornada_sessoes_infladas',
                    titulo: 'Quantas telas cabem numa sessão, e quanto do total elas carregam',
                    descricao:
                      'ignora o período do topo — lê todo o histórico que a purga da plataforma ainda não apagou, e a janela vem nas colunas janela_inicio/janela_fim',
                    linhas: infladas.data,
                    isLoading: infladas.isLoading,
                    isError: infladas.isError,
                    onRetry: () => void infladas.refetch(),
                  },
                  {
                    rpc: 'bi_raio_x_telas',
                    titulo: 'Cada tela medida contra o tráfego dela própria',
                    descricao:
                      'pct_saida conta todas as sessões, régua diferente da taxa de encerramento de bi_pontos_saida · rotas com identificador chegam agrupadas em padrão',
                    linhas: raioX.data,
                    isLoading: raioX.isLoading,
                    isError: raioX.isError,
                    onRetry: () => void raioX.refetch(),
                    limite: LIMITE_LISTA,
                  },
                  {
                    rpc: 'bi_fluxo_da_tela',
                    titulo: 'Para onde a navegação segue a partir da tela escolhida',
                    descricao: `origem → destino da tela selecionada no card (${telaSelecionada})`,
                    linhas: fluxo.data,
                    isLoading: fluxo.isLoading,
                    isError: fluxo.isError,
                    onRetry: () => void fluxo.refetch(),
                  },
                  {
                    rpc: 'bi_portas_entrada',
                    titulo: 'Em que tela a sessão abre',
                    descricao: 'conta sessões abertas, não visitas',
                    linhas: entradas.data,
                    isLoading: entradas.isLoading,
                    isError: entradas.isError,
                    onRetry: () => void entradas.refetch(),
                    limite: 10,
                  },
                  {
                    rpc: 'bi_pontos_saida',
                    titulo: 'Em que tela a sessão termina com frequência anormal',
                    descricao:
                      'taxa, não volume · sessões com 2+ telas e telas com 100+ encerramentos · vem cortada em dez linhas, então pct_da_tela não se soma como se fosse o total',
                    linhas: saidas.data,
                    isLoading: saidas.isLoading,
                    isError: saidas.isError,
                    onRetry: () => void saidas.refetch(),
                    limite: 10,
                  },
                  {
                    rpc: 'bi_profundidade_sessao',
                    titulo: 'Quantas telas o cliente percorre por sessão',
                    linhas: profundidade.data,
                    isLoading: profundidade.isLoading,
                    isError: profundidade.isError,
                    onRetry: () => void profundidade.refetch(),
                  },
                  {
                    rpc: 'bi_jornada_porta_de_entrada',
                    titulo: 'Quem chega por link direto navega menos que quem entra pela home',
                    descricao:
                      'janela fixa do histórico de navegação, fora do período do topo · margem_pp é a margem do contraste entre os dois grupos',
                    linhas: porta.data,
                    isLoading: porta.isLoading,
                    isError: porta.isError,
                    onRetry: () => void porta.refetch(),
                  },
                  {
                    rpc: 'bi_jornada_profundidade_e_retencao',
                    titulo: 'Navegar fundo na 1ª semana prediz seguir ativo',
                    descricao:
                      'janelas disjuntas de propósito — navegação na primeira semana, atividade nos 30 dias até o último dia com dado · associação, não causa',
                    linhas: profundidadeRetencao.data,
                    isLoading: profundidadeRetencao.isLoading,
                    isError: profundidadeRetencao.isError,
                    onRetry: () => void profundidadeRetencao.refetch(),
                  },
                ]}
              />
            </div>
          ),
          analise: <AnaliseDaTela tela="jornada" periodo={periodo} />,
          plano: <PlanoDaTela tela="jornada" periodo={periodo} />,
        }}
      />
    </div>
  )
}
