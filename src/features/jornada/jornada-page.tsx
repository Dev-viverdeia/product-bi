import { useMemo, useState } from 'react'
import {
  ArrowLeftRightIcon,
  DoorOpenIcon,
  LayersIcon,
  LogOutIcon,
  ScanSearchIcon,
} from 'lucide-react'
import { BentoCabecalho, BentoGrid, BentoItem } from '@/components/layout/bento'
import { ModuloTabs } from '@/components/layout/modulo-tabs'
import { TabelaCard } from '@/components/tabela/tabela-card'
import { TabelaLonga } from '@/components/tabela/tabela-longa'

import { CategoryBarChart, ChartCard, KpiCard, KpiGrid } from '@/components/charts'
import { PeriodoFiltro, type Periodo } from '@/components/filters/periodo-filtro'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TableCell, TableHead, TableRow } from '@/components/ui/table'
import { formatDecimal, formatInt, formatPercent } from '@/lib/format'
import { LIMITE_LISTA } from '@/lib/rpc'
import {
  useFluxoDaTela,
  useJornadaKpis,
  usePontosSaida,
  usePortasEntrada,
  useProfundidadeSessao,
  useRaioXTelas,
} from '@/features/jornada/queries'

function tintaPct(pct: number | null, teto = 0.5) {
  if (pct == null) return undefined
  const alfa = Math.min(pct / teto, 1) * 0.45
  return {
    background: `color-mix(in oklab, var(--color-data-1) ${Math.round(alfa * 100)}%, transparent)`,
  }
}

export function JornadaPage() {
  const [periodo, setPeriodo] = useState<Periodo>(30)
  const [telaSelecionada, setTelaSelecionada] = useState('/solucoes')

  const kpis = useJornadaKpis(periodo)
  const raioX = useRaioXTelas(periodo)
  const fluxo = useFluxoDaTela(telaSelecionada, periodo)
  const entradas = usePortasEntrada(periodo)
  const saidas = usePontosSaida(periodo)
  const profundidade = useProfundidadeSessao(periodo)

  // Raio-x e fluxo podem vir cortados em LIMITE_LISTA; por isso lidero pela
  // primeira linha (que a ordenação garante) e nunca por um total somado.
  const telaMaisVista = raioX.data?.[0] ?? null
  const destinoLider = fluxo.data?.[0] ?? null
  const portaLider = entradas.data?.[0] ?? null
  const saidaLider = saidas.data?.[0] ?? null

  // Exploração: sessões que passaram de uma tela só.
  const exploram = useMemo(() => {
    const faixas = profundidade.data ?? []
    const total = faixas.reduce((soma, p) => soma + p.sessoes, 0)
    if (total === 0) return null
    const umaTela = faixas.find((p) => p.faixa.startsWith('1'))?.sessoes ?? 0
    return (total - umaTela) / total
  }, [profundidade.data])

  return (
    <div className="space-y-4">
      {/* Fora das abas: contexto do módulo inteiro. Trocar de aba não pode
          custar o número de referência nem obrigar a reajustar o período. */}
      <BentoGrid>
        <BentoCabecalho>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Jornada & Telas</h2>
            <p className="text-muted-foreground text-sm">
              Raio-x por tela para sustentar decisões de redesign · sessão = navegação com
              intervalo menor que 30 min · rotas com identificador são agrupadas em padrão
            </p>
          </div>
          <PeriodoFiltro valor={periodo} onChange={setPeriodo} />
        </BentoCabecalho>

        <BentoItem span={12}>
          <KpiGrid>
            <KpiCard
              label="Sessões"
              value={kpis.data?.sessoes ?? 0}
              format={formatInt}
              isLoading={kpis.isLoading}
              isError={kpis.isError}
            />
            <KpiCard
              label="Telas por sessão"
              value={kpis.data?.telas_por_sessao ?? 0}
              format={formatDecimal}
              isLoading={kpis.isLoading}
              isError={kpis.isError}
            />
            <KpiCard
              label="Duração mediana (min)"
              value={kpis.data?.minutos_medianos ?? 0}
              format={formatDecimal}
              isLoading={kpis.isLoading}
              isError={kpis.isError}
            />
            <KpiCard
              label="Sessões de tela única"
              value={kpis.data?.pct_uma_tela ?? 0}
              format={formatPercent}
              isLoading={kpis.isLoading}
              isError={kpis.isError}
            />
          </KpiGrid>
        </BentoItem>
      </BentoGrid>

      <ModuloTabs
        rota="/jornada"
        conteudos={{
          telas: (
            <BentoGrid>
              <BentoItem span={12}>
                <TabelaCard
                  icon={ScanSearchIcon}
                  title="Raio-x das telas"
                  headline={telaMaisVista ? formatInt(telaMaisVista.pageviews) : '—'}
                  headlineLabel={
                    telaMaisVista ? `pageviews na líder (${telaMaisVista.tela})` : undefined
                  }
                  description="% entrada = a tela abriu a sessão (deep link ou destino habitual) · % saída = a sessão terminou nela · posição média = em que ponto da navegação ela aparece"
                  isLoading={raioX.isLoading}
                  isError={raioX.isError}
                  onRetry={() => void raioX.refetch()}
                >
                  <TabelaLonga
                    linhas={raioX.data ?? []}
                    limiteDaFonte={LIMITE_LISTA}
                    chave={(t) => String(t.tela)}
                    buscarEm={(t) => [t.tela]}
                    rotuloBusca="Buscar por tela"
                    cabecalho={
                      <TableRow>
                        <TableHead>Tela</TableHead>
                        <TableHead className="text-right">Pageviews</TableHead>
                        <TableHead className="text-right">Usuários</TableHead>
                        <TableHead className="text-right">% entrada</TableHead>
                        <TableHead className="text-right">% saída</TableHead>
                        <TableHead className="text-right">Posição média</TableHead>
                      </TableRow>
                    }
                    renderLinha={(t) => (
                      <TableRow>
                        <TableCell className="font-mono text-xs">{t.tela}</TableCell>
                        <TableCell className="num text-right">{formatInt(t.pageviews)}</TableCell>
                        <TableCell className="num text-right">{formatInt(t.usuarios)}</TableCell>
                        <TableCell className="num text-right" style={tintaPct(t.pct_entrada, 0.25)}>
                          {t.pct_entrada != null ? formatPercent(t.pct_entrada) : '—'}
                        </TableCell>
                        <TableCell className="num text-right" style={tintaPct(t.pct_saida, 0.3)}>
                          {t.pct_saida != null ? formatPercent(t.pct_saida) : '—'}
                        </TableCell>
                        <TableCell className="num text-right">
                          {t.posicao_media != null ? formatDecimal(t.posicao_media) : '—'}
                        </TableCell>
                      </TableRow>
                    )}
                  />
                </TabelaCard>
              </BentoItem>

              <BentoItem span={12}>
                <TabelaCard
                  icon={ArrowLeftRightIcon}
                  title="Para onde vão a partir de uma tela"
                  headline={destinoLider?.pct != null ? formatPercent(destinoLider.pct) : '—'}
                  headlineLabel={destinoLider ? `vão para ${destinoLider.destino}` : undefined}
                  /* o seletor ocupa a afordância à direita: aqui a escolha da tela
                     é a ação do card, mais útil que o botão de definição */
                  action={
                    <Select value={telaSelecionada} onValueChange={setTelaSelecionada}>
                      <SelectTrigger className="w-full sm:w-64">
                        <SelectValue placeholder="Escolha uma tela" />
                      </SelectTrigger>
                      <SelectContent>
                        {(raioX.data ?? []).map((t) => (
                          <SelectItem key={t.tela} value={t.tela}>
                            {t.tela}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  }
                  isLoading={fluxo.isLoading}
                  isError={fluxo.isError}
                  onRetry={() => void fluxo.refetch()}
                >
                  <TabelaLonga
                    linhas={fluxo.data ?? []}
                    chave={(f) => f.destino}
                    buscarEm={(f) => [f.destino]}
                    rotuloBusca="Buscar destino"
                    vazio="Nenhuma transição registrada a partir desta tela."
                    cabecalho={
                      <TableRow>
                        <TableHead>Destino</TableHead>
                        <TableHead className="text-right">Transições</TableHead>
                        <TableHead className="text-right">% do total</TableHead>
                      </TableRow>
                    }
                    renderLinha={(f) => (
                      <TableRow>
                        <TableCell className="font-mono text-xs">{f.destino}</TableCell>
                        <TableCell className="num text-right">{formatInt(f.transicoes)}</TableCell>
                        <TableCell className="num text-right" style={tintaPct(f.pct)}>
                          {f.pct != null ? formatPercent(f.pct) : '—'}
                        </TableCell>
                      </TableRow>
                    )}
                  />
                </TabelaCard>
              </BentoItem>
            </BentoGrid>
          ),
          fluxos: (
            <BentoGrid>
              <BentoItem span={6}>
                <ChartCard
                  icon={DoorOpenIcon}
                  title="Portas de entrada"
                  headline={portaLider ? formatInt(portaLider.sessoes) : '—'}
                  headlineLabel={portaLider ? `sessões abrem em ${portaLider.tela}` : undefined}
                  description="Primeira tela da sessão — por onde o cliente realmente chega"
                  isLoading={entradas.isLoading}
                  isError={entradas.isError}
                  onRetry={() => void entradas.refetch()}
                  isEmpty={entradas.data?.length === 0}
                >
                  <CategoryBarChart
                    layout="bar"
                    label="Sessões"
                    data={(entradas.data ?? []).map((e) => ({
                      category: e.tela,
                      value: e.sessoes,
                    }))}
                    valueFormatter={formatInt}
                    className="h-[320px]"
                  />
                </ChartCard>

              </BentoItem>

              <BentoItem span={6}>
                <ChartCard
                  icon={LogOutIcon}
                  title="Onde a sessão morre"
                  headline={saidaLider ? formatInt(saidaLider.saidas) : '—'}
                  headlineLabel={saidaLider ? `saídas em ${saidaLider.tela}` : undefined}
                  description="Última tela em sessões com 2+ telas — visita de tela única não conta"
                  isLoading={saidas.isLoading}
                  isError={saidas.isError}
                  onRetry={() => void saidas.refetch()}
                  isEmpty={saidas.data?.length === 0}
                >
                  <CategoryBarChart
                    layout="bar"
                    label="Saídas"
                    data={(saidas.data ?? []).map((s) => ({
                      category: s.tela,
                      value: s.saidas,
                    }))}
                    valueFormatter={formatInt}
                    className="h-[320px]"
                  />
                </ChartCard>
              </BentoItem>

              <BentoItem span={12}>
                <ChartCard
                  tone="brand"
                  icon={LayersIcon}
                  title="Profundidade das sessões"
                  headline={exploram != null ? formatPercent(exploram) : '—'}
                  headlineLabel="das sessões passam de uma tela"
                  description="Quantas telas o cliente visita por sessão — mede exploração vs visita pontual"
                  isLoading={profundidade.isLoading}
                  isError={profundidade.isError}
                  onRetry={() => void profundidade.refetch()}
                  isEmpty={profundidade.data?.length === 0}
                >
                  <CategoryBarChart
                    label="Sessões"
                    data={(profundidade.data ?? []).map((p) => ({
                      category: p.faixa,
                      value: p.sessoes,
                    }))}
                    valueFormatter={formatInt}
                    className="h-[260px]"
                  />
                </ChartCard>
              </BentoItem>
            </BentoGrid>
          ),
        }}
      />
    </div>
  )
}
