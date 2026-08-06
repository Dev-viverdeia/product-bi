import { useState } from 'react'

import {
  CategoryBarChart,
  ChartCard,
  DonutChart,
  HeatmapChart,
  KpiCard,
  KpiGrid,
  TimeSeriesChart,
} from '@/components/charts'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  formatCompact,
  formatCurrency,
  formatCurrencyCompact,
  formatInt,
  formatMonthShort,
  formatPercent,
} from '@/lib/format'
import {
  assinaturasPorPlano,
  kpis,
  receitaMensal,
  receitaPorProduto,
  sessoesPorCanal,
  usuariosMensal,
} from '@/pages/design/sample-data'

type DemoState = 'loading' | 'empty' | 'error'

const demoStates: { value: DemoState; label: string }[] = [
  { value: 'loading', label: 'Carregando' },
  { value: 'empty', label: 'Vazio' },
  { value: 'error', label: 'Erro' },
]

/**
 * Showcase interno do kit de gráficos — cada peça é validada aqui (light,
 * dark, mobile) antes de entrar em módulo de produto.
 */
export function DesignPage() {
  const [demoState, setDemoState] = useState<DemoState>('loading')

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Design system</h2>
        <p className="text-muted-foreground text-sm">
          Showcase do kit de gráficos — dados de exemplo.
        </p>
      </div>

      <KpiGrid>
        <KpiCard
          label="Receita (mês)"
          value={kpis.receita.value}
          format={formatCurrencyCompact}
          delta={{ value: kpis.receita.delta, vs: 'vs mês anterior' }}
          trend={kpis.receita.trend}
        />
        <KpiCard
          label="Usuários ativos"
          value={kpis.usuariosAtivos.value}
          format={formatInt}
          delta={{ value: kpis.usuariosAtivos.delta, vs: 'vs mês anterior' }}
          trend={kpis.usuariosAtivos.trend}
        />
        <KpiCard
          label="Conversão"
          value={kpis.conversao.value}
          format={formatPercent}
          delta={{ value: kpis.conversao.delta, vs: 'vs mês anterior' }}
          trend={kpis.conversao.trend}
        />
        <KpiCard
          label="Churn"
          value={kpis.churn.value}
          format={formatPercent}
          delta={{ value: kpis.churn.delta, vs: 'vs mês anterior', upIsGood: false }}
          trend={kpis.churn.trend}
        />
      </KpiGrid>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Receita mensal"
          description="Últimos 12 meses"
        >
          <TimeSeriesChart
            variant="area"
            data={receitaMensal}
            series={[{ dataKey: 'receita', label: 'Receita' }]}
            xTickFormatter={formatMonthShort}
            valueFormatter={formatCurrencyCompact}
          />
        </ChartCard>

        <ChartCard
          title="Usuários por mês"
          description="Novos × recorrentes — 2ª série tracejada (segundo canal)"
        >
          <TimeSeriesChart
            data={usuariosMensal}
            series={[
              { dataKey: 'recorrentes', label: 'Recorrentes' },
              { dataKey: 'novos', label: 'Novos' },
            ]}
            xTickFormatter={formatMonthShort}
            valueFormatter={formatCompact}
          />
        </ChartCard>

        <ChartCard title="Sessões por canal" description="Agosto de 2026">
          <CategoryBarChart
            data={sessoesPorCanal}
            label="Sessões"
            valueFormatter={formatCompact}
          />
        </ChartCard>

        <ChartCard
          title="Receita por produto"
          description="Barras horizontais para categorias longas"
        >
          <CategoryBarChart
            data={receitaPorProduto}
            label="Receita"
            layout="bar"
            valueFormatter={formatCurrencyCompact}
          />
        </ChartCard>

        <ChartCard
          title="Assinaturas por plano"
          description="6 planos → 4 + “Outros” (regra de fatias do DS)"
        >
          <DonutChart
            data={assinaturasPorPlano}
            totalLabel="assinaturas"
            valueFormatter={formatInt}
          />
        </ChartCard>

        <ChartCard
          title="Estados"
          description="Todo gráfico nasce com os três"
          action={
            <div className="flex gap-1">
              {demoStates.map((state) => (
                <Button
                  key={state.value}
                  size="sm"
                  variant={demoState === state.value ? 'secondary' : 'ghost'}
                  onClick={() => setDemoState(state.value)}
                >
                  {state.label}
                </Button>
              ))}
            </div>
          }
          isLoading={demoState === 'loading'}
          isEmpty={demoState === 'empty'}
          isError={demoState === 'error'}
          onRetry={() => setDemoState('loading')}
        >
          <div />
        </ChartCard>
      </div>

      <ChartCard
        title="Heatmap dia × hora"
        description="Sequencial de 1 hue por alfa — funciona igual nos 2 temas"
      >
        <HeatmapChart
          label="eventos"
          data={Array.from({ length: 7 }, (_, dia) =>
            Array.from({ length: 24 }, (_, hora) => ({
              dia,
              hora,
              // padrão determinístico: pico em dias úteis, 10h–16h
              valor:
                dia === 0 || dia === 6
                  ? Math.max(0, 12 - Math.abs(hora - 14) * 2)
                  : Math.max(0, 80 - Math.abs(hora - 11) * 9 - (dia === 5 ? 18 : 0)),
            })),
          ).flat()}
        />
      </ChartCard>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tabela densa — plana, números em mono tabular</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead className="text-right">Receita</TableHead>
                <TableHead className="text-right">Assinantes</TableHead>
                <TableHead className="text-right">Ticket médio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {receitaPorProduto.map((row, i) => {
                const assinantes = [1180, 890, 240, 310, 12][i] ?? 0
                return (
                  <TableRow key={row.category}>
                    <TableCell>{row.category}</TableCell>
                    <TableCell className="num text-right">
                      {formatCurrency(row.value)}
                    </TableCell>
                    <TableCell className="num text-right">
                      {formatInt(assinantes)}
                    </TableCell>
                    <TableCell className="num text-right">
                      {formatCurrency(assinantes ? row.value / assinantes : 0)}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
