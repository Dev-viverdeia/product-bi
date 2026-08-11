import { useMemo, useState } from 'react'
import { ActivityIcon, ClockIcon, MonitorIcon, MousePointerClickIcon } from 'lucide-react'
import { BentoGrid, BentoItem } from '@/components/layout/bento'

import {
  CategoryBarChart,
  ChartCard,
  HeatmapChart,
  KpiCard,
  KpiGrid,
  TimeSeriesChart,
} from '@/components/charts'
import { deltaOuNada } from '@/lib/delta'
import { formatCompact, formatDateShort, formatInt } from '@/lib/format'
import { labelRota, labelTipoEvento } from '@/lib/labels-plataforma'
import { PeriodoFiltro, type Periodo } from '@/components/filters/periodo-filtro'
import {
  useAtividadeDiaria,
  useEventosPorTipo,
  useHeatmapNavegacao,
  useKpis,
  useTopTelas,
  useUltimaSincronizacao,
} from '@/features/visao-geral/queries'

export function VisaoGeralPage() {
  const [periodo, setPeriodo] = useState<Periodo>(30)

  const kpis = useKpis(periodo)
  const atividade = useAtividadeDiaria(periodo)
  const heatmap = useHeatmapNavegacao(periodo)
  const eventos = useEventosPorTipo(periodo)
  const telas = useTopTelas(periodo)
  const sync = useUltimaSincronizacao()

  // Cada headline responde a pergunta do próprio card e sai do dado que ele já
  // desenha. Nenhum vira percentual sobre o top-N: bi_top_telas corta em dez,
  // e uma fatia sobre denominador cortado é número falso com cara de certo.
  const mediaDiaria = useMemo(() => {
    const dias = atividade.data ?? []
    if (dias.length === 0) return null
    return Math.round(dias.reduce((soma, d) => soma + d.ativos, 0) / dias.length)
  }, [atividade.data])

  const telaLider = telas.data?.[0] ?? null

  const totalEventos = useMemo(
    () => (eventos.data ?? []).reduce((soma, e) => soma + e.eventos, 0),
    [eventos.data],
  )

  const picoNavegacao = useMemo(
    () => (heatmap.data ?? []).reduce((maior, h) => Math.max(maior, h.pageviews), 0),
    [heatmap.data],
  )

  const vsPeriodo = 'vs período anterior'
  const sincronizadoAs = sync.data
    ? new Date(sync.data).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null

  return (
    <BentoGrid>
      {/* Filtro de período fica acima do mosaico: escopa a tela inteira */}
      <BentoItem span={12} className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Visão geral</h2>
          <p className="text-muted-foreground text-sm">
            Uso da plataforma pelos clientes
            {sincronizadoAs ? ` · dados sincronizados às ${sincronizadoAs}` : ''}
          </p>
        </div>
        <PeriodoFiltro valor={periodo} onChange={setPeriodo} />
      </BentoItem>

      <BentoItem span={12}>
        <KpiGrid>
          <KpiCard
            label="Usuários ativos"
            value={kpis.data?.ativos ?? 0}
            format={formatInt}
            delta={
              kpis.data
                ? deltaOuNada(kpis.data.ativos, kpis.data.ativos_ant, vsPeriodo)
                : undefined
            }
            isLoading={kpis.isLoading}
          />
          <KpiCard
            label="Novos clientes"
            value={kpis.data?.novos ?? 0}
            format={formatInt}
            delta={
              kpis.data
                ? deltaOuNada(kpis.data.novos, kpis.data.novos_ant, vsPeriodo)
                : undefined
            }
            isLoading={kpis.isLoading}
          />
          <KpiCard
            label="Aulas concluídas"
            value={kpis.data?.aulas ?? 0}
            format={formatInt}
            delta={
              kpis.data
                ? deltaOuNada(kpis.data.aulas, kpis.data.aulas_ant, vsPeriodo)
                : undefined
            }
            isLoading={kpis.isLoading}
          />
          <KpiCard
            label="Pageviews"
            value={kpis.data?.pageviews ?? 0}
            format={formatCompact}
            delta={
              kpis.data
                ? deltaOuNada(kpis.data.pageviews, kpis.data.pageviews_ant, vsPeriodo)
                : undefined
            }
            isLoading={kpis.isLoading}
          />
        </KpiGrid>
      </BentoItem>

      <BentoItem span={8}>
        <ChartCard
          tone="brand"
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

      <BentoItem span={4} rows={2}>
        <ChartCard
          icon={MonitorIcon}
          title="Telas mais acessadas"
          headline={telaLider ? formatCompact(telaLider.views) : '—'}
          headlineLabel={telaLider ? `em ${labelRota(telaLider.path)}` : undefined}
          description="Pageviews por tela, dez maiores · rastreados desde jul/2026"
          isLoading={telas.isLoading}
          isError={telas.isError}
          onRetry={() => void telas.refetch()}
          isEmpty={telas.data?.length === 0}
          isRefreshing={telas.isFetching && !!telas.data}
        >
          <CategoryBarChart
            layout="bar"
            label="Pageviews"
            data={(telas.data ?? []).map((t) => ({
              category: labelRota(t.path),
              value: t.views,
            }))}
            valueFormatter={formatCompact}
            className="h-[320px]"
          />
        </ChartCard>

      </BentoItem>

      <BentoItem span={8}>
        <ChartCard
          icon={MousePointerClickIcon}
          title="Ações na plataforma"
          headline={formatCompact(totalEventos)}
          headlineLabel="ações no período"
          description={`Eventos de produto por tipo, oito maiores no gráfico · o número acima soma todos os tipos · últimos ${periodo} dias`}
          isLoading={eventos.isLoading}
          isError={eventos.isError}
          onRetry={() => void eventos.refetch()}
          isEmpty={eventos.data?.length === 0}
          isRefreshing={eventos.isFetching && !!eventos.data}
        >
          <CategoryBarChart
            layout="bar"
            label="Eventos"
            data={(eventos.data ?? []).slice(0, 8).map((e) => ({
              category: labelTipoEvento(e.tipo),
              value: e.eventos,
            }))}
            valueFormatter={formatCompact}
            className="h-[320px]"
          />
        </ChartCard>
      </BentoItem>

      <BentoItem span={12}>
        <ChartCard
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
    </BentoGrid>
  )
}
