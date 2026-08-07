import { useState } from 'react'

import { CategoryBarChart, ChartCard, KpiCard, KpiGrid } from '@/components/charts'
import { PeriodoFiltro, type Periodo } from '@/components/filters/periodo-filtro'
import { Badge } from '@/components/ui/badge'
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
import {
  formatDateShort,
  formatDecimal,
  formatInt,
  formatPercent,
} from '@/lib/format'
import { labelTipoEvento } from '@/lib/labels-plataforma'
import { CohortTable } from '@/features/clientes/cohort-table'
import {
  useAhaMoment,
  useAmplitudeModulos,
  useChurnModulos,
  useChurnResumo,
  useChurnUltimoModulo,
  useClientesEmRisco,
  useDiasAtivosDistribuicao,
  useEngajamento,
  usePowerUsers,
  useRetencaoCohort,
  useRetencaoPorAmplitude,
} from '@/features/clientes/queries'

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
        {Array.from({ length: 6 }, (_, i) => (
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

export function ClientesPage() {
  const [periodo, setPeriodo] = useState<Periodo>(30)

  const engajamento = useEngajamento(periodo)
  const risco = useClientesEmRisco()
  const cohort = useRetencaoCohort()
  const aha = useAhaMoment()
  const churnResumo = useChurnResumo()
  const churnModulos = useChurnModulos()
  const churnUltimo = useChurnUltimoModulo()
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Clientes em risco — lista para ação</CardTitle>
          <CardDescription>
            Inatividade: era ativo e está 14+ dias em silêncio · Plano vencendo: contrato
            expira em ≤30 dias sem uso recente do master
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EstadoTabela isLoading={risco.isLoading} isError={risco.isError}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Organização</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead className="text-right">Última atividade</TableHead>
                  <TableHead className="text-right">Dias inativo</TableHead>
                  <TableHead className="text-right">Vence em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(risco.data ?? []).map((r) => (
                  <TableRow key={r.email}>
                    <TableCell>
                      <div className="font-medium">{r.nome ?? '—'}</div>
                      <div className="text-muted-foreground text-xs">{r.email}</div>
                    </TableCell>
                    <TableCell>{r.organizacao ?? '—'}</TableCell>
                    <TableCell>{r.plano ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {r.motivo === 'plano_vencendo' ? 'Plano vencendo' : 'Inatividade'}
                      </Badge>
                    </TableCell>
                    <TableCell className="num text-right">
                      {r.ultima_atividade ? formatDateShort(r.ultima_atividade) : '—'}
                    </TableCell>
                    <TableCell className="num text-right">
                      {r.dias_inativo != null ? formatInt(r.dias_inativo) : '—'}
                    </TableCell>
                    <TableCell className="num text-right">
                      {r.dias_ate_vencer != null ? `${formatInt(r.dias_ate_vencer)}d` : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </EstadoTabela>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Retenção por cohort de entrada</CardTitle>
          <CardDescription>
            % de clientes ativos na janela após a entrada · “—” = janela ainda não completa ·
            atenção: a régua de atividade ganhou novos tipos de evento ao longo do tempo
            (Builder out/25, Soluções abr/26, Consultor mai/26) — parte da melhora entre
            cohorts distantes é instrumentação
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EstadoTabela isLoading={cohort.isLoading} isError={cohort.isError}>
            <CohortTable linhas={cohort.data ?? []} />
          </EstadoTabela>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Momento “aha” — o que a 1ª semana prevê</CardTitle>
          <CardDescription>
            Ação nos primeiros 7 dias × retenção aos 90 dias (clientes com 120+ dias de casa) ·
            correlação, não causalidade — validar com experimento · só ações com tracking
            cobrindo todo o período aparecem
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EstadoTabela isLoading={aha.isLoading} isError={aha.isError}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ação na 1ª semana</TableHead>
                  <TableHead className="text-right">Fizeram</TableHead>
                  <TableHead className="text-right">Retenção 90d</TableHead>
                  <TableHead className="text-right">Não fizeram</TableHead>
                  <TableHead className="text-right">Retenção 90d</TableHead>
                  <TableHead className="text-right">Lift</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(aha.data ?? []).map((a) => (
                  <TableRow key={a.acao}>
                    <TableCell className="font-medium">{labelTipoEvento(a.acao)}</TableCell>
                    <TableCell className="num text-right">{formatInt(a.fizeram)}</TableCell>
                    <TableCell className="num text-right">
                      {a.ret_fizeram != null ? formatPercent(a.ret_fizeram) : '—'}
                    </TableCell>
                    <TableCell className="num text-right">{formatInt(a.nao_fizeram)}</TableCell>
                    <TableCell className="num text-right">
                      {a.ret_nao_fizeram != null ? formatPercent(a.ret_nao_fizeram) : '—'}
                    </TableCell>
                    <TableCell className="num text-right font-medium">
                      {a.lift != null ? `${formatDecimal(a.lift)}×` : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </EstadoTabela>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Autópsia de churn — módulos nunca usados</CardTitle>
            <CardDescription>
              {churnResumo.data
                ? `${formatInt(churnResumo.data.churned)} clientes em churn (60+ dias sem uso, ` +
                  `${formatPercent(churnResumo.data.pct_churn ?? 0)} da base histórica) · ` +
                  `vida média de ${formatDecimal(churnResumo.data.vida_media_dias ?? 0)} dias`
                : 'Quem saiu vs quem ficou: % que nunca usou cada módulo'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EstadoTabela
              isLoading={churnModulos.isLoading}
              isError={churnModulos.isError}
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Módulo</TableHead>
                    <TableHead className="text-right">Churned nunca usou</TableHead>
                    <TableHead className="text-right">Ativos nunca usou</TableHead>
                    <TableHead className="text-right">Gap (pp)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(churnModulos.data ?? []).map((m) => (
                    <TableRow key={m.modulo}>
                      <TableCell>
                        <div className="font-medium">{m.modulo}</div>
                        <div className="text-muted-foreground text-xs">
                          medido desde {formatDateShort(m.medido_desde)}
                          {m.modulo === 'Consultor' ? ' (lançamento do produto)' : ''}
                        </div>
                      </TableCell>
                      <TableCell className="num text-right">
                        {m.pct_churned_nunca_usou != null
                          ? formatPercent(m.pct_churned_nunca_usou)
                          : '—'}
                      </TableCell>
                      <TableCell className="num text-right">
                        {m.pct_ativos_nunca_usou != null
                          ? formatPercent(m.pct_ativos_nunca_usou)
                          : '—'}
                      </TableCell>
                      <TableCell className="num text-right font-medium">
                        {m.gap_pp != null ? formatDecimal(m.gap_pp) : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </EstadoTabela>
          </CardContent>
        </Card>

        <ChartCard
          className="lg:col-span-2"
          title="Onde a jornada termina"
          description="Último módulo usado antes do churn"
          isLoading={churnUltimo.isLoading}
          isError={churnUltimo.isError}
          onRetry={() => void churnUltimo.refetch()}
          isEmpty={churnUltimo.data?.length === 0}
        >
          <CategoryBarChart
            layout="bar"
            label="Clientes"
            data={(churnUltimo.data ?? []).map((c) => ({
              category: c.modulo,
              value: c.clientes,
            }))}
            valueFormatter={formatInt}
            className="h-[300px]"
          />
        </ChartCard>
      </div>

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
          <EstadoTabela isLoading={powerUsers.isLoading} isError={powerUsers.isError}>
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
          </EstadoTabela>
        </CardContent>
      </Card>
    </div>
  )
}
