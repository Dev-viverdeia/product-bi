import { useState } from 'react'
import { BentoGrid, BentoItem } from '@/components/layout/bento'
import { ModuloTabs } from '@/components/layout/modulo-tabs'
import { TabelaLonga } from '@/components/tabela/tabela-longa'

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
  TableCell,
  TableHead,
  TableRow,
} from '@/components/ui/table'
import { formatDecimal, formatInt, formatPercent } from '@/lib/format'
import {
  useAssuntos,
  useDropoffPosicao,
  useDuracaoIdeal,
  useFormacoesKpis,
  useFormacoesUso,
  useJornadaCursos,
  useNpsCursos,
} from '@/features/formacoes/queries'

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

export function FormacoesPage() {
  const [periodo, setPeriodo] = useState<Periodo>(30)

  const kpis = useFormacoesKpis(periodo)
  const uso = useFormacoesUso(periodo)
  const duracao = useDuracaoIdeal()
  const dropoff = useDropoffPosicao()
  const nps = useNpsCursos()
  const jornada = useJornadaCursos()
  const assuntos = useAssuntos(periodo)

  return (
    <div className="space-y-4">
      {/* Fora das abas: contexto do módulo inteiro. Trocar de aba não pode
          custar o número de referência nem obrigar a reajustar o período. */}
      <BentoGrid>
        <BentoItem span={12} className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Formações</h2>
            <p className="text-muted-foreground text-sm">
              Uso, jornada do aluno, duração ideal de aula e qualidade percebida
            </p>
          </div>
          <PeriodoFiltro valor={periodo} onChange={setPeriodo} />
        </BentoItem>

        <BentoItem span={12}>
          <KpiGrid>
            <KpiCard
              label="Alunos ativos"
              value={kpis.data?.alunos_ativos ?? 0}
              format={formatInt}
              isLoading={kpis.isLoading}
            />
            <KpiCard
              label="Aulas concluídas"
              value={kpis.data?.aulas_concluidas ?? 0}
              format={formatInt}
              isLoading={kpis.isLoading}
            />
            <KpiCard
              label="Certificados emitidos"
              value={kpis.data?.certificados ?? 0}
              format={formatInt}
              isLoading={kpis.isLoading}
            />
            <KpiCard
              label="NPS médio das aulas"
              value={kpis.data?.nps_medio ?? 0}
              format={formatDecimal}
              isLoading={kpis.isLoading}
            />
          </KpiGrid>
        </BentoItem>
      </BentoGrid>

      <ModuloTabs
        rota="/formacoes"
        conteudos={{
          uso: (
            <BentoGrid>
              <BentoItem span={6}>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Uso por formação</CardTitle>
                    <CardDescription>
                      Alunos e aulas no período selecionado · histórico e conclusão desde o início ·
                      ordenado por alunos no período
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <EstadoTabela isLoading={uso.isLoading} isError={uso.isError}>
                      <TabelaLonga
                        linhas={uso.data ?? []}
                        chave={(c) => String(c.curso)}
                        buscarEm={(c) => [c.curso]}
                        rotuloBusca="Buscar por formação"
                        cabecalho={
                          <TableRow>
                            <TableHead>Formação</TableHead>
                            <TableHead>Categoria</TableHead>
                            <TableHead className="text-right">Alunos ({periodo}d)</TableHead>
                            <TableHead className="text-right">Aulas ({periodo}d)</TableHead>
                            <TableHead className="text-right">Alunos (hist.)</TableHead>
                            <TableHead className="text-right">Certificados</TableHead>
                            <TableHead className="text-right">Conclusão</TableHead>
                          </TableRow>
                        }
                        renderLinha={(c) => (
                          <TableRow>
                            <TableCell className="max-w-64 truncate font-medium">{c.curso}</TableCell>
                            <TableCell>{c.categoria ?? '—'}</TableCell>
                            <TableCell className="num text-right">{formatInt(c.alunos)}</TableCell>
                            <TableCell className="num text-right">{formatInt(c.aulas_concluidas)}</TableCell>
                            <TableCell className="num text-right">{formatInt(c.alunos_historico)}</TableCell>
                            <TableCell className="num text-right">{formatInt(c.certificados_historico)}</TableCell>
                            <TableCell className="num text-right">
                              {c.conclusao_historica != null ? formatPercent(c.conclusao_historica) : '—'}
                            </TableCell>
                          </TableRow>
                        )}
                      />
                    </EstadoTabela>
                  </CardContent>
                </Card>
              </BentoItem>

              <BentoItem span={6}>
                <ChartCard
                  title="Assuntos mais assistidos"
                  description={`Aulas concluídas por categoria de curso · últimos ${periodo} dias`}
                  isLoading={assuntos.isLoading}
                  isError={assuntos.isError}
                  onRetry={() => void assuntos.refetch()}
                  isEmpty={assuntos.data?.length === 0}
                >
                  <CategoryBarChart
                    layout="bar"
                    label="Aulas concluídas"
                    data={(assuntos.data ?? []).map((a) => ({
                      category: a.categoria,
                      value: a.aulas_concluidas,
                    }))}
                    valueFormatter={formatInt}
                    className="h-[280px]"
                  />
                </ChartCard>
              </BentoItem>
            </BentoGrid>
          ),
          conclusao: (
            <BentoGrid>
              <BentoItem span={8}>
                <ChartCard
                  title="Qual duração de aula maximiza conclusão?"
                  description="Taxa de conclusão normalizada por curso (conclusões da aula ÷ aula mais vista do mesmo curso) · só cursos com 50+ conclusões · a barra de 60+ min sobe por serem masterclasses/lives com audiência dedicada"
                  isLoading={duracao.isLoading}
                  isError={duracao.isError}
                  onRetry={() => void duracao.refetch()}
                  isEmpty={duracao.data?.length === 0}
                >
                  <CategoryBarChart
                    label="Taxa de conclusão"
                    data={(duracao.data ?? []).map((d) => ({
                      category: `${d.faixa} (${formatInt(d.aulas)} aulas)`,
                      value: d.taxa_media ?? 0,
                    }))}
                    valueFormatter={formatPercent}
                    className="h-[300px]"
                  />
                </ChartCard>
              </BentoItem>

              <BentoItem span={4}>
                <ChartCard
                  title="Onde o aluno para no curso"
                  description="Sobrevivência média por posição da aula (conclusões ÷ 1ª aula do curso) · decis da grade"
                  isLoading={dropoff.isLoading}
                  isError={dropoff.isError}
                  onRetry={() => void dropoff.refetch()}
                  isEmpty={dropoff.data?.length === 0}
                >
                  <CategoryBarChart
                    label="Sobrevivência"
                    data={(dropoff.data ?? []).map((d) => ({
                      category: `${d.decil * 10}%`,
                      value: d.taxa_media ?? 0,
                    }))}
                    valueFormatter={formatPercent}
                    className="h-[280px]"
                  />
                </ChartCard>

              </BentoItem>
            </BentoGrid>
          ),
          qualidade: (
            <BentoGrid>
              <BentoItem span={6}>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Jornada — tempo até o certificado</CardTitle>
                    <CardDescription>
                      Mediana de dias entre a 1ª aula iniciada e o certificado · cursos com 20+
                      certificados · 0 = concluído no mesmo dia
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <EstadoTabela isLoading={jornada.isLoading} isError={jornada.isError}>
                      <TabelaLonga
                        linhas={jornada.data ?? []}
                        chave={(j) => String(j.curso)}
                        buscarEm={(j) => [j.curso]}
                        rotuloBusca="Buscar por formação"
                        cabecalho={
                          <TableRow>
                            <TableHead>Formação</TableHead>
                            <TableHead className="text-right">Certificados</TableHead>
                            <TableHead className="text-right">Mediana (dias)</TableHead>
                          </TableRow>
                        }
                        renderLinha={(j) => (
                          <TableRow>
                            <TableCell className="max-w-56 truncate font-medium">{j.curso}</TableCell>
                            <TableCell className="num text-right">{formatInt(j.certificados)}</TableCell>
                            <TableCell className="num text-right">
                              {j.mediana_dias != null ? formatDecimal(j.mediana_dias) : '—'}
                            </TableCell>
                          </TableRow>
                        )}
                      />
                    </EstadoTabela>
                  </CardContent>
                </Card>

              </BentoItem>

              <BentoItem span={6}>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">NPS por formação — atenção aos piores</CardTitle>
                    <CardDescription>
                      Escala 0–10 por aula, agregado por curso · 10+ respostas · média geral 9,5 tem
                      viés de positividade — o sinal está nos detratores
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <EstadoTabela isLoading={nps.isLoading} isError={nps.isError}>
                      <TabelaLonga
                        linhas={nps.data ?? []}
                        chave={(n) => String(n.curso)}
                        buscarEm={(n) => [n.curso]}
                        rotuloBusca="Buscar por formação"
                        cabecalho={
                          <TableRow>
                            <TableHead>Formação</TableHead>
                            <TableHead className="text-right">Respostas</TableHead>
                            <TableHead className="text-right">Média</TableHead>
                            <TableHead className="text-right">Detratores</TableHead>
                          </TableRow>
                        }
                        renderLinha={(n) => (
                          <TableRow>
                            <TableCell className="max-w-56 truncate font-medium">{n.curso}</TableCell>
                            <TableCell className="num text-right">{formatInt(n.respostas)}</TableCell>
                            <TableCell className="num text-right">
                              {n.media != null ? formatDecimal(n.media) : '—'}
                            </TableCell>
                            <TableCell className="num text-right">
                              {n.pct_detratores != null ? formatPercent(n.pct_detratores) : '—'}
                            </TableCell>
                          </TableRow>
                        )}
                      />
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
