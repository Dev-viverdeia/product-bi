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
import { PeriodoFiltro } from '@/components/filters/periodo-filtro'
import type { Periodo } from '@/lib/periodo'
import { BentoCabecalho, BentoGrid, BentoItem } from '@/components/layout/bento'
import { ModuloTabs } from '@/components/layout/modulo-tabs'
import { TabelaCard } from '@/components/tabela/tabela-card'
import { TabelaLonga } from '@/components/tabela/tabela-longa'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { TableCell, TableHead, TableRow } from '@/components/ui/table'
import { formatCompact, formatDateShort, formatInt, formatMesAno, formatPercent } from '@/lib/format'
import {
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

/** Motivo único de travessão nos KPIs enquanto o espelho do Pulse não roda. */
const SEM_CARGA = 'sem carga do Pulse'

export function CsPage() {
  const [periodo, setPeriodo] = useState<Periodo>(30)

  const frescor = useFrescorCs()
  const kpis = useCsKpis(periodo)
  const mensal = useAtendimentoMensal()
  const iaHumano = useAtendimentoIaHumano(periodo)
  const atendentes = useAtendimentoPorAtendente(periodo)
  const canais = useAtendimentoPorCanal(periodo)
  const disparosMensal = useDisparosMensal()
  const disparosCanal = useDisparosPorCanal(periodo)
  const cancelMensal = useCancelamentoMensal()
  const cancelOrigem = useCancelamentoOrigem()
  const cancelDesfecho = useCancelamentoDesfecho()
  const retencao = useRetencaoCs()
  const kickoff = useFunilCs(QUADRO_KICKOFF)
  const reversao = useFunilCs(QUADRO_REVERSAO)

  // A data do DADO, não a da carga.
  //
  // Antes isto lia `carregado_em`, o que funcionava enquanto a carga era manual.
  // Com o sync a cada 30 min, `carregado_em` é sempre "agora" — carimbaria a tela
  // de fresca mesmo se a origem tivesse parado semanas atrás. `ultimo_evento_brt`
  // é o último fato que existe no dado, que é o que o leitor precisa saber.
  const dadosAte = useMemo(() => {
    const datas = (frescor.data ?? [])
      .map((f) => f.ultimo_evento_brt)
      .filter((d): d is string => d != null)
    return datas.length > 0 ? datas.sort().at(-1)! : null
  }, [frescor.data])

  // Sem carga = as tabelas estão vazias, não "a consulta falhou". Os dois estados
  // são diferentes e a tela precisa distinguir: erro tem retry, vazio não.
  const semCarga = useMemo(
    () =>
      !frescor.isLoading &&
      !frescor.isError &&
      (frescor.data ?? []).every((f) => Number(f.linhas) === 0),
    [frescor.data, frescor.isLoading, frescor.isError],
  )

  // Fontes que pararam de receber evento novo, cada uma com o próprio limite —
  // a tela declara sozinha, sem texto fixo que envelhece.
  const fontesParadas = useMemo(
    () => (frescor.data ?? []).filter((f) => f.fonte_parada),
    [frescor.data],
  )

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

  // Vocabulário da origem: RETIDO / PERDIDO / EM_ABERTO, no grão de cliente
  // deduplicado. A régua anterior (REVERTIDO/CANCELADO por empresa) era nossa e
  // não existia do lado do Pulse — media outra coisa com nome parecido.
  const perdidos = retencao.data?.find((r) => r.desfecho === 'PERDIDO')?.clientes ?? null
  // O número que a tela NÃO pode esconder: perdido que ainda tem acesso ativo.
  // Publicar só "perdidos" escolheria um lado de uma divergência real entre a
  // verdade do CS e a da plataforma.
  const perdidosComAcesso =
    retencao.data?.find((r) => r.desfecho === 'PERDIDO')?.conflita_base ?? null

  return (
    <div className="space-y-4">
      {/* Fora das abas: contexto do módulo inteiro e os avisos sobre o dado. */}
      <BentoGrid>
        <BentoCabecalho>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Sucesso do cliente</h2>
            <p className="text-muted-foreground text-sm">
              Atendimento, comunicação e retenção · origem: plataforma Pulse
              {dadosAte ? ` · dados até ${formatDateShort(dadosAte)}` : ''}
            </p>
          </div>
          <PeriodoFiltro valor={periodo} onChange={setPeriodo} />
        </BentoCabecalho>

        {/* Limitações são parte do dado: ficam visíveis, não em nota de rodapé. */}
        <BentoItem span={12}>
          <Card className={semCarga ? 'border-destructive/40' : undefined}>
            <CardHeader>
              <CardTitle className="text-base">Leia antes de usar estes números</CardTitle>
              <CardDescription className="space-y-1.5">
                {semCarga ? (
                  <span className="block">
                    <strong>Ainda não há carga.</strong> As tabelas estão vazias, então todo
                    número desta tela aparece como “—” — não é queda, é ausência de dado.
                  </span>
                ) : (
                  <span className="block">
                    <strong>Carga automática a cada 30 minutos</strong>, do banco do Pulse. Os
                    números vão até {dadosAte ? formatDateShort(dadosAte) : '—'} — que é a data do
                    último fato registrado, não a da última leitura.
                  </span>
                )}
                {fontesParadas.length > 0 ? (
                  <span className="block">
                    <strong>
                      {fontesParadas.length === 1
                        ? 'Uma fonte parou de receber evento novo:'
                        : `${formatInt(fontesParadas.length)} fontes pararam de receber evento novo:`}
                    </strong>{' '}
                    {fontesParadas
                      .map(
                        (f) =>
                          `${f.tabela} (último em ${f.ultimo_evento_brt ? formatDateShort(f.ultimo_evento_brt) : '—'})`,
                      )
                      .join(' · ')}
                    . O que essa fonte alimenta está congelado nessa data — o resto da tela não.
                  </span>
                ) : null}
                <span className="block">
                  <strong>Atendimento não tem empresa.</strong> O contrato que recebemos do Pulse
                  não liga ticket a cliente — os números de atendimento são volume, e não dá para
                  cruzá-los com uso do produto, receita ou retenção. O time do Pulse vai expor a
                  ligação por telefone (cobertura de ~81%, só quando o número identifica uma
                  empresa só); até lá, esta parte da tela não responde “de quem”.
                </span>
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
            {/* Sem carga, a RPC devolve 0 porque as tabelas estão vazias — e "0
                atendimentos" lê como "ninguém foi atendido", que é o oposto da
                verdade. Enquanto o espelho não roda, o tile mostra travessão e
                diz por quê. */}
            <KpiCard
              label="Atendimentos"
              value={semCarga || kpis.data == null ? null : Number(kpis.data.atendimentos)}
              format={formatInt}
              motivoSemValor={SEM_CARGA}
              isLoading={kpis.isLoading}
              isError={kpis.isError}
            />
            <KpiCard
              label="Pessoas impactadas por comunicação"
              value={semCarga || kpis.data == null ? null : Number(kpis.data.pessoas_impactadas)}
              format={formatCompact}
              motivoSemValor={SEM_CARGA}
              isLoading={kpis.isLoading}
              isError={kpis.isError}
            />
            <KpiCard
              label="Solicitações de cancelamento"
              value={semCarga || kpis.data == null ? null : Number(kpis.data.solicitacoes_cancelamento)}
              format={formatInt}
              motivoSemValor={SEM_CARGA}
              isLoading={kpis.isLoading}
              isError={kpis.isError}
            />
            {/* Estado da carteira, não evento do período — por isso não muda com o filtro */}
            <KpiCard
              label="Clientes retidos (total)"
              value={semCarga || kpis.data == null ? null : Number(kpis.data.retidos)}
              format={formatInt}
              motivoSemValor={SEM_CARGA}
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
                  headline={
                    semCarga || !atendentes.data ? '—' : formatInt(atendentes.data.length)
                  }
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

              {/* O card de cobertura da atribuição saiu junto com a RPC que o
                  alimentava: o contrato bi_pulse não entrega empresa no ticket, e a
                  régua anterior era derivada de um espelho que não existe mais. O
                  limite não sumiu da tela — subiu para o bloco de limitações, que é
                  onde ele pertence enquanto não houver número para desenhar. */}
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
                  title="Desfecho da retenção"
                  headline={perdidos != null ? formatInt(perdidos) : '—'}
                  headlineLabel={
                    perdidosComAcesso != null
                      ? `perdidos · ${formatInt(perdidosComAcesso)} ainda com acesso ativo`
                      : 'clientes perdidos'
                  }
                  description="Vocabulário do Pulse, no grão de cliente deduplicado — o mesmo cliente com cadastro repetido conta uma vez. “Perdido ainda com acesso” não é erro de um dos lados: é a divergência entre o desfecho que o CS registrou e a base que a plataforma ainda mantém, e a tela mostra as duas em vez de escolher uma."
                  isLoading={retencao.isLoading}
                  isError={retencao.isError}
                  onRetry={() => void retencao.refetch()}
                  isEmpty={retencao.data?.length === 0}
                >
                  <CategoryBarChart
                    label="Clientes"
                    data={(retencao.data ?? []).map((r) => ({
                      category:
                        r.desfecho === 'EM_ABERTO'
                          ? 'Em aberto'
                          : r.desfecho === 'PERDIDO'
                            ? 'Perdido'
                            : 'Retido',
                      value: Number(r.clientes),
                      // O segundo canal carrega a divergência sem virar barra
                      // própria: ela é um recorte do PERDIDO, não um desfecho.
                      nota:
                        Number(r.conflita_base) > 0
                          ? `${formatInt(Number(r.conflita_base))} ainda com acesso ativo`
                          : undefined,
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
                  headline={
                    semCarga
                      ? '—'
                      : formatInt((kickoff.data ?? []).reduce((soma, e) => soma + Number(e.cards), 0))
                  }
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
                  headline={
                    semCarga
                      ? '—'
                      : formatInt((reversao.data ?? []).reduce((soma, e) => soma + Number(e.cards), 0))
                  }
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
