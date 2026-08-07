import { useState } from 'react'

import { CategoryBarChart, ChartCard, KpiCard, KpiGrid } from '@/components/charts'
import { PeriodoFiltro, type Periodo } from '@/components/filters/periodo-filtro'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatDecimal, formatInt, formatPercent } from '@/lib/format'
import {
  useBuilderSteps,
  useConsultorModos,
  useConsultorRecorrencia,
  useIaAdocao,
  useIaImpactoRetencao,
  useIaKpis,
} from '@/features/ia/queries'

function EstadoTabela({
  isLoading,
  isError,
  children,
}: {
  isLoading: boolean
  isError: boolean
  children: React.ReactNode
}) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-9 w-full rounded-md" />
        ))}
      </div>
    )
  }
  if (isError) {
    return (
      <p className="text-muted-foreground py-8 text-center text-sm">
        Não foi possível carregar os dados.
      </p>
    )
  }
  return children
}

export function IaPage() {
  const [periodo, setPeriodo] = useState<Periodo>(30)

  const kpis = useIaKpis(periodo)
  const adocao = useIaAdocao(periodo)
  const recorrencia = useConsultorRecorrencia(periodo)
  const modos = useConsultorModos()
  const steps = useBuilderSteps()
  const impacto = useIaImpactoRetencao()

  const comIa = impacto.data?.find((i) => i.grupo.startsWith('Usou'))
  const semIa = impacto.data?.find((i) => i.grupo.startsWith('Não'))
  const lift =
    comIa?.pct_retencao && semIa?.pct_retencao
      ? comIa.pct_retencao / semIa.pct_retencao
      : null

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Consultor & Builder</h2>
          <p className="text-muted-foreground text-sm">
            Adoção, recorrência e confiabilidade das ferramentas de IA · Consultor
            rastreado desde mai/2026 (lançamento)
          </p>
        </div>
        <PeriodoFiltro valor={periodo} onChange={setPeriodo} />
      </div>

      <KpiGrid>
        <KpiCard
          label="Usuários do Consultor"
          value={kpis.data?.usuarios_consultor ?? 0}
          format={formatInt}
          isLoading={kpis.isLoading}
        />
        <KpiCard
          label="Mensagens enviadas"
          value={kpis.data?.mensagens_consultor ?? 0}
          format={formatInt}
          isLoading={kpis.isLoading}
        />
        <KpiCard
          label="Usuários do Builder"
          value={kpis.data?.usuarios_builder ?? 0}
          format={formatInt}
          isLoading={kpis.isLoading}
        />
        <KpiCard
          label="Soluções geradas"
          value={kpis.data?.solucoes_builder ?? 0}
          format={formatInt}
          isLoading={kpis.isLoading}
        />
      </KpiGrid>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Quem usa IA na primeira semana retém mais?
          </CardTitle>
          <CardDescription>
            Clientes que entraram a partir do lançamento do Consultor (11/mai/2026) e
            já têm 60+ dias de casa · retenção medida entre os dias 30 e 60
            {lift ? ` · lift de ${formatDecimal(lift)}×` : ''} · correlação, não
            causalidade
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EstadoTabela isLoading={impacto.isLoading} isError={impacto.isError}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Grupo</TableHead>
                  <TableHead className="text-right">Clientes</TableHead>
                  <TableHead className="text-right">Retidos</TableHead>
                  <TableHead className="text-right">Retenção</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(impacto.data ?? []).map((i) => (
                  <TableRow key={i.grupo}>
                    <TableCell className="font-medium">{i.grupo}</TableCell>
                    <TableCell className="num text-right">{formatInt(i.clientes)}</TableCell>
                    <TableCell className="num text-right">{formatInt(i.retidos)}</TableCell>
                    <TableCell className="num text-right font-medium">
                      {i.pct_retencao != null ? formatPercent(i.pct_retencao) : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </EstadoTabela>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Adoção entre clientes ativos"
          description={`Dos clientes com atividade nos últimos ${periodo} dias, quantos usam cada ferramenta`}
          isLoading={adocao.isLoading}
          isError={adocao.isError}
          onRetry={() => void adocao.refetch()}
          isEmpty={adocao.data?.length === 0}
        >
          <CategoryBarChart
            layout="bar"
            label="Usuários"
            data={(adocao.data ?? []).map((a) => ({
              category: a.ferramenta,
              value: a.usuarios,
            }))}
            valueFormatter={formatInt}
            className="h-[240px]"
          />
        </ChartCard>

        <ChartCard
          title="Recorrência do Consultor"
          description={`Dias distintos de uso por cliente nos últimos ${periodo} dias — mede hábito, não experimentação`}
          isLoading={recorrencia.isLoading}
          isError={recorrencia.isError}
          onRetry={() => void recorrencia.refetch()}
          isEmpty={recorrencia.data?.length === 0}
        >
          <CategoryBarChart
            label="Clientes"
            data={(recorrencia.data ?? []).map((r) => ({
              category: r.faixa,
              value: r.usuarios,
            }))}
            valueFormatter={formatInt}
            className="h-[240px]"
          />
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <ChartCard
          className="lg:col-span-2"
          title="Modos do Consultor"
          description="Conversas por modo (histórico completo)"
          isLoading={modos.isLoading}
          isError={modos.isError}
          onRetry={() => void modos.refetch()}
          isEmpty={modos.data?.length === 0}
        >
          <CategoryBarChart
            label="Conversas"
            data={(modos.data ?? []).map((m) => ({
              category: m.modo,
              value: m.threads,
            }))}
            valueFormatter={formatInt}
            className="h-[240px]"
          />
        </ChartCard>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Builder — confiabilidade por etapa</CardTitle>
            <CardDescription>
              Gerações dos últimos 90 dias · ordenado pelas etapas mais lentas ·
              erro alto ou tempo alto = atrito na experiência
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EstadoTabela isLoading={steps.isLoading} isError={steps.isError}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Etapa</TableHead>
                    <TableHead className="text-right">Gerações</TableHead>
                    <TableHead className="text-right">Erro</TableHead>
                    <TableHead className="text-right">Tempo médio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(steps.data ?? []).map((s) => (
                    <TableRow key={s.step}>
                      <TableCell className="font-mono text-xs">{s.step}</TableCell>
                      <TableCell className="num text-right">{formatInt(s.geracoes)}</TableCell>
                      <TableCell className="num text-right">
                        {s.pct_erro != null ? `${formatDecimal(s.pct_erro)}%` : '—'}
                      </TableCell>
                      <TableCell className="num text-right">
                        {s.segundos_medio != null ? `${formatDecimal(s.segundos_medio)}s` : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </EstadoTabela>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
