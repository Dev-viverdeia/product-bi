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
import { CohortTable } from '@/features/clientes/cohort-table'
import {
  useAmplitudeModulos,
  useDiasAtivosDistribuicao,
  useEngajamento,
  usePowerUsers,
  useRetencaoCohort,
  useRetencaoPorAmplitude,
} from '@/features/clientes/queries'

export function ClientesPage() {
  const [periodo, setPeriodo] = useState<Periodo>(30)

  const engajamento = useEngajamento(periodo)
  const cohort = useRetencaoCohort()
  const diasAtivos = useDiasAtivosDistribuicao(periodo)
  const amplitude = useAmplitudeModulos(periodo)
  const retencaoAmplitude = useRetencaoPorAmplitude()
  const powerUsers = usePowerUsers(periodo)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Clientes & Retenção</h2>
          <p className="text-muted-foreground text-sm">
            Régua: cliente ativo = 1+ ação de produto no dia · eventos desde mai/2025
          </p>
        </div>
        <PeriodoFiltro valor={periodo} onChange={setPeriodo} />
      </div>

      <KpiGrid>
        <KpiCard
          label="Stickiness (DAU/MAU)"
          value={engajamento.data?.stickiness ?? 0}
          format={formatPercent}
          isLoading={engajamento.isLoading}
        />
        <KpiCard
          label="Hábito semanal"
          value={engajamento.data?.pct_habito_semanal ?? 0}
          format={formatPercent}
          isLoading={engajamento.isLoading}
        />
        <KpiCard
          label="Dias ativos por cliente"
          value={engajamento.data?.dias_ativos_medio ?? 0}
          format={formatDecimal}
          isLoading={engajamento.isLoading}
        />
        <KpiCard
          label="Usam 2+ módulos"
          value={engajamento.data?.pct_multimodulo ?? 0}
          format={formatPercent}
          isLoading={engajamento.isLoading}
        />
      </KpiGrid>

      {/* Tabela densa fica plana (regra do DS) — estados tratados manualmente */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Retenção por cohort de entrada</CardTitle>
          <CardDescription>
            % de clientes ativos na janela após a entrada · “—” = janela ainda não
            completa · régua estável desde mai/2025 (só ações de produto)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {cohort.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="h-9 w-full rounded-md" />
              ))}
            </div>
          ) : cohort.isError ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              Não foi possível carregar os dados.
            </p>
          ) : (
            <CohortTable linhas={cohort.data ?? []} />
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Frequência de uso"
          description={`Clientes por dias ativos · últimos ${periodo} dias`}
          isLoading={diasAtivos.isLoading}
          isError={diasAtivos.isError}
          onRetry={() => void diasAtivos.refetch()}
          isEmpty={diasAtivos.data?.length === 0}
          isRefreshing={diasAtivos.isFetching && !!diasAtivos.data}
        >
          <CategoryBarChart
            label="Clientes"
            data={(diasAtivos.data ?? []).map((d) => ({
              category: d.faixa,
              value: d.clientes,
            }))}
            valueFormatter={formatInt}
            className="h-[280px]"
          />
        </ChartCard>

        <ChartCard
          title="Amplitude de uso"
          description={`Clientes por nº de módulos usados · últimos ${periodo} dias`}
          isLoading={amplitude.isLoading}
          isError={amplitude.isError}
          onRetry={() => void amplitude.refetch()}
          isEmpty={amplitude.data?.length === 0}
          isRefreshing={amplitude.isFetching && !!amplitude.data}
        >
          <CategoryBarChart
            label="Clientes"
            data={(amplitude.data ?? []).map((a) => ({
              category: `${a.modulos} ${a.modulos === 1 ? 'módulo' : 'módulos'}`,
              value: a.clientes,
            }))}
            valueFormatter={formatInt}
            className="h-[280px]"
          />
        </ChartCard>
      </div>

      <ChartCard
        title="Multi-módulo retém mais?"
        description="Módulos usados nos primeiros 30 dias de vida × % ainda ativos hoje (clientes com 120+ dias de casa)"
        isLoading={retencaoAmplitude.isLoading}
        isError={retencaoAmplitude.isError}
        onRetry={() => void retencaoAmplitude.refetch()}
        isEmpty={retencaoAmplitude.data?.length === 0}
        isRefreshing={retencaoAmplitude.isFetching && !!retencaoAmplitude.data}
      >
        <CategoryBarChart
          label="Retidos"
          data={(retencaoAmplitude.data ?? []).map((r) => ({
            category: `${r.modulos} ${r.modulos === 1 ? 'módulo' : 'módulos'}`,
            value: r.pct_retidos,
          }))}
          valueFormatter={formatPercent}
          className="h-[260px]"
        />
      </ChartCard>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Power users</CardTitle>
          <CardDescription>
            Top clientes por engajamento · últimos {periodo} dias · fonte de cases,
            depoimentos e beta testers
          </CardDescription>
        </CardHeader>
        <CardContent>
          {powerUsers.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="h-9 w-full rounded-md" />
              ))}
            </div>
          ) : powerUsers.isError ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              Não foi possível carregar os dados.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Organização</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead className="text-right">Dias ativos</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                  <TableHead className="text-right">Módulos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(powerUsers.data ?? []).map((u) => (
                  <TableRow key={u.email}>
                    <TableCell>
                      <div className="font-medium">{u.nome ?? '—'}</div>
                      <div className="text-muted-foreground text-xs">{u.email}</div>
                    </TableCell>
                    <TableCell>{u.organizacao ?? '—'}</TableCell>
                    <TableCell>{u.plano ?? '—'}</TableCell>
                    <TableCell className="num text-right">{formatInt(u.dias_ativos)}</TableCell>
                    <TableCell className="num text-right">{formatInt(u.eventos)}</TableCell>
                    <TableCell className="num text-right">{formatInt(u.modulos)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
