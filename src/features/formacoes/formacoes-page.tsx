import { useMemo, useState } from 'react'
import {
  AwardIcon,
  BookOpenIcon,
  GraduationCapIcon,
  StarIcon,
  TimerIcon,
  TrendingDownIcon,
} from 'lucide-react'
import { BentoCabecalho, BentoGrid, BentoItem } from '@/components/layout/bento'
import { ModuloTabs } from '@/components/layout/modulo-tabs'
import { TabelaCard } from '@/components/tabela/tabela-card'
import { TabelaLonga } from '@/components/tabela/tabela-longa'

import { CategoryBarChart, ChartCard, KpiCard, KpiGrid } from '@/components/charts'
import { PeriodoFiltro, type Periodo } from '@/components/filters/periodo-filtro'
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

export function FormacoesPage() {
  const [periodo, setPeriodo] = useState<Periodo>(30)

  const kpis = useFormacoesKpis(periodo)
  const uso = useFormacoesUso(periodo)
  const duracao = useDuracaoIdeal()
  const dropoff = useDropoffPosicao()
  const nps = useNpsCursos()
  const jornada = useJornadaCursos()
  const assuntos = useAssuntos(periodo)

  // Nenhuma destas RPCs corta a lista, então somar e comparar aqui é honesto.
  const assuntoLider = useMemo(() => {
    const cats = assuntos.data ?? []
    if (cats.length === 0) return null
    const maior = cats.reduce((a, b) => (b.aulas_concluidas > a.aulas_concluidas ? b : a))
    const total = cats.reduce((soma, a) => soma + a.aulas_concluidas, 0)
    return total > 0 ? { categoria: maior.categoria, parte: maior.aulas_concluidas / total } : null
  }, [assuntos.data])

  const melhorDuracao = useMemo(() => {
    const faixas = (duracao.data ?? []).filter((d) => d.taxa_media != null)
    if (faixas.length === 0) return null
    return faixas.reduce((a, b) => ((b.taxa_media ?? 0) > (a.taxa_media ?? 0) ? b : a))
  }, [duracao.data])

  // Último decil da grade: de quem começou o curso, quem chega ao fim.
  const chegamAoFim = (dropoff.data ?? []).at(-1)?.taxa_media ?? null

  // Mediana das medianas — o curso do meio, não uma média de medianas (que
  // misturaria cursos de tamanhos muito diferentes).
  const cursoMediano = useMemo(() => {
    const dias = (jornada.data ?? [])
      .map((j) => j.mediana_dias)
      .filter((d): d is number => d != null)
      .sort((a, b) => a - b)
    return dias.length > 0 ? dias[Math.floor(dias.length / 2)] : null
  }, [jornada.data])

  const piorNps = useMemo(() => {
    const cursos = (nps.data ?? []).filter((c) => c.pct_detratores != null)
    if (cursos.length === 0) return null
    return cursos.reduce((a, b) => ((b.pct_detratores ?? 0) > (a.pct_detratores ?? 0) ? b : a))
  }, [nps.data])

  return (
    <div className="space-y-4">
      {/* Fora das abas: contexto do módulo inteiro. Trocar de aba não pode
          custar o número de referência nem obrigar a reajustar o período. */}
      <BentoGrid>
        <BentoCabecalho>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Formações</h2>
            <p className="text-muted-foreground text-sm">
              Uso, jornada do aluno, duração ideal de aula e qualidade percebida
            </p>
          </div>
          <PeriodoFiltro valor={periodo} onChange={setPeriodo} />
        </BentoCabecalho>

        <BentoItem span={12}>
          <KpiGrid>
            <KpiCard
              label="Alunos ativos"
              value={kpis.data?.alunos_ativos ?? 0}
              format={formatInt}
              isLoading={kpis.isLoading}
              isError={kpis.isError}
            />
            <KpiCard
              label="Aulas concluídas"
              value={kpis.data?.aulas_concluidas ?? 0}
              format={formatInt}
              isLoading={kpis.isLoading}
              isError={kpis.isError}
            />
            <KpiCard
              label="Certificados emitidos"
              value={kpis.data?.certificados ?? 0}
              format={formatInt}
              isLoading={kpis.isLoading}
              isError={kpis.isError}
            />
            <KpiCard
              label="NPS médio das aulas"
              value={kpis.data?.nps_medio ?? 0}
              format={formatDecimal}
              isLoading={kpis.isLoading}
              isError={kpis.isError}
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
                <TabelaCard
                  icon={GraduationCapIcon}
                  title="Uso por formação"
                  headline={formatInt((uso.data ?? []).length)}
                  headlineLabel="formações com aluno no período"
                  description="Alunos e aulas no período selecionado · histórico e conclusão desde o início · ordenado por alunos no período"
                  isLoading={uso.isLoading}
                  isError={uso.isError}
                  onRetry={() => void uso.refetch()}
                >
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
                </TabelaCard>
              </BentoItem>

              <BentoItem span={6}>
                <ChartCard
                  icon={BookOpenIcon}
                  title="Assuntos mais assistidos"
                  headline={assuntoLider ? formatPercent(assuntoLider.parte) : '—'}
                  headlineLabel={assuntoLider ? `em ${assuntoLider.categoria}` : undefined}
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
                  tone="brand"
                  icon={TimerIcon}
                  title="Duração de aula que maximiza conclusão"
                  headline={
                    melhorDuracao?.taxa_media != null
                      ? formatPercent(melhorDuracao.taxa_media)
                      : '—'
                  }
                  headlineLabel={melhorDuracao ? `na faixa ${melhorDuracao.faixa}` : undefined}
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
                  icon={TrendingDownIcon}
                  title="Onde o aluno para no curso"
                  headline={chegamAoFim != null ? formatPercent(chegamAoFim) : '—'}
                  headlineLabel="chegam ao fim da grade"
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
                <TabelaCard
                  icon={AwardIcon}
                  title="Tempo até o certificado"
                  headline={cursoMediano != null ? formatDecimal(cursoMediano) : '—'}
                  headlineLabel="dias na formação mediana"
                  description="Mediana de dias entre a 1ª aula iniciada e o certificado · cursos com 20+ certificados · 0 = concluído no mesmo dia · o número acima é a formação do meio da lista, não uma média"
                  isLoading={jornada.isLoading}
                  isError={jornada.isError}
                  onRetry={() => void jornada.refetch()}
                >
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
                </TabelaCard>

              </BentoItem>

              <BentoItem span={6}>
                <TabelaCard
                  icon={StarIcon}
                  title="NPS por formação"
                  headline={
                    piorNps?.pct_detratores != null ? formatPercent(piorNps.pct_detratores) : '—'
                  }
                  headlineLabel="de detratores na pior formação"
                  description="Escala 0–10 por aula, agregado por curso · 10+ respostas · média geral 9,5 tem viés de positividade — o sinal está nos detratores"
                  isLoading={nps.isLoading}
                  isError={nps.isError}
                  onRetry={() => void nps.refetch()}
                >
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
                </TabelaCard>
              </BentoItem>
            </BentoGrid>
          ),
        }}
      />
    </div>
  )
}
