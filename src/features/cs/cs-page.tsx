import { useMemo, useState } from 'react'
import {
  BotIcon,
  ClipboardCheckIcon,
  HeadphonesIcon,
  HeartCrackIcon,
  MessageCircleIcon,
  RadioTowerIcon,
  RotateCcwIcon,
  SendIcon,
  ShieldQuestionIcon,
  UserRoundCheckIcon,
} from 'lucide-react'

import { CategoryBarChart, ChartCard, KpiCard, KpiGrid, TimeSeriesChart } from '@/components/charts'
import { PeriodoFiltro, type Periodo } from '@/components/filters/periodo-filtro'
import { BentoGrid, BentoItem } from '@/components/layout/bento'
import { ModuloTabs } from '@/components/layout/modulo-tabs'
import { TabelaCard } from '@/components/tabela/tabela-card'
import { TabelaLonga } from '@/components/tabela/tabela-longa'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { TableCell, TableHead, TableRow } from '@/components/ui/table'
import { formatCompact, formatDateShort, formatInt, formatMesAno, formatPercent } from '@/lib/format'
import {
  useAtendimentoCobertura,
  useAtendimentoIaHumano,
  useAtendimentoMensal,
  useAtendimentoPorAtendente,
  useAtendimentoPorCanal,
  useCancelamentoDesfecho,
  useCancelamentoMensal,
  useCancelamentoOrigem,
  useCsKpis,
  useDisparosMensal,
  useDisparosPorCanal,
  useFrescorCs,
  useFunilCs,
  useRetencaoCs,
} from '@/features/cs/queries'

const QUADRO_KICKOFF = 'Kickoff'
const QUADRO_REVERSAO = 'Reversão'

export function CsPage() {
  const [periodo, setPeriodo] = useState<Periodo>(30)

  const frescor = useFrescorCs()
  const kpis = useCsKpis(periodo)
  const mensal = useAtendimentoMensal()
  const iaHumano = useAtendimentoIaHumano(periodo)
  const atendentes = useAtendimentoPorAtendente(periodo)
  const canais = useAtendimentoPorCanal(periodo)
  const cobertura = useAtendimentoCobertura(periodo)
  const disparosMensal = useDisparosMensal()
  const disparosCanal = useDisparosPorCanal(periodo)
  const cancelMensal = useCancelamentoMensal()
  const cancelOrigem = useCancelamentoOrigem()
  const cancelDesfecho = useCancelamentoDesfecho()
  const retencao = useRetencaoCs()
  const kickoff = useFunilCs(QUADRO_KICKOFF)
  const reversao = useFunilCs(QUADRO_REVERSAO)

  // Data do dado. Enquanto a carga do Pulse for manual, é ela que impede a tela
  // de apresentar uma foto antiga como se fosse o estado de agora.
  const carregadoEm = useMemo(() => {
    const datas = (frescor.data ?? [])
      .map((f) => f.carregado_em)
      .filter((d): d is string => d != null)
    return datas.length > 0 ? datas.sort().at(-1)! : null
  }, [frescor.data])

  const semCarga = !frescor.isLoading && carregadoEm == null

  const atendimentoLider = useMemo(() => {
    const meses = mensal.data ?? []
    return meses.length > 0 ? meses.reduce((a, b) => (b.atendimentos > a.atendimentos ? b : a)) : null
  }, [mensal.data])

  const resolvidoPelaIa = useMemo(() => {
    const linhas = iaHumano.data ?? []
    const total = linhas.reduce((soma, l) => soma + Number(l.total), 0)
    if (total === 0) return null
    return linhas.reduce((soma, l) => soma + Number(l.so_ia), 0) / total
  }, [iaHumano.data])

  const atribuiveis = useMemo(
    () => (cobertura.data ?? []).find((c) => c.atribuicao === 'unica')?.pct ?? null,
    [cobertura.data],
  )

  const revertidos = retencao.data?.find((r) => r.status === 'REVERTIDO')?.empresas ?? null
  const cancelados = retencao.data?.find((r) => r.status === 'CANCELADO')?.empresas ?? null

  return (
    <div className="space-y-4">
      {/* Fora das abas: contexto do módulo inteiro e os avisos sobre o dado. */}
      <BentoGrid>
        <BentoItem span={12} className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Sucesso do cliente</h2>
            <p className="text-muted-foreground text-sm">
              Atendimento, comunicação e retenção · origem: plataforma Pulse
              {carregadoEm ? ` · dados de ${formatDateShort(carregadoEm)}` : ''}
            </p>
          </div>
          <PeriodoFiltro valor={periodo} onChange={setPeriodo} />
        </BentoItem>

        {/* Limitações são parte do dado: ficam visíveis, não em nota de rodapé. */}
        <BentoItem span={12}>
          <Card className={semCarga ? 'border-destructive/40' : undefined}>
            <CardHeader>
              <CardTitle className="text-base">Leia antes de usar estes números</CardTitle>
              <CardDescription className="space-y-1.5">
                {semCarga ? (
                  <span className="block">
                    <strong>Ainda não há carga.</strong> A ligação automática com o Pulse depende
                    de credencial de leitura e liberação de IP; até lá as tabelas estão vazias e
                    todo número desta tela aparece zerado — não é queda, é ausência de dado.
                  </span>
                ) : (
                  <span className="block">
                    <strong>A carga ainda é manual.</strong> Os números são a foto de{' '}
                    {carregadoEm ? formatDateShort(carregadoEm) : '—'}, não o estado de agora.
                  </span>
                )}
                <span className="block">
                  <strong>Motivo de cancelamento não aparece.</strong> O campo é texto livre e
                  quase metade das solicitações está sem preenchimento, então não existe
                  distribuição percentual confiável. O que a tela mostra é o{' '}
                  <strong>tipo de acordo</strong>, que é o desfecho comercial — não a causa.
                </span>
                <span className="block">
                  <strong>Revertido segue a régua do BI, não a do Pulse.</strong> Empresa com card
                  no quadro Reversão está em tentativa; só entra como recuperada quem tem acordo
                  registrado ou chegou à etapa Revertido.
                </span>
              </CardDescription>
            </CardHeader>
          </Card>
        </BentoItem>

        <BentoItem span={12}>
          <KpiGrid>
            <KpiCard
              label="Atendimentos"
              value={Number(kpis.data?.atendimentos ?? 0)}
              format={formatInt}
              isLoading={kpis.isLoading}
              isError={kpis.isError}
            />
            <KpiCard
              label="Pessoas impactadas por comunicação"
              value={Number(kpis.data?.pessoas_impactadas ?? 0)}
              format={formatCompact}
              isLoading={kpis.isLoading}
              isError={kpis.isError}
            />
            <KpiCard
              label="Solicitações de cancelamento"
              value={Number(kpis.data?.solicitacoes_cancelamento ?? 0)}
              format={formatInt}
              isLoading={kpis.isLoading}
              isError={kpis.isError}
            />
            {/* Estado da carteira, não evento do período — por isso não muda com o filtro */}
            <KpiCard
              label="Clientes revertidos (total)"
              value={Number(kpis.data?.revertidos ?? 0)}
              format={formatInt}
              isLoading={kpis.isLoading}
              isError={kpis.isError}
            />
          </KpiGrid>
        </BentoItem>
      </BentoGrid>

      <ModuloTabs
        rota="/cs"
        conteudos={{
          atendimento: (
            <BentoGrid>
              <BentoItem span={8}>
                <ChartCard
                  tone="brand"
                  icon={HeadphonesIcon}
                  title="Atendimentos por mês"
                  headline={atendimentoLider ? formatInt(atendimentoLider.atendimentos) : '—'}
                  headlineLabel={
                    atendimentoLider ? `no melhor mês (${formatMesAno(atendimentoLider.mes)})` : undefined
                  }
                  description="Um atendimento é um ciclo (ticket), não uma mensagem: 50 mensagens na mesma conversa contam como um. Contar mensagens infla o número cerca de 25 vezes."
                  isLoading={mensal.isLoading}
                  isError={mensal.isError}
                  onRetry={() => void mensal.refetch()}
                  isEmpty={mensal.data?.length === 0}
                >
                  <TimeSeriesChart
                    variant="area"
                    data={(mensal.data ?? []).map((m) => ({
                      x: m.mes,
                      atendimentos: Number(m.atendimentos),
                    }))}
                    series={[{ dataKey: 'atendimentos', label: 'Atendimentos' }]}
                    xTickFormatter={formatMesAno}
                    valueFormatter={formatInt}
                    className="h-[280px]"
                  />
                </ChartCard>
              </BentoItem>

              <BentoItem span={4}>
                <ChartCard
                  icon={BotIcon}
                  title="A IA resolveu sozinha?"
                  headline={resolvidoPelaIa != null ? formatPercent(resolvidoPelaIa) : '—'}
                  headlineLabel="sem humano assumir"
                  description="Ciclo sem atendente humano registrado — a IA respondeu e ninguém precisou entrar. Quem assumiu é medido por quem de fato respondeu, não por atribuição formal."
                  isLoading={iaHumano.isLoading}
                  isError={iaHumano.isError}
                  onRetry={() => void iaHumano.refetch()}
                  isEmpty={iaHumano.data?.length === 0}
                >
                  <CategoryBarChart
                    label="Ciclos"
                    data={(iaHumano.data ?? []).map((l) => ({
                      category: l.desfecho,
                      value: Number(l.so_ia),
                    }))}
                    valueFormatter={formatInt}
                    className="h-[280px]"
                  />
                </ChartCard>
              </BentoItem>

              <BentoItem span={6}>
                <TabelaCard
                  icon={UserRoundCheckIcon}
                  title="Quem atendeu"
                  headline={formatInt((atendentes.data ?? []).length)}
                  headlineLabel="pessoas atenderam no período"
                  description="Quem de fato respondeu o ciclo (primeira mensagem humana de saída), que é diferente de quem está formalmente atribuído à conversa."
                  isLoading={atendentes.isLoading}
                  isError={atendentes.isError}
                  onRetry={() => void atendentes.refetch()}
                >
                  <TabelaLonga
                    linhas={atendentes.data ?? []}
                    chave={(a) => a.atendente}
                    buscarEm={(a) => [a.atendente]}
                    rotuloBusca="Buscar atendente"
                    vazio="Nenhum atendimento com humano no período."
                    cabecalho={
                      <TableRow>
                        <TableHead>Atendente</TableHead>
                        <TableHead className="text-right">Atendimentos</TableHead>
                        <TableHead className="text-right">Contatos</TableHead>
                      </TableRow>
                    }
                    renderLinha={(a) => (
                      <TableRow>
                        <TableCell className="font-medium">{a.atendente}</TableCell>
                        <TableCell className="num text-right">{formatInt(a.atendimentos)}</TableCell>
                        <TableCell className="num text-right">{formatInt(a.contatos)}</TableCell>
                      </TableRow>
                    )}
                  />
                </TabelaCard>
              </BentoItem>

              <BentoItem span={6}>
                <ChartCard
                  icon={MessageCircleIcon}
                  title="Atendimentos por canal"
                  headline={
                    canais.data?.[0] ? formatInt(canais.data[0].atendimentos) : '—'
                  }
                  headlineLabel={canais.data?.[0] ? `no canal ${canais.data[0].canal}` : undefined}
                  description="Número da Central por onde o ciclo entrou."
                  isLoading={canais.isLoading}
                  isError={canais.isError}
                  onRetry={() => void canais.refetch()}
                  isEmpty={canais.data?.length === 0}
                >
                  <CategoryBarChart
                    layout="bar"
                    label="Atendimentos"
                    data={(canais.data ?? []).map((c) => ({
                      category: c.canal,
                      value: Number(c.atendimentos),
                    }))}
                    valueFormatter={formatInt}
                    className="h-[260px]"
                  />
                </ChartCard>
              </BentoItem>

              {/* Este card existe para declarar um limite, não para exibir um número
                  bonito: sem ele, "atendimento por empresa" apresentaria 70% da base
                  como se fosse o total. */}
              <BentoItem span={12}>
                <ChartCard
                  icon={ShieldQuestionIcon}
                  title="Quanto do atendimento dá para ligar a uma empresa"
                  headline={atribuiveis != null ? formatPercent(atribuiveis) : '—'}
                  headlineLabel="tem empresa identificada"
                  description="A ligação é por telefone normalizado. Um mesmo número pode aparecer em mais de um cadastro (sócio, contador, consultor) — nesses casos a atribuição seria palpite, e o ciclo fica de fora em vez de ser chutado para uma empresa."
                  isLoading={cobertura.isLoading}
                  isError={cobertura.isError}
                  onRetry={() => void cobertura.refetch()}
                  isEmpty={cobertura.data?.length === 0}
                  contentClassName="min-h-0"
                >
                  <CategoryBarChart
                    layout="bar"
                    label="Ciclos"
                    data={(cobertura.data ?? []).map((c) => ({
                      category:
                        c.atribuicao === 'unica'
                          ? 'Empresa identificada'
                          : c.atribuicao === 'ambigua'
                            ? 'Telefone em mais de uma empresa'
                            : 'Sem empresa correspondente',
                      value: Number(c.atendimentos),
                    }))}
                    valueFormatter={formatInt}
                    className="h-[200px]"
                  />
                </ChartCard>
              </BentoItem>
            </BentoGrid>
          ),

          comunicacao: (
            <BentoGrid>
              <BentoItem span={12}>
                <ChartCard
                  icon={SendIcon}
                  title="Comunicação por mês"
                  headline={
                    disparosMensal.data?.at(-1)
                      ? formatCompact(Number(disparosMensal.data.at(-1)!.pessoas))
                      : '—'
                  }
                  headlineLabel="pessoas alcançadas no último mês"
                  description="Pessoas, não envios: a mesma pessoa recebida em lotes diferentes conta uma vez. A trava anti-duplicidade de 24h não entra na conta — somá-la inflaria o número em cerca de 14%."
                  isLoading={disparosMensal.isLoading}
                  isError={disparosMensal.isError}
                  onRetry={() => void disparosMensal.refetch()}
                  isEmpty={disparosMensal.data?.length === 0}
                >
                  <TimeSeriesChart
                    data={(disparosMensal.data ?? []).map((d) => ({
                      x: d.mes,
                      pessoas: Number(d.pessoas),
                      mensagens: Number(d.mensagens),
                    }))}
                    series={[
                      { dataKey: 'mensagens', label: 'Mensagens' },
                      { dataKey: 'pessoas', label: 'Pessoas' },
                    ]}
                    xTickFormatter={formatMesAno}
                    valueFormatter={formatCompact}
                    className="h-[280px]"
                  />
                </ChartCard>
              </BentoItem>

              <BentoItem span={12}>
                <TabelaCard
                  icon={RadioTowerIcon}
                  title="Entrega por canal"
                  headline={
                    disparosCanal.data?.[0]?.pct_erro != null
                      ? formatPercent(disparosCanal.data[0].pct_erro)
                      : '—'
                  }
                  headlineLabel={
                    disparosCanal.data?.[0] ? `de erro em ${disparosCanal.data[0].canal}` : undefined
                  }
                  description="Ignorados são a trava anti-duplicidade de 24 horas, não falha de entrega — por isso ficam numa coluna própria e fora da taxa de erro."
                  isLoading={disparosCanal.isLoading}
                  isError={disparosCanal.isError}
                  onRetry={() => void disparosCanal.refetch()}
                  linhasEsqueleto={2}
                >
                  <TabelaLonga
                    linhas={disparosCanal.data ?? []}
                    chave={(d) => d.canal}
                    buscarEm={(d) => [d.canal]}
                    vazio="Nenhum envio no período."
                    cabecalho={
                      <TableRow>
                        <TableHead>Canal</TableHead>
                        <TableHead className="text-right">Enviados</TableHead>
                        <TableHead className="text-right">Falhas</TableHead>
                        <TableHead className="text-right">Ignorados</TableHead>
                        <TableHead className="text-right">Erro</TableHead>
                      </TableRow>
                    }
                    renderLinha={(d) => (
                      <TableRow>
                        <TableCell className="font-medium">{d.canal}</TableCell>
                        <TableCell className="num text-right">{formatInt(d.enviados)}</TableCell>
                        <TableCell className="num text-right">{formatInt(d.falhas)}</TableCell>
                        <TableCell className="num text-right">{formatInt(d.ignorados)}</TableCell>
                        <TableCell className="num text-right font-medium">
                          {d.pct_erro != null ? formatPercent(d.pct_erro) : '—'}
                        </TableCell>
                      </TableRow>
                    )}
                  />
                </TabelaCard>
              </BentoItem>
            </BentoGrid>
          ),

          retencao: (
            <BentoGrid>
              <BentoItem span={8}>
                <ChartCard
                  icon={HeartCrackIcon}
                  title="Solicitações de cancelamento por mês"
                  headline={
                    cancelMensal.data?.at(-1)
                      ? formatInt(cancelMensal.data.at(-1)!.solicitacoes)
                      : '—'
                  }
                  headlineLabel="no último mês"
                  description="Pedido de cancelamento registrado, independentemente do desfecho. Uma empresa pode aparecer mais de uma vez, em ciclos diferentes."
                  isLoading={cancelMensal.isLoading}
                  isError={cancelMensal.isError}
                  onRetry={() => void cancelMensal.refetch()}
                  isEmpty={cancelMensal.data?.length === 0}
                >
                  <TimeSeriesChart
                    data={(cancelMensal.data ?? []).map((c) => ({
                      x: c.mes,
                      solicitacoes: Number(c.solicitacoes),
                    }))}
                    series={[{ dataKey: 'solicitacoes', label: 'Solicitações' }]}
                    xTickFormatter={formatMesAno}
                    valueFormatter={formatInt}
                    className="h-[260px]"
                  />
                </ChartCard>
              </BentoItem>

              <BentoItem span={4}>
                <ChartCard
                  icon={RotateCcwIcon}
                  title="Cancelados e revertidos"
                  headline={revertidos != null ? formatInt(revertidos) : '—'}
                  headlineLabel={
                    cancelados != null ? `revertidos · ${formatInt(cancelados)} cancelados` : undefined
                  }
                  description="Revertido é acordo de reversão registrado ou chegada à etapa Revertido do funil. Empresa que só tem card no quadro Reversão está em tentativa e não entra nesta conta."
                  isLoading={retencao.isLoading}
                  isError={retencao.isError}
                  onRetry={() => void retencao.refetch()}
                  isEmpty={retencao.data?.length === 0}
                >
                  <CategoryBarChart
                    label="Empresas"
                    data={(retencao.data ?? []).map((r) => ({
                      category:
                        r.status === 'LEVANTOU_A_MAO' ? 'Levantou a mão' : r.status.toLowerCase(),
                      value: Number(r.empresas),
                    }))}
                    valueFormatter={formatInt}
                    className="h-[260px]"
                  />
                </ChartCard>
              </BentoItem>

              <BentoItem span={6}>
                <ChartCard
                  icon={ShieldQuestionIcon}
                  title="Como o pedido chegou"
                  headline={
                    cancelOrigem.data?.[0] ? formatInt(cancelOrigem.data[0].solicitacoes) : '—'
                  }
                  headlineLabel={cancelOrigem.data?.[0] ? `via ${cancelOrigem.data[0].origem}` : undefined}
                  description="Canal por onde a solicitação entrou no sistema."
                  isLoading={cancelOrigem.isLoading}
                  isError={cancelOrigem.isError}
                  onRetry={() => void cancelOrigem.refetch()}
                  isEmpty={cancelOrigem.data?.length === 0}
                >
                  <CategoryBarChart
                    layout="bar"
                    label="Solicitações"
                    data={(cancelOrigem.data ?? []).map((o) => ({
                      category: o.origem,
                      value: Number(o.solicitacoes),
                    }))}
                    valueFormatter={formatInt}
                    className="h-[240px]"
                  />
                </ChartCard>
              </BentoItem>

              <BentoItem span={6}>
                <ChartCard
                  icon={ClipboardCheckIcon}
                  title="Tipo de acordo (desfecho)"
                  headline={
                    cancelDesfecho.data?.[0] ? formatInt(cancelDesfecho.data[0].solicitacoes) : '—'
                  }
                  headlineLabel={
                    cancelDesfecho.data?.[0] ? `em ${cancelDesfecho.data[0].tipo_acordo}` : undefined
                  }
                  description="Como o caso terminou comercialmente. NÃO é o motivo do cancelamento: motivo é texto livre e quase metade está vazia, então não existe distribuição confiável para mostrar."
                  isLoading={cancelDesfecho.isLoading}
                  isError={cancelDesfecho.isError}
                  onRetry={() => void cancelDesfecho.refetch()}
                  isEmpty={cancelDesfecho.data?.length === 0}
                >
                  <CategoryBarChart
                    layout="bar"
                    label="Solicitações"
                    data={(cancelDesfecho.data ?? []).map((d) => ({
                      category: d.tipo_acordo,
                      value: Number(d.solicitacoes),
                    }))}
                    valueFormatter={formatInt}
                    className="h-[240px]"
                  />
                </ChartCard>
              </BentoItem>
            </BentoGrid>
          ),

          funis: (
            <BentoGrid>
              <BentoItem span={6}>
                <TabelaCard
                  icon={ClipboardCheckIcon}
                  title="Kickoff — clientes por etapa"
                  headline={formatInt(
                    (kickoff.data ?? []).reduce((soma, e) => soma + Number(e.cards), 0),
                  )}
                  headlineLabel="clientes no quadro"
                  description="Quadro automatizado por motor e webhooks — cards não param na primeira etapa."
                  isLoading={kickoff.isLoading}
                  isError={kickoff.isError}
                  onRetry={() => void kickoff.refetch()}
                >
                  <TabelaLonga
                    linhas={kickoff.data ?? []}
                    chave={(e) => e.etapa}
                    buscarEm={(e) => [e.etapa]}
                    vazio="Nenhum card no quadro de Kickoff."
                    cabecalho={
                      <TableRow>
                        <TableHead>Etapa</TableHead>
                        <TableHead className="text-right">Clientes</TableHead>
                      </TableRow>
                    }
                    renderLinha={(e) => (
                      <TableRow>
                        <TableCell className="font-medium">{e.etapa}</TableCell>
                        <TableCell className="num text-right">{formatInt(e.cards)}</TableCell>
                      </TableRow>
                    )}
                  />
                </TabelaCard>
              </BentoItem>

              <BentoItem span={6}>
                <TabelaCard
                  icon={RotateCcwIcon}
                  title="Reversão — tentativas em curso"
                  headline={formatInt(
                    (reversao.data ?? []).reduce((soma, e) => soma + Number(e.cards), 0),
                  )}
                  headlineLabel="empresas já perseguidas"
                  description="Fluxo operacional de recuperação. Estar aqui não significa recuperado — parte destes casos já foi recuperada e parte já foi perdida; quem decide isso é o acordo registrado, não a posição no quadro."
                  isLoading={reversao.isLoading}
                  isError={reversao.isError}
                  onRetry={() => void reversao.refetch()}
                >
                  <TabelaLonga
                    linhas={reversao.data ?? []}
                    chave={(e) => e.etapa}
                    buscarEm={(e) => [e.etapa]}
                    vazio="Nenhum card no quadro de Reversão."
                    cabecalho={
                      <TableRow>
                        <TableHead>Etapa</TableHead>
                        <TableHead className="text-right">Empresas</TableHead>
                      </TableRow>
                    }
                    renderLinha={(e) => (
                      <TableRow>
                        <TableCell className="font-medium">{e.etapa}</TableCell>
                        <TableCell className="num text-right">{formatInt(e.cards)}</TableCell>
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
