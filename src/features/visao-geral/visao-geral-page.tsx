import { useMemo, useState } from 'react'
import {
  ActivityIcon,
  ClockIcon,
  DatabaseIcon,
  HandshakeIcon,
  LayersIcon,
  LineChartIcon,
  MousePointerClickIcon,
  RadarIcon,
  SproutIcon,
  UsersIcon,
} from 'lucide-react'
import { BentoItem } from '@/components/layout/bento'
import { CabecalhoDeModulo } from '@/components/layout/cabecalho-de-modulo'
import { ModuloTabs } from '@/components/layout/modulo-tabs'
import { SecaoDeAnalise } from '@/components/layout/secao-de-analise'
import { TabelaCard } from '@/components/tabela/tabela-card'
import { TabelaLonga } from '@/components/tabela/tabela-longa'

import {
  CategoryBarChart,
  ChartCard,
  HeatmapChart,
  KpiCard,
  KpiGrid,
  TimeSeriesChart,
} from '@/components/charts'
import { StatusPill } from '@/components/ui-marca/status-pill'
import { TableCell, TableHead, TableRow } from '@/components/ui/table'
import { deltaOuNada } from '@/lib/delta'
import { formatCompact, formatDateShort, formatInt, formatPercent } from '@/lib/format'
import { labelTipoEvento } from '@/lib/labels-plataforma'
import { PeriodoFiltro } from '@/components/filters/periodo-filtro'
import type { Periodo } from '@/lib/periodo'
import { SegmentoFiltro } from '@/components/filters/segmento-filtro'
import { useSegmento } from '@/components/filters/use-segmento'
import { AnaliseDaTela } from '@/features/resumo/analise-tela'
import {
  useAcoesPorModulo,
  useAtividadeDiaria,
  useComposicaoCrescimento,
  useHeatmapNavegacao,
  useKpis,
  useSaudeRastreio,
} from '@/features/visao-geral/queries'

export function VisaoGeralPage() {
  const [periodo, setPeriodo] = useState<Periodo>(30)
  const { papel, plano } = useSegmento()
  const recorte = { papel, plano }

  const kpis = useKpis(periodo, recorte)
  const atividade = useAtividadeDiaria(periodo, recorte)
  const heatmap = useHeatmapNavegacao(periodo, recorte)
  const composicao = useComposicaoCrescimento(periodo, recorte)
  const porModulo = useAcoesPorModulo(periodo, recorte)
  const rastreio = useSaudeRastreio()

  // Cada headline responde a pergunta do próprio card e sai do dado que ele já
  // desenha. Nenhum vira percentual sobre o top-N: bi_top_telas corta em dez,
  // e uma fatia sobre denominador cortado é número falso com cara de certo.
  const mediaDiaria = useMemo(() => {
    const dias = atividade.data ?? []
    if (dias.length === 0) return null
    return Math.round(dias.reduce((soma, d) => soma + d.ativos, 0) / dias.length)
  }, [atividade.data])

  // Todos os percentuais desta tela saem de um denominador que a própria RPC
  // devolve — nunca de uma soma montada aqui, que escaparia da supressão.
  const penetracao =
    kpis.data && kpis.data.base > 0 ? kpis.data.ativos / kpis.data.base : null

  const parteNovos =
    (composicao.data ?? []).find((c) => c.categoria === 'Novo')?.pct ?? null

  const moduloLider = porModulo.data?.[0] ?? null

  // A média da plataforma vem repetida em toda linha, calculada e suprimida no
  // banco — somar aqui escaparia da régua de amostra.
  const parteCompromisso = porModulo.data?.[0]?.pct_compromisso_geral ?? null

  const rastreiosParados = (rastreio.data ?? []).filter((r) => r.status === 'parado').length

  const picoNavegacao = useMemo(
    () => (heatmap.data ?? []).reduce((maior, h) => Math.max(maior, h.pageviews), 0),
    [heatmap.data],
  )

  const vsPeriodo = 'vs período anterior'

  return (
    <div className="space-y-4">
      {/* Título, régua e controles saem de `nav-items.ts` — a página não
          reescreve a própria régua. O frescor do dado anda junto dos controles. */}
      <CabecalhoDeModulo
        controles={
          <>
            <SegmentoFiltro />
            <PeriodoFiltro valor={periodo} onChange={setPeriodo} />
          </>
        }
      />

      {/* Fora das abas: contexto das duas. Trocar entre a leitura e os gráficos
          não pode custar o número de referência nem o recorte. */}
      <div id="card-kpis">
        <KpiGrid>
          <KpiCard
            label="Usuários ativos"
            value={kpis.data?.ativos ?? null}
            format={formatInt}
            delta={
              kpis.data ? deltaOuNada(kpis.data.ativos, kpis.data.ativos_ant, vsPeriodo) : undefined
            }
            isLoading={kpis.isLoading}
            isError={kpis.isError}
          />
          <KpiCard
            label="Novos clientes"
            value={kpis.data?.novos ?? null}
            format={formatInt}
            delta={
              kpis.data ? deltaOuNada(kpis.data.novos, kpis.data.novos_ant, vsPeriodo) : undefined
            }
            isLoading={kpis.isLoading}
            isError={kpis.isError}
          />
          <KpiCard
            label="Aulas concluídas"
            value={kpis.data?.aulas ?? null}
            format={formatInt}
            delta={
              kpis.data ? deltaOuNada(kpis.data.aulas, kpis.data.aulas_ant, vsPeriodo) : undefined
            }
            isLoading={kpis.isLoading}
            isError={kpis.isError}
          />
          <KpiCard
            label="Pageviews"
            value={kpis.data?.pageviews ?? null}
            format={formatCompact}
            delta={
              kpis.data
                ? deltaOuNada(kpis.data.pageviews, kpis.data.pageviews_ant, vsPeriodo)
                : undefined
            }
            isLoading={kpis.isLoading}
            isError={kpis.isError}
          />
        </KpiGrid>
      </div>

      <ModuloTabs
        rota="/"
        conteudos={{
          analise: <AnaliseDaTela tela="visao-geral" periodo={periodo} recorte={recorte} />,
          graficos: (
            <div className="space-y-4">
              <SecaoDeAnalise
                titulo="Quantos clientes aparecem, e de onde eles vêm"
                icone={LineChartIcon}
                descricao="Os três cortes contam a mesma coisa — cliente com ao menos uma ação de produto — e mudam só o denominador: o dia, a base pagante inteira, ou a origem de cada ativo."
              >
                <BentoItem span={12}>
                  <ChartCard
                    nivel="descritivo"
                    id="card-atividade"
                    icon={ActivityIcon}
                    title="Usuários ativos por dia"
                    headline={mediaDiaria != null ? formatInt(mediaDiaria) : '—'}
                    headlineLabel="na média do dia"
                    description={`Clientes com ao menos uma ação de produto no dia · últimos ${periodo} dias`}
                    isLoading={atividade.isLoading}
                    isError={atividade.isError}
                    onRetry={() => void atividade.refetch()}
                    isEmpty={atividade.data?.length === 0}
                    isRefreshing={atividade.isFetching && !!atividade.data}
                  >
                    <TimeSeriesChart
                      variant="area"
                      data={(atividade.data ?? []).map((d) => ({ x: d.data, ativos: d.ativos }))}
                      series={[{ dataKey: 'ativos', label: 'Usuários ativos' }]}
                      xTickFormatter={formatDateShort}
                      valueFormatter={formatInt}
                      className="h-[280px]"
                    />
                  </ChartCard>
                </BentoItem>

                <BentoItem span={6}>
                  <ChartCard
                    nivel="comparativo"
                    icon={UsersIcon}
                    title="Quem apareceu, e quem não"
                    headline={penetracao != null ? formatPercent(penetracao) : '—'}
                    headlineLabel="da base pagante teve alguma ação"
                    description={`Clientes com ao menos uma ação no período, contra a base pagante inteira · últimos ${periodo} dias`}
                    isLoading={kpis.isLoading}
                    isError={kpis.isError}
                    isEmpty={kpis.data == null}
                  >
                    <CategoryBarChart
                      layout="bar"
                      label="Clientes"
                      data={
                        kpis.data
                          ? [
                              { category: 'Apareceram', value: kpis.data.ativos },
                              {
                                category: 'Não apareceram',
                                value: kpis.data.base - kpis.data.ativos,
                                mute: true,
                              },
                            ]
                          : []
                      }
                      valueFormatter={formatInt}
                      className="h-[200px]"
                    />
                  </ChartCard>
                </BentoItem>

                <BentoItem span={6}>
                  <ChartCard
                    nivel="diagnostico"
                    id="card-composicao"
                    icon={SproutIcon}
                    title="De onde veio o número de ativos"
                    headline={parteNovos != null ? formatPercent(parteNovos) : '—'}
                    headlineLabel="dos ativos entraram no próprio período"
                    description={`Cada cliente ativo entra em uma origem só: retido (ativo também na janela anterior), reativado (voltou depois de sumir) ou novo (primeira ação no período) · últimos ${periodo} dias`}
                    isLoading={composicao.isLoading}
                    isError={composicao.isError}
                    onRetry={() => void composicao.refetch()}
                    isEmpty={composicao.data?.length === 0}
                    isRefreshing={composicao.isFetching && !!composicao.data}
                  >
                    <CategoryBarChart
                      layout="bar"
                      label="Clientes"
                      data={(composicao.data ?? []).map((c) => ({
                        category: c.categoria,
                        value: c.clientes,
                        mute: c.categoria !== 'Novo',
                      }))}
                      valueFormatter={formatInt}
                      className="h-[200px]"
                    />
                  </ChartCard>
                </BentoItem>
              </SecaoDeAnalise>

              <SecaoDeAnalise
                titulo="O que eles fazem quando aparecem"
                icone={LayersIcon}
                descricao="Os dois primeiros cards contam ação de produto (evento); o mapa de horário conta pageview, que é outra fonte e só existe desde 03/07/2026 — pico de navegação e volume de ações não se comparam."
              >
                <BentoItem span={6}>
                  <ChartCard
                    nivel="comparativo"
                    id="card-eventos"
                    icon={MousePointerClickIcon}
                    title="Ações por módulo"
                    headline={moduloLider ? formatCompact(moduloLider.total) : '—'}
                    headlineLabel={moduloLider ? `em ${moduloLider.modulo}` : undefined}
                    description={`Todas as ações de produto do período, agrupadas por módulo · últimos ${periodo} dias`}
                    isLoading={porModulo.isLoading}
                    isError={porModulo.isError}
                    onRetry={() => void porModulo.refetch()}
                    isEmpty={porModulo.data?.length === 0}
                    isRefreshing={porModulo.isFetching && !!porModulo.data}
                  >
                    <CategoryBarChart
                      layout="bar"
                      label="Ações"
                      data={(porModulo.data ?? []).map((m) => ({
                        category: m.modulo,
                        value: m.total,
                      }))}
                      valueFormatter={formatCompact}
                      className="h-[200px]"
                    />
                  </ChartCard>
                </BentoItem>

                <BentoItem span={6}>
                  <ChartCard
                    nivel="diagnostico"
                    id="card-compromisso"
                    icon={HandshakeIcon}
                    title="O uso é raso ou profundo?"
                    headline={parteCompromisso != null ? formatPercent(parteCompromisso) : '—'}
                    headlineLabel="das ações são compromisso, não consumo"
                    description="Consumo é olhar; compromisso é produzir, concluir ou agendar · atenção: a plataforma emite hoje um único evento de consumo (visualizar solução), então módulo em 100% quer dizer que o olhar não é rastreado ali, não que todo uso seja profundo"
                    isLoading={porModulo.isLoading}
                    isError={porModulo.isError}
                    onRetry={() => void porModulo.refetch()}
                    isEmpty={porModulo.data?.length === 0}
                    isRefreshing={porModulo.isFetching && !!porModulo.data}
                  >
                    <CategoryBarChart
                      layout="bar"
                      label="Compromisso"
                      data={(porModulo.data ?? [])
                        .filter((m) => m.pct_compromisso != null)
                        .map((m) => ({
                          category: m.modulo,
                          value: m.pct_compromisso,
                        }))}
                      valueFormatter={formatPercent}
                      referencias={
                        parteCompromisso != null
                          ? [{ valor: parteCompromisso, rotulo: 'média da plataforma' }]
                          : []
                      }
                      className="h-[240px]"
                    />
                  </ChartCard>
                </BentoItem>

                <BentoItem span={12}>
                  <ChartCard
                    nivel="descritivo"
                    icon={ClockIcon}
                    title="Picos de navegação"
                    headline={formatInt(picoNavegacao)}
                    headlineLabel="pageviews na hora de pico"
                    description={`Pageviews por dia da semana × hora (Brasília) · últimos ${periodo} dias`}
                    isLoading={heatmap.isLoading}
                    isError={heatmap.isError}
                    onRetry={() => void heatmap.refetch()}
                    isEmpty={heatmap.data?.length === 0}
                    isRefreshing={heatmap.isFetching && !!heatmap.data}
                    contentClassName="min-h-0"
                  >
                    <HeatmapChart
                      label="pageviews"
                      data={(heatmap.data ?? []).map((h) => ({
                        dia: h.dia_semana,
                        hora: h.hora,
                        valor: h.pageviews,
                      }))}
                      valueFormatter={formatInt}
                    />
                  </ChartCard>
                </BentoItem>
              </SecaoDeAnalise>

              <SecaoDeAnalise
                titulo="Dá para confiar no que está sendo medido"
                icone={DatabaseIcon}
                descricao="Instrumentação, não comportamento. É a única leitura da tela fora da régua de cliente: filtrar admin e teste esconderia justamente o rastreio quebrado que só o uso interno alcança."
              >
                <BentoItem span={12}>
                  <TabelaCard
                    nivel="prescritivo"
                    id="card-rastreio"
                    icon={RadarIcon}
                    title="Saúde do rastreio"
                    headline={formatInt(rastreiosParados)}
                    headlineLabel="rastreios parados há mais de 30 dias"
                    description="Última data com registro por tipo de evento, contada a partir do dia do dado e não de hoje · série que atravessa a data de óbito de um evento lê queda de comportamento onde houve queda de instrumentação"
                    isLoading={rastreio.isLoading}
                    isError={rastreio.isError}
                    onRetry={() => void rastreio.refetch()}
                    linhasEsqueleto={5}
                  >
                    <TabelaLonga
                      linhas={rastreio.data ?? []}
                      chave={(r) => r.tipo}
                      buscarEm={(r) => [labelTipoEvento(r.tipo), r.modulo]}
                      rotuloBusca="Buscar evento ou módulo"
                      cabecalho={
                        <TableRow>
                          <TableHead>Evento</TableHead>
                          <TableHead>Módulo</TableHead>
                          <TableHead className="text-right">Último registro</TableHead>
                          <TableHead className="text-right">Dias parado</TableHead>
                          <TableHead>Estado</TableHead>
                        </TableRow>
                      }
                      renderLinha={(r) => (
                        <TableRow>
                          <TableCell className="font-medium">{labelTipoEvento(r.tipo)}</TableCell>
                          <TableCell className="text-muted-foreground">{r.modulo}</TableCell>
                          <TableCell className="num text-right">
                            {formatDateShort(r.ultimo_registro)}
                          </TableCell>
                          <TableCell className="num text-right">
                            {formatInt(r.dias_parado)}
                          </TableCell>
                          <TableCell>
                            <StatusPill
                              tom={
                                r.status === 'parado'
                                  ? 'critico'
                                  : r.status === 'atrasado'
                                    ? 'atencao'
                                    : 'bom'
                              }
                            >
                              {r.status === 'parado'
                                ? 'parado'
                                : r.status === 'atrasado'
                                  ? 'atrasado'
                                  : 'em dia'}
                            </StatusPill>
                          </TableCell>
                        </TableRow>
                      )}
                    />
                  </TabelaCard>
                </BentoItem>
              </SecaoDeAnalise>
            </div>
          ),
        }}
      />
    </div>
  )
}
