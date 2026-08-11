import { useMemo, useState } from 'react'
import {
  AlertTriangleIcon,
  CalendarCheckIcon,
  LayersIcon,
  LightbulbIcon,
  LogOutIcon,
  ShieldCheckIcon,
  SkullIcon,
  StarIcon,
  UsersRoundIcon,
} from 'lucide-react'
import { BentoGrid, BentoItem } from '@/components/layout/bento'
import { ModuloTabs } from '@/components/layout/modulo-tabs'
import { TabelaCard } from '@/components/tabela/tabela-card'
import { TabelaLonga } from '@/components/tabela/tabela-longa'

import { CategoryBarChart, ChartCard, KpiCard, KpiGrid } from '@/components/charts'
import { PeriodoFiltro, type Periodo } from '@/components/filters/periodo-filtro'
import { StatusPill } from '@/components/ui-marca/status-pill'
import { TableCell, TableHead, TableRow } from '@/components/ui/table'
import {
  formatDateShort,
  formatDecimal,
  formatInt,
  formatPercent,
} from '@/lib/format'
import { labelTipoEvento } from '@/lib/labels-plataforma'
import { CohortTable } from '@/features/clientes/cohort-table'
import { LIMITE_LISTA } from '@/lib/rpc'
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

  // A safra mais recente com janela de 90 dias fechada é a leitura honesta de
  // retenção: as safras mais novas ainda têm "—" e enganariam para cima.
  const cohortMaduro = useMemo(
    () => (cohort.data ?? []).find((c) => c.ret_90d != null) ?? null,
    [cohort.data],
  )

  const ultimoModulo = useMemo(() => {
    const ms = churnUltimo.data ?? []
    if (ms.length === 0) return null
    const maior = ms.reduce((a, b) => (b.clientes > a.clientes ? b : a))
    const total = ms.reduce((soma, m) => soma + m.clientes, 0)
    return total > 0 ? { modulo: maior.modulo, parte: maior.clientes / total } : null
  }, [churnUltimo.data])

  // Frequência e amplitude respondem "quantos usam de verdade": em ambos, o
  // sinal é quem passou do mínimo, não a faixa mais cheia.
  const alemDeUmDia = useMemo(() => {
    const fs = diasAtivos.data ?? []
    const total = fs.reduce((soma, d) => soma + d.clientes, 0)
    if (total === 0) return null
    const umDia = fs.find((d) => d.faixa.startsWith('1'))?.clientes ?? 0
    return (total - umDia) / total
  }, [diasAtivos.data])

  const multiModulo = useMemo(() => {
    const as = amplitude.data ?? []
    const total = as.reduce((soma, a) => soma + a.clientes, 0)
    if (total === 0) return null
    const varios = as.filter((a) => a.modulos > 1).reduce((soma, a) => soma + a.clientes, 0)
    return varios / total
  }, [amplitude.data])

  // Listas de ação podem vir cortadas em LIMITE_LISTA: lidero pela primeira
  // linha, que a ordenação garante, nunca por um total somado.
  const piorGap = useMemo(() => {
    const ms = (churnModulos.data ?? []).filter((m) => m.gap_pp != null)
    if (ms.length === 0) return null
    return ms.reduce((a, b) => ((b.gap_pp ?? 0) > (a.gap_pp ?? 0) ? b : a))
  }, [churnModulos.data])

  const melhorSinal = useMemo(() => {
    const as = (aha.data ?? []).filter((a) => a.lift != null)
    if (as.length === 0) return null
    return as.reduce((a, b) => ((b.lift ?? 0) > (a.lift ?? 0) ? b : a))
  }, [aha.data])

  const retencaoTopo = useMemo(() => {
    const rs = (retencaoAmplitude.data ?? []).filter((r) => r.pct_retidos != null)
    if (rs.length === 0) return null
    return rs.reduce((a, b) => (b.modulos > a.modulos ? b : a))
  }, [retencaoAmplitude.data])

  return (
    <div className="space-y-4">
      {/* Fora das abas: contexto do módulo inteiro. Trocar de aba não pode
          custar o número de referência nem obrigar a reajustar o período. */}
      <BentoGrid>
        <BentoItem span={12} className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Clientes & Retenção</h2>
            <p className="text-muted-foreground text-sm">
              Régua: cliente ativo = 1+ ação de produto no dia · eventos desde mai/2025
            </p>
          </div>
          <PeriodoFiltro valor={periodo} onChange={setPeriodo} />
        </BentoItem>

        <BentoItem span={12}>
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
        </BentoItem>
      </BentoGrid>

      <ModuloTabs
        rota="/clientes"
        conteudos={{
          retencao: (
            <BentoGrid>
              <BentoItem span={12}>
                <TabelaCard
                  icon={CalendarCheckIcon}
                  title="Retenção por cohort de entrada"
                  headline={
                    cohortMaduro?.ret_90d != null ? formatPercent(cohortMaduro.ret_90d) : '—'
                  }
                  headlineLabel="aos 90 dias na safra madura mais recente"
                  description="% de clientes ativos na janela após a entrada · “—” = janela ainda não completa, por isso o número acima usa a safra mais recente com 90 dias fechados · atenção: a régua de atividade ganhou novos tipos de evento ao longo do tempo (Builder out/25, Soluções abr/26, Consultor mai/26) — parte da melhora entre cohorts distantes é instrumentação"
                  isLoading={cohort.isLoading}
                  isError={cohort.isError}
                  onRetry={() => void cohort.refetch()}
                >
                  <CohortTable linhas={cohort.data ?? []} />
                </TabelaCard>
              </BentoItem>

              <BentoItem span={4}>
                <ChartCard
                  className="lg:col-span-2"
                  icon={LogOutIcon}
                  title="Onde a jornada termina"
                  headline={ultimoModulo ? formatPercent(ultimoModulo.parte) : '—'}
                  headlineLabel={ultimoModulo ? `param em ${ultimoModulo.modulo}` : undefined}
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
              </BentoItem>

              <BentoItem span={4}>
                <ChartCard
                  icon={UsersRoundIcon}
                  title="Frequência de uso"
                  headline={alemDeUmDia != null ? formatPercent(alemDeUmDia) : '—'}
                  headlineLabel="ativos em mais de um dia"
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

              </BentoItem>

              <BentoItem span={4}>
                <ChartCard
                  tone="brand"
                  icon={LayersIcon}
                  title="Amplitude de uso"
                  headline={multiModulo != null ? formatPercent(multiModulo) : '—'}
                  headlineLabel="usam mais de um módulo"
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
              </BentoItem>
            </BentoGrid>
          ),
          risco: (
            <BentoGrid>
              <BentoItem span={12}>
                <TabelaCard
                  icon={AlertTriangleIcon}
                  title="Clientes em risco — lista para ação"
                  headline={formatInt((risco.data ?? []).length)}
                  headlineLabel="clientes na lista"
                  description="Inatividade: era ativo e está 14+ dias em silêncio · Plano vencendo: contrato expira em ≤30 dias sem uso recente do master"
                  isLoading={risco.isLoading}
                  isError={risco.isError}
                  onRetry={() => void risco.refetch()}
                >
                  <TabelaLonga
                    linhas={risco.data ?? []}
                    limiteDaFonte={LIMITE_LISTA}
                    chave={(r) => String(r.email)}
                    buscarEm={(r) => [r.nome, r.email, r.organizacao]}
                    rotuloBusca="Buscar por nome, e-mail ou organização"
                    cabecalho={
                      <TableRow>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Organização</TableHead>
                        <TableHead>Plano</TableHead>
                        <TableHead>Motivo</TableHead>
                        <TableHead className="text-right">Última atividade</TableHead>
                        <TableHead className="text-right">Dias inativo</TableHead>
                        <TableHead className="text-right">Vence em</TableHead>
                      </TableRow>
                    }
                    renderLinha={(r) => (
                      <TableRow>
                        <TableCell>
                          <div className="font-medium">{r.nome ?? '—'}</div>
                          <div className="text-muted-foreground text-xs">{r.email}</div>
                        </TableCell>
                        <TableCell>{r.organizacao ?? '—'}</TableCell>
                        <TableCell>{r.plano ?? '—'}</TableCell>
                        <TableCell>
                          {/* dois motivos com urgências diferentes saíam no mesmo cinza —
                              silêncio de 14 dias é o caso crítico, plano vencendo ainda dá tempo */}
                          <StatusPill tom={r.motivo === 'plano_vencendo' ? 'atencao' : 'critico'}>
                            {r.motivo === 'plano_vencendo' ? 'Plano vencendo' : 'Inatividade'}
                          </StatusPill>
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
                    )}
                  />
                </TabelaCard>
              </BentoItem>

              <BentoItem span={8}>
                <TabelaCard
                  className="lg:col-span-3"
                  icon={SkullIcon}
                  title="Autópsia de churn — módulos nunca usados"
                  headline={piorGap?.gap_pp != null ? `${formatDecimal(piorGap.gap_pp)} pp` : '—'}
                  headlineLabel={piorGap ? `de gap no maior (${piorGap.modulo})` : undefined}
                  description={
                    churnResumo.data
                      ? `${formatInt(churnResumo.data.churned)} clientes em churn (60+ dias sem uso, ${formatPercent(churnResumo.data.pct_churn ?? 0)} da base histórica) · vida média de ${formatDecimal(churnResumo.data.vida_media_dias ?? 0)} dias · gap = diferença, em pontos percentuais, entre quem saiu e quem ficou`
                      : 'Quem saiu vs quem ficou: % que nunca usou cada módulo'
                  }
                  isLoading={churnModulos.isLoading}
                  isError={churnModulos.isError}
                  onRetry={() => void churnModulos.refetch()}
                >
                  <TabelaLonga
                    linhas={churnModulos.data ?? []}
                    chave={(m) => m.modulo}
                    buscarEm={(m) => [m.modulo]}
                    rotuloBusca="Buscar módulo"
                    vazio="Nenhum módulo com tracking cobrindo o período."
                    cabecalho={
                      <TableRow>
                        <TableHead>Módulo</TableHead>
                        <TableHead className="text-right">Churned nunca usou</TableHead>
                        <TableHead className="text-right">Ativos nunca usou</TableHead>
                        <TableHead className="text-right">Gap (pp)</TableHead>
                      </TableRow>
                    }
                    renderLinha={(m) => (
                      <TableRow>
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
                    )}
                  />
                </TabelaCard>

              </BentoItem>

              <BentoItem span={4}>
                <ChartCard
                  icon={ShieldCheckIcon}
                  title="Multi-módulo retém mais?"
                  headline={
                    retencaoTopo?.pct_retidos != null ? formatPercent(retencaoTopo.pct_retidos) : '—'
                  }
                  headlineLabel={
                    retencaoTopo
                      ? `ainda ativos com ${retencaoTopo.modulos} ${retencaoTopo.modulos === 1 ? 'módulo' : 'módulos'}`
                      : undefined
                  }
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
              </BentoItem>
            </BentoGrid>
          ),
          funciona: (
            <BentoGrid>
              <BentoItem span={12}>
                <TabelaCard
                  icon={LightbulbIcon}
                  title="Momento “aha” — o que a 1ª semana prevê"
                  headline={melhorSinal?.lift != null ? `${formatDecimal(melhorSinal.lift)}×` : '—'}
                  headlineLabel={
                    melhorSinal ? `no melhor sinal (${labelTipoEvento(melhorSinal.acao)})` : undefined
                  }
                  description="Ação nos primeiros 7 dias × retenção aos 90 dias (clientes com 120+ dias de casa) · correlação, não causalidade — validar com experimento · só ações com tracking cobrindo todo o período aparecem"
                  isLoading={aha.isLoading}
                  isError={aha.isError}
                  onRetry={() => void aha.refetch()}
                >
                  <TabelaLonga
                    linhas={aha.data ?? []}
                    chave={(a) => a.acao}
                    buscarEm={(a) => [labelTipoEvento(a.acao), a.acao]}
                    rotuloBusca="Buscar ação"
                    vazio="Nenhuma ação com tracking cobrindo todo o período."
                    cabecalho={
                      <TableRow>
                        <TableHead>Ação na 1ª semana</TableHead>
                        <TableHead className="text-right">Fizeram</TableHead>
                        <TableHead className="text-right">Retenção 90d</TableHead>
                        <TableHead className="text-right">Não fizeram</TableHead>
                        <TableHead className="text-right">Retenção 90d</TableHead>
                        <TableHead className="text-right">Lift</TableHead>
                      </TableRow>
                    }
                    renderLinha={(a) => (
                      <TableRow>
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
                    )}
                  />
                </TabelaCard>
              </BentoItem>

              <BentoItem span={12}>
                <TabelaCard
                  icon={StarIcon}
                  title="Power users"
                  headline={formatInt((powerUsers.data ?? []).length)}
                  headlineLabel="clientes na lista"
                  description={`Top clientes por engajamento · últimos ${periodo} dias · fonte de cases, depoimentos e beta testers`}
                  isLoading={powerUsers.isLoading}
                  isError={powerUsers.isError}
                  onRetry={() => void powerUsers.refetch()}
                >
                  <TabelaLonga
                    linhas={powerUsers.data ?? []}
                    limiteDaFonte={LIMITE_LISTA}
                    chave={(u) => String(u.email)}
                    buscarEm={(u) => [u.nome, u.email, u.organizacao]}
                    rotuloBusca="Buscar por nome, e-mail ou organização"
                    cabecalho={
                      <TableRow>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Organização</TableHead>
                        <TableHead>Plano</TableHead>
                        <TableHead className="text-right">Dias ativos</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                        <TableHead className="text-right">Módulos</TableHead>
                      </TableRow>
                    }
                    renderLinha={(u) => (
                      <TableRow>
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
