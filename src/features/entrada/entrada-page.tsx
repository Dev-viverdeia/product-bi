import { useState } from 'react'
import { BentoGrid, BentoItem } from '@/components/layout/bento'
import { ModuloTabs } from '@/components/layout/modulo-tabs'

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
import { formatInt, formatPercent } from '@/lib/format'
import { fundoIntensidade } from '@/lib/intensidade'
import {
  useEntradaKpis,
  useErrosLogin,
  useErrosPorTela,
  useFunilEntrada,
  useMastersResumo,
  useMastersTopConvidadores,
  useOnboardingAbandono,
  useTempoPrimeiroValor,
} from '@/features/entrada/queries'

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

export function EntradaPage() {
  const [periodo, setPeriodo] = useState<Periodo>(30)

  const kpis = useEntradaKpis(periodo)
  const funil = useFunilEntrada(periodo)
  const tempo = useTempoPrimeiroValor()
  const onboarding = useOnboardingAbandono()
  const mastersResumo = useMastersResumo()
  const mastersTop = useMastersTopConvidadores()
  const errosLogin = useErrosLogin(periodo)
  const errosTela = useErrosPorTela(periodo)

  return (
    <div className="space-y-4">
      {/* Fora das abas: contexto do módulo inteiro. Trocar de aba não pode
          custar o número de referência nem obrigar a reajustar o período. */}
      <BentoGrid>
        <BentoItem span={12} className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Entrada & Crescimento</h2>
            <p className="text-muted-foreground text-sm">
              Funil por safra de convites criados no período · onboarding e erros na porta
            </p>
          </div>
          <PeriodoFiltro valor={periodo} onChange={setPeriodo} />
        </BentoItem>

        <BentoItem span={12}>
          <KpiGrid>
            <KpiCard
              label="Convites criados"
              value={kpis.data?.convites ?? 0}
              format={formatInt}
              isLoading={kpis.isLoading}
            />
            <KpiCard
              label="Conversão convite → cadastro"
              value={kpis.data?.conversao ?? 0}
              format={formatPercent}
              isLoading={kpis.isLoading}
            />
            <KpiCard
              label="Onboarding concluído (dos cadastrados)"
              value={kpis.data?.onboarding_pct ?? 0}
              format={formatPercent}
              isLoading={kpis.isLoading}
            />
            <KpiCard
              label="Erros de login"
              value={kpis.data?.erros_login ?? 0}
              format={formatInt}
              isLoading={kpis.isLoading}
            />
          </KpiGrid>
        </BentoItem>
      </BentoGrid>

      <ModuloTabs
        rota="/entrada"
        conteudos={{
          funil: (
            <BentoGrid>
              <BentoItem span={8}>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Funil de entrada</CardTitle>
                    <CardDescription>
                      Safra: convites criados nos últimos {periodo} dias, acompanhados até a 1ª ação ·
                      convites deletados fora · etapa de envio não aparece: o rastreamento de entrega
                      da plataforma parou em abr/2026 (registrado para reporte)
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <EstadoTabela isLoading={funil.isLoading} isError={funil.isError}>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Etapa</TableHead>
                            <TableHead className="text-right">Quantidade</TableHead>
                            <TableHead className="text-right">% do início</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(funil.data ?? []).map((f) => (
                            <TableRow key={f.etapa}>
                              <TableCell className="font-medium">{f.etapa}</TableCell>
                              <TableCell className="num text-right">{formatInt(f.quantidade)}</TableCell>
                              <TableCell className="num text-right" style={fundoIntensidade(f.pct_do_inicio)}>
                                {f.pct_do_inicio != null ? formatPercent(f.pct_do_inicio) : '—'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </EstadoTabela>
                  </CardContent>
                </Card>
              </BentoItem>

              <BentoItem span={4}>
                <ChartCard
                  title="Tempo até a 1ª ação de produto"
                  description="Clientes que entraram entre 30 e 180 dias atrás — quanto demoram para agir"
                  isLoading={tempo.isLoading}
                  isError={tempo.isError}
                  onRetry={() => void tempo.refetch()}
                  isEmpty={tempo.data?.length === 0}
                >
                  <CategoryBarChart
                    label="Clientes"
                    data={(tempo.data ?? []).map((t) => ({ category: t.faixa, value: t.clientes }))}
                    valueFormatter={formatInt}
                    className="h-[300px]"
                  />
                </ChartCard>

              </BentoItem>
            </BentoGrid>
          ),
          onboarding: (
            <BentoGrid>
              <BentoItem span={6}>
                <ChartCard
                  title="Onboarding — onde os incompletos param"
                  description="Distribuição por etapa atual de quem não concluiu (89,5% da base concluem)"
                  isLoading={onboarding.isLoading}
                  isError={onboarding.isError}
                  onRetry={() => void onboarding.refetch()}
                  isEmpty={onboarding.data?.length === 0}
                >
                  <CategoryBarChart
                    label="Clientes"
                    data={(onboarding.data ?? []).map((o) => ({
                      category: `Etapa ${o.step_atual}`,
                      value: o.clientes,
                    }))}
                    valueFormatter={formatInt}
                    className="h-[300px]"
                  />
                </ChartCard>
              </BentoItem>

              <BentoItem span={6}>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Masters × convites</CardTitle>
                    <CardDescription>
                      {mastersResumo.data
                        ? `${formatInt(mastersResumo.data.masters_total)} masters · ` +
                          `${formatInt(mastersResumo.data.masters_convidaram)} já convidaram ` +
                          `(${formatPercent(mastersResumo.data.pct_convidam ?? 0)}) · ` +
                          `conversão dos convites de masters: ${formatPercent(mastersResumo.data.conversao_convites ?? 0)}`
                        : 'Quem traz gente para dentro — histórico completo'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <EstadoTabela isLoading={mastersTop.isLoading} isError={mastersTop.isError}>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Master</TableHead>
                            <TableHead>Organização</TableHead>
                            <TableHead className="text-right">Convites</TableHead>
                            <TableHead className="text-right">Usados</TableHead>
                            <TableHead className="text-right">Conversão</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(mastersTop.data ?? []).map((m) => (
                            <TableRow key={m.email}>
                              <TableCell>
                                <div className="font-medium">{m.nome ?? '—'}</div>
                                <div className="text-muted-foreground text-xs">{m.email}</div>
                              </TableCell>
                              <TableCell>{m.organizacao ?? '—'}</TableCell>
                              <TableCell className="num text-right">{formatInt(m.convites)}</TableCell>
                              <TableCell className="num text-right">{formatInt(m.usados)}</TableCell>
                              <TableCell className="num text-right">
                                {m.conversao != null ? formatPercent(m.conversao) : '—'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </EstadoTabela>
                  </CardContent>
                </Card>
              </BentoItem>
            </BentoGrid>
          ),
          porta: (
            <BentoGrid>
              <BentoItem span={6}>
                <ChartCard
                  title="Erros de login por categoria"
                  description={`auth_error_telemetry · últimos ${periodo} dias · invalid_credentials = senha errada (esperado); investigar FALLBACK`}
                  isLoading={errosLogin.isLoading}
                  isError={errosLogin.isError}
                  onRetry={() => void errosLogin.refetch()}
                  isEmpty={errosLogin.data?.length === 0}
                >
                  <CategoryBarChart
                    layout="bar"
                    label="Ocorrências"
                    data={(errosLogin.data ?? []).map((e) => ({
                      category: e.categoria,
                      value: e.ocorrencias,
                    }))}
                    valueFormatter={formatInt}
                    className="h-[300px]"
                  />
                </ChartCard>

              </BentoItem>

              <BentoItem span={6}>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Erros de JavaScript por tela</CardTitle>
                    <CardDescription>
                      client_error_logs · últimos {periodo} dias · onde o cliente sofre
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <EstadoTabela isLoading={errosTela.isLoading} isError={errosTela.isError}>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Tela</TableHead>
                            <TableHead className="text-right">Ocorrências</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(errosTela.data ?? []).map((e) => (
                            <TableRow key={e.tela}>
                              <TableCell className="font-mono text-xs">{e.tela}</TableCell>
                              <TableCell className="num text-right">{formatInt(e.ocorrencias)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </EstadoTabela>
                  </CardContent>
                </Card>
              </BentoItem>
            </BentoGrid>
          ),
        }}
      />
    </div>
  )
}
