import { useMemo, useState } from 'react'
import { BugIcon, ListChecksIcon, LogInIcon, SlidersHorizontalIcon, TimerIcon, UserPlusIcon } from 'lucide-react'
import { BentoGrid, BentoItem } from '@/components/layout/bento'
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
import { formatInt, formatPercent } from '@/lib/format'
import { fundoIntensidade } from '@/lib/intensidade'
import { LIMITE_LISTA } from '@/lib/rpc'
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

  // A última etapa do funil é a que responde o card: de tudo que entrou, quanto
  // chegou até agir. As demais linhas contam o caminho.
  const chegamNaPrimeiraAcao = funil.data?.at(-1)?.pct_do_inicio ?? null

  // Faixa modal — a resposta de "quanto tempo demoram" é onde a maioria cai.
  const faixaModal = useMemo(() => {
    const faixas = tempo.data ?? []
    if (faixas.length === 0) return null
    const maior = faixas.reduce((a, b) => (b.clientes > a.clientes ? b : a))
    const total = faixas.reduce((soma, t) => soma + t.clientes, 0)
    return total > 0 ? { faixa: maior.faixa, parte: maior.clientes / total } : null
  }, [tempo.data])

  const incompletos = useMemo(
    () => (onboarding.data ?? []).reduce((soma, o) => soma + o.clientes, 0),
    [onboarding.data],
  )

  // Categoria dominante do erro de login. O denominador é o conjunto inteiro
  // que a RPC devolve (não há corte), então a fatia é honesta.
  const erroDominante = useMemo(() => {
    const cats = errosLogin.data ?? []
    if (cats.length === 0) return null
    const maior = cats.reduce((a, b) => (b.ocorrencias > a.ocorrencias ? b : a))
    const total = cats.reduce((soma, e) => soma + e.ocorrencias, 0)
    return total > 0 ? { categoria: maior.categoria, parte: maior.ocorrencias / total } : null
  }, [errosLogin.data])

  // Lista de erros por tela pode vir cortada em LIMITE_LISTA, então nada de
  // somar: a pior tela vem primeiro e não depende do corte.
  const piorTela = errosTela.data?.[0] ?? null

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
              isError={kpis.isError}
            />
            <KpiCard
              label="Conversão convite → cadastro"
              value={kpis.data?.conversao ?? 0}
              format={formatPercent}
              isLoading={kpis.isLoading}
              isError={kpis.isError}
            />
            <KpiCard
              label="Onboarding concluído (dos cadastrados)"
              value={kpis.data?.onboarding_pct ?? 0}
              format={formatPercent}
              isLoading={kpis.isLoading}
              isError={kpis.isError}
            />
            <KpiCard
              label="Erros de login"
              value={kpis.data?.erros_login ?? 0}
              format={formatInt}
              isLoading={kpis.isLoading}
              isError={kpis.isError}
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
                <TabelaCard
                  icon={SlidersHorizontalIcon}
                  title="Funil de entrada"
                  headline={
                    chegamNaPrimeiraAcao != null ? formatPercent(chegamNaPrimeiraAcao) : '—'
                  }
                  headlineLabel="dos convites chegam à 1ª ação"
                  description={`Safra: convites criados nos últimos ${periodo} dias, acompanhados até a 1ª ação · convites deletados fora · etapa de envio não aparece: o rastreamento de entrega da plataforma parou em abr/2026 (registrado para reporte)`}
                  isLoading={funil.isLoading}
                  isError={funil.isError}
                  onRetry={() => void funil.refetch()}
                  linhasEsqueleto={4}
                >
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
                          <TableCell
                            className="num text-right"
                            style={fundoIntensidade(f.pct_do_inicio)}
                          >
                            {f.pct_do_inicio != null ? formatPercent(f.pct_do_inicio) : '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TabelaCard>
              </BentoItem>

              <BentoItem span={4}>
                <ChartCard
                  tone="brand"
                  icon={TimerIcon}
                  title="Tempo até a 1ª ação"
                  headline={faixaModal ? formatPercent(faixaModal.parte) : '—'}
                  headlineLabel={faixaModal ? `em "${faixaModal.faixa}"` : undefined}
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
                  icon={ListChecksIcon}
                  title="Onde os incompletos param"
                  headline={formatInt(incompletos)}
                  headlineLabel="não concluíram o onboarding"
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
                <TabelaCard
                  icon={UserPlusIcon}
                  title="Masters × convites"
                  headline={
                    mastersResumo.data
                      ? formatPercent(mastersResumo.data.pct_convidam ?? 0)
                      : '—'
                  }
                  headlineLabel="dos masters já convidaram alguém"
                  description={
                    mastersResumo.data
                      ? `${formatInt(mastersResumo.data.masters_total)} masters, dos quais ${formatInt(mastersResumo.data.masters_convidaram)} já convidaram · conversão dos convites de masters: ${formatPercent(mastersResumo.data.conversao_convites ?? 0)} · histórico completo`
                      : 'Quem traz gente para dentro — histórico completo'
                  }
                  isLoading={mastersTop.isLoading}
                  isError={mastersTop.isError}
                  onRetry={() => void mastersTop.refetch()}
                >
                  <TabelaLonga
                    linhas={mastersTop.data ?? []}
                    limiteDaFonte={LIMITE_LISTA}
                    chave={(m) => String(m.email)}
                    buscarEm={(m) => [m.nome, m.email]}
                    rotuloBusca="Buscar por nome ou e-mail"
                    cabecalho={
                      <TableRow>
                        <TableHead>Master</TableHead>
                        <TableHead>Organização</TableHead>
                        <TableHead className="text-right">Convites</TableHead>
                        <TableHead className="text-right">Usados</TableHead>
                        <TableHead className="text-right">Conversão</TableHead>
                      </TableRow>
                    }
                    renderLinha={(m) => (
                      <TableRow>
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
                    )}
                  />
                </TabelaCard>
              </BentoItem>
            </BentoGrid>
          ),
          porta: (
            <BentoGrid>
              <BentoItem span={6}>
                <ChartCard
                  icon={LogInIcon}
                  title="Erros de login por categoria"
                  headline={erroDominante ? formatPercent(erroDominante.parte) : '—'}
                  headlineLabel={erroDominante ? `em ${erroDominante.categoria}` : undefined}
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
                <TabelaCard
                  icon={BugIcon}
                  title="Erros de JavaScript por tela"
                  headline={piorTela ? formatInt(piorTela.ocorrencias) : '—'}
                  headlineLabel={piorTela ? `na pior tela (${piorTela.tela})` : undefined}
                  description={`client_error_logs · últimos ${periodo} dias · onde o cliente sofre`}
                  isLoading={errosTela.isLoading}
                  isError={errosTela.isError}
                  onRetry={() => void errosTela.refetch()}
                >
                  <TabelaLonga
                    linhas={errosTela.data ?? []}
                    limiteDaFonte={LIMITE_LISTA}
                    chave={(e) => String(e.tela)}
                    buscarEm={(e) => [e.tela]}
                    rotuloBusca="Buscar por tela"
                    cabecalho={
                      <TableRow>
                        <TableHead>Tela</TableHead>
                        <TableHead className="text-right">Ocorrências</TableHead>
                      </TableRow>
                    }
                    renderLinha={(e) => (
                      <TableRow>
                        <TableCell className="font-mono text-xs">{e.tela}</TableCell>
                        <TableCell className="num text-right">{formatInt(e.ocorrencias)}</TableCell>
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
