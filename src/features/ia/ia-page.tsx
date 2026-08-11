import { useMemo, useState } from 'react'
import { BotIcon, MessageSquareIcon, RepeatIcon, ShieldCheckIcon, WrenchIcon } from 'lucide-react'
import { BentoCabecalho, BentoGrid, BentoItem } from '@/components/layout/bento'
import { ModuloTabs } from '@/components/layout/modulo-tabs'
import { TabelaCard } from '@/components/tabela/tabela-card'
import { TabelaLonga } from '@/components/tabela/tabela-longa'

import { CategoryBarChart, ChartCard, KpiCard, KpiGrid } from '@/components/charts'
import { PeriodoFiltro, type Periodo } from '@/components/filters/periodo-filtro'
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

  const ferramentaLider = useMemo(() => {
    const fs = adocao.data ?? []
    return fs.length > 0 ? fs.reduce((a, b) => (b.usuarios > a.usuarios ? b : a)) : null
  }, [adocao.data])

  // Recorrência é sobre hábito: interessa quem passou da faixa de um dia só.
  const voltamOutroDia = useMemo(() => {
    const faixas = recorrencia.data ?? []
    const total = faixas.reduce((soma, r) => soma + r.usuarios, 0)
    if (total === 0) return null
    const umDia = faixas.find((r) => r.faixa.startsWith('1'))?.usuarios ?? 0
    return (total - umDia) / total
  }, [recorrencia.data])

  const modoLider = useMemo(() => {
    const ms = modos.data ?? []
    if (ms.length === 0) return null
    const maior = ms.reduce((a, b) => (b.threads > a.threads ? b : a))
    const total = ms.reduce((soma, m) => soma + m.threads, 0)
    return total > 0 ? { modo: maior.modo, parte: maior.threads / total } : null
  }, [modos.data])

  // O card das etapas do Builder é sobre atrito: a etapa que mais falha.
  const etapaMaisFragil = useMemo(() => {
    const es = (steps.data ?? []).filter((e) => e.pct_erro != null)
    if (es.length === 0) return null
    return es.reduce((a, b) => ((b.pct_erro ?? 0) > (a.pct_erro ?? 0) ? b : a))
  }, [steps.data])

  return (
    <div className="space-y-4">
      {/* Fora das abas: contexto do módulo inteiro. Trocar de aba não pode
          custar o número de referência nem obrigar a reajustar o período. */}
      <BentoGrid>
        <BentoCabecalho>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Consultor & Builder</h2>
            <p className="text-muted-foreground text-sm">
              Adoção, recorrência e confiabilidade das ferramentas de IA · Consultor
              rastreado desde mai/2026 (lançamento)
            </p>
          </div>
          <PeriodoFiltro valor={periodo} onChange={setPeriodo} />
        </BentoCabecalho>

        <BentoItem span={12}>
          <KpiGrid>
            <KpiCard
              label="Usuários do Consultor"
              value={kpis.data?.usuarios_consultor ?? null}
              format={formatInt}
              isLoading={kpis.isLoading}
              isError={kpis.isError}
            />
            <KpiCard
              label="Mensagens enviadas"
              value={kpis.data?.mensagens_consultor ?? null}
              format={formatInt}
              isLoading={kpis.isLoading}
              isError={kpis.isError}
            />
            <KpiCard
              label="Usuários do Builder"
              value={kpis.data?.usuarios_builder ?? null}
              format={formatInt}
              isLoading={kpis.isLoading}
              isError={kpis.isError}
            />
            <KpiCard
              label="Soluções geradas"
              value={kpis.data?.solucoes_builder ?? null}
              format={formatInt}
              isLoading={kpis.isLoading}
              isError={kpis.isError}
            />
          </KpiGrid>
        </BentoItem>
      </BentoGrid>

      <ModuloTabs
        rota="/ia"
        conteudos={{
          adocao: (
            <BentoGrid>
              <BentoItem span={6}>
                <ChartCard
                  icon={BotIcon}
                  title="Adoção entre clientes ativos"
                  headline={ferramentaLider ? formatInt(ferramentaLider.usuarios) : '—'}
                  headlineLabel={ferramentaLider ? `em ${ferramentaLider.ferramenta}` : undefined}
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

              </BentoItem>

              <BentoItem span={6}>
                <ChartCard
                  icon={RepeatIcon}
                  title="Recorrência do Consultor"
                  headline={voltamOutroDia != null ? formatPercent(voltamOutroDia) : '—'}
                  headlineLabel="voltam em mais de um dia"
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
              </BentoItem>
            </BentoGrid>
          ),
          uso: (
            <BentoGrid>
              <BentoItem span={8}>
                <ChartCard
                  tone="brand"
                  icon={MessageSquareIcon}
                  title="Modos do Consultor"
                  headline={modoLider ? formatPercent(modoLider.parte) : '—'}
                  headlineLabel={modoLider ? `em ${modoLider.modo}` : undefined}
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

              </BentoItem>

              <BentoItem span={4}>
                <TabelaCard
                  icon={WrenchIcon}
                  title="Builder — confiabilidade por etapa"
                  headline={
                    etapaMaisFragil?.pct_erro != null
                      ? `${formatDecimal(etapaMaisFragil.pct_erro)}%`
                      : '—'
                  }
                  headlineLabel={
                    etapaMaisFragil ? `de erro na etapa mais frágil (${etapaMaisFragil.step})` : undefined
                  }
                  description="Gerações dos últimos 90 dias · ordenado pelas etapas mais lentas · erro alto ou tempo alto = atrito na experiência"
                  isLoading={steps.isLoading}
                  isError={steps.isError}
                  onRetry={() => void steps.refetch()}
                >
                  <TabelaLonga
                    linhas={steps.data ?? []}
                    chave={(s) => s.step}
                    buscarEm={(s) => [s.step]}
                    rotuloBusca="Buscar etapa"
                    vazio="Nenhuma geração registrada nos últimos 90 dias."
                    cabecalho={
                      <TableRow>
                        <TableHead>Etapa</TableHead>
                        <TableHead className="text-right">Gerações</TableHead>
                        <TableHead className="text-right">Erro</TableHead>
                        <TableHead className="text-right">Tempo médio</TableHead>
                      </TableRow>
                    }
                    renderLinha={(s) => (
                      <TableRow>
                        <TableCell className="font-mono text-xs">{s.step}</TableCell>
                        <TableCell className="num text-right">{formatInt(s.geracoes)}</TableCell>
                        <TableCell className="num text-right">
                          {s.pct_erro != null ? `${formatDecimal(s.pct_erro)}%` : '—'}
                        </TableCell>
                        <TableCell className="num text-right">
                          {s.segundos_medio != null ? `${formatDecimal(s.segundos_medio)}s` : '—'}
                        </TableCell>
                      </TableRow>
                    )}
                  />
                </TabelaCard>
              </BentoItem>
            </BentoGrid>
          ),
          impacto: (
            <BentoGrid>
              <BentoItem span={12}>
                <TabelaCard
                  icon={ShieldCheckIcon}
                  title="Usar IA na 1ª semana muda a retenção?"
                  headline={lift ? `${formatDecimal(lift)}×` : '—'}
                  headlineLabel="de lift na retenção entre 30 e 60 dias"
                  description="Clientes que entraram a partir do lançamento do Consultor (11/mai/2026) e já têm 60+ dias de casa · retenção medida entre os dias 30 e 60 · correlação, não causalidade"
                  isLoading={impacto.isLoading}
                  isError={impacto.isError}
                  onRetry={() => void impacto.refetch()}
                  linhasEsqueleto={2}
                >
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
                </TabelaCard>
              </BentoItem>
            </BentoGrid>
          ),
        }}
      />
    </div>
  )
}
