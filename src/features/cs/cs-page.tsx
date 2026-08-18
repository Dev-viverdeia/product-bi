import { useMemo, useState } from 'react'
import {
  BotIcon,
  ClipboardCheckIcon,
  DoorOpenIcon,
  HandshakeIcon,
  HeadphonesIcon,
  HeartCrackIcon,
  MegaphoneIcon,
  MessageCircleIcon,
  RadioTowerIcon,
  RotateCcwIcon,
  RouteIcon,
  SendIcon,
  ShieldQuestionIcon,
  TicketIcon,
  UserRoundCheckIcon,
  WorkflowIcon,
} from 'lucide-react'

import { CategoryBarChart, ChartCard, KpiCard, KpiGrid, TimeSeriesChart } from '@/components/charts'
import { PeriodoFiltro } from '@/components/filters/periodo-filtro'
import type { Periodo } from '@/lib/periodo'
import { BentoItem } from '@/components/layout/bento'
import { CabecalhoDeModulo } from '@/components/layout/cabecalho-de-modulo'
import { ModuloTabs } from '@/components/layout/modulo-tabs'
import { SecaoDeAnalise } from '@/components/layout/secao-de-analise'
import { AbaDeDados } from '@/components/tabela/aba-de-dados'
import { TabelaCard } from '@/components/tabela/tabela-card'
import { TabelaLonga } from '@/components/tabela/tabela-longa'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { TableCell, TableHead, TableRow } from '@/components/ui/table'
import { formatCompact, formatDateShort, formatInt, formatMesAno, formatPercent } from '@/lib/format'
import { AnaliseDaTela } from '@/features/resumo/analise-tela'
import { PlanoDaTela } from '@/features/resumo/plano-da-tela'
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
      {/* Título, régua e controles saem de `nav-items.ts` — a página não
          reescreve a própria régua. Esta tela oferece período e não oferece
          recorte, e o frescor do dado anda junto do controle. */}
      <CabecalhoDeModulo controles={<PeriodoFiltro valor={periodo} onChange={setPeriodo} />} />

      {/* Limitações são parte do dado: ficam visíveis e FORA das abas, porque
          valem para as três — em nota de rodapé de uma aba só, somem nas
          outras duas. Também não é card de mosaico: não responde pergunta
          nenhuma, é a bula de tudo que vem abaixo. */}
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

      {/* Fora das abas: contexto das três. Trocar de aba não pode custar o
          número de referência nem obrigar a reajustar o período. */}
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

      <ModuloTabs
        rota="/cs"
        conteudos={{
          graficos: (
            <div className="space-y-4">
              <SecaoDeAnalise
                titulo="Quanto atendimento entra, e quanto a IA fecha sozinha"
                icone={TicketIcon}
                descricao="A unidade dos dois cards é o ciclo, não a mensagem nem a pessoa — mas as janelas divergem: a série mensal mostra o histórico inteiro e ignora o seletor de dias do topo, enquanto a fatia da IA sai da janela escolhida ali. Ler a resolução da IA como fatia do melhor mês mistura duas janelas."
              >
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
              </SecaoDeAnalise>

              <SecaoDeAnalise
                titulo="Por onde o ciclo entrou, e quem respondeu"
                icone={RouteIcon}
                descricao="Os dois cortam a mesma fila de ciclos do período por eixos que não se cruzam: o número por onde a conversa entrou e a pessoa que a respondeu. As duas contagens não somam entre si — ciclo resolvido sem humano aparece no canal e em atendente nenhum. Ambos seguem o seletor de dias do topo."
              >
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
              </SecaoDeAnalise>

              <SecaoDeAnalise
                titulo="Quanta gente a comunicação alcança, e quanto se perde no caminho"
                icone={MegaphoneIcon}
                descricao="Um card não divide pelo outro: a série conta pessoas alcançadas e a tabela conta envios tentados, que são grãos diferentes — e as janelas também divergem, porque a série mostra o histórico inteiro e a tabela responde ao seletor de dias do topo. Os dois medem só o lado do disparo: o contrato do Pulse não traz abertura nem resposta, então nada aqui afirma que a mensagem foi lida."
              >
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
              </SecaoDeAnalise>

              <SecaoDeAnalise
                titulo="Quantos pedem para sair, e onde esses casos param"
                icone={DoorOpenIcon}
                descricao="Nada nesta seção responde ao seletor de dias do topo: a série é o histórico mês a mês e o desfecho é o estado de hoje da carteira inteira. Os grãos também divergem — a série conta pedidos e o desfecho conta clientes deduplicados —, então somar a série nunca reencontra as barras ao lado."
              >
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
              </SecaoDeAnalise>

              <SecaoDeAnalise
                titulo="Como o pedido chega e como ele termina"
                icone={HandshakeIcon}
                descricao="Os dois recortam a mesma fila de solicitações por eixos independentes — o caminho de entrada e o acerto comercial do fim —, então uma barra aqui e uma barra ali podem ser a mesma solicitação, e juntar as duas listas a contaria duas vezes. Nenhum dos dois é a causa da saída: ambos descrevem trâmite, não motivo."
              >
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
              </SecaoDeAnalise>

              <SecaoDeAnalise
                titulo="Onde cada caso está parado nos quadros do CS"
                icone={WorkflowIcon}
                descricao="Foto da posição atual dos cards, não fluxo do período: o seletor de dias não alcança nenhum dos dois quadros, e um card parado há meses pesa igual a um que entrou ontem. Os dois também não se somam — são fluxos separados e o grão difere, com o Kickoff contando clientes e a Reversão contando empresas."
              >
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
              </SecaoDeAnalise>

              {/* As linhas cruas fecham a aba do dado: são as MESMAS queries que
                  os cards acima desenham, passadas já resolvidas. Nenhuma
                  consulta nova — se a lista refizesse a leitura, ela poderia
                  divergir do card logo acima. */}
              <AbaDeDados
                fontes={[
                  {
                    rpc: 'bi_cs_frescor',
                    titulo: 'De quando é o dado de cada fonte do Pulse',
                    descricao:
                      'é a régua do bloco de limitações do topo — `ultimo_evento_brt` é a data do fato, não a da carga',
                    linhas: frescor.data,
                    isLoading: frescor.isLoading,
                    isError: frescor.isError,
                    onRetry: () => void frescor.refetch(),
                  },
                  {
                    rpc: 'bi_cs_kpis',
                    titulo: 'Os quatro números do topo',
                    descricao:
                      'uma linha só · `retidos` é estado da carteira inteira e não responde ao seletor de dias',
                    linhas: kpis.data ? [kpis.data] : [],
                    isLoading: kpis.isLoading,
                    isError: kpis.isError,
                    onRetry: () => void kpis.refetch(),
                  },
                  {
                    rpc: 'bi_cs_atendimento_mensal',
                    titulo: 'Atendimentos por mês',
                    descricao:
                      'histórico inteiro, mês a mês — ignora o seletor de dias do topo · a unidade é o ciclo (ticket), não a mensagem',
                    linhas: mensal.data,
                    isLoading: mensal.isLoading,
                    isError: mensal.isError,
                    onRetry: () => void mensal.refetch(),
                  },
                  {
                    rpc: 'bi_cs_atendimento_ia_humano',
                    titulo: 'Quanto a IA fechou sozinha, por desfecho',
                    descricao: 'quem assumiu é medido por quem respondeu, não por atribuição formal',
                    linhas: iaHumano.data,
                    isLoading: iaHumano.isLoading,
                    isError: iaHumano.isError,
                    onRetry: () => void iaHumano.refetch(),
                  },
                  {
                    rpc: 'bi_cs_atendimento_por_atendente',
                    titulo: 'Quem respondeu os ciclos do período',
                    linhas: atendentes.data,
                    isLoading: atendentes.isLoading,
                    isError: atendentes.isError,
                    onRetry: () => void atendentes.refetch(),
                  },
                  {
                    rpc: 'bi_cs_atendimento_por_canal',
                    titulo: 'Por qual número da Central o ciclo entrou',
                    linhas: canais.data,
                    isLoading: canais.isLoading,
                    isError: canais.isError,
                    onRetry: () => void canais.refetch(),
                  },
                  {
                    rpc: 'bi_cs_disparos_mensal',
                    titulo: 'Comunicação enviada por mês',
                    descricao:
                      'histórico inteiro · `pessoas` deduplica quem recebeu em lotes diferentes, `mensagens` não',
                    linhas: disparosMensal.data,
                    isLoading: disparosMensal.isLoading,
                    isError: disparosMensal.isError,
                    onRetry: () => void disparosMensal.refetch(),
                  },
                  {
                    rpc: 'bi_cs_disparos_por_canal',
                    titulo: 'Entrega e falha por canal de comunicação',
                    descricao:
                      '`ignorados` é a trava anti-duplicidade de 24h, e fica fora de `pct_erro`',
                    linhas: disparosCanal.data,
                    isLoading: disparosCanal.isLoading,
                    isError: disparosCanal.isError,
                    onRetry: () => void disparosCanal.refetch(),
                  },
                  {
                    rpc: 'bi_cs_cancelamento_mensal',
                    titulo: 'Solicitações de cancelamento por mês',
                    descricao:
                      'histórico inteiro · conta pedidos, então a mesma empresa pode aparecer mais de uma vez',
                    linhas: cancelMensal.data,
                    isLoading: cancelMensal.isLoading,
                    isError: cancelMensal.isError,
                    onRetry: () => void cancelMensal.refetch(),
                  },
                  {
                    rpc: 'bi_cs_cancelamento_origem',
                    titulo: 'Por onde o pedido de cancelamento entrou',
                    descricao: 'trâmite de entrada, não motivo da saída',
                    linhas: cancelOrigem.data,
                    isLoading: cancelOrigem.isLoading,
                    isError: cancelOrigem.isError,
                    onRetry: () => void cancelOrigem.refetch(),
                  },
                  {
                    rpc: 'bi_cs_cancelamento_desfecho',
                    titulo: 'Como o caso terminou comercialmente',
                    descricao:
                      'tipo de acordo · motivo é texto livre com quase metade vazia e não sai daqui',
                    linhas: cancelDesfecho.data,
                    isLoading: cancelDesfecho.isLoading,
                    isError: cancelDesfecho.isError,
                    onRetry: () => void cancelDesfecho.refetch(),
                  },
                  {
                    rpc: 'bi_cs_retencao',
                    titulo: 'Desfecho da retenção, no grão de cliente deduplicado',
                    descricao:
                      '`conflita_base` é o perdido que ainda tem acesso ativo — divergência entre o CS e a plataforma, não erro de um dos lados',
                    linhas: retencao.data,
                    isLoading: retencao.isLoading,
                    isError: retencao.isError,
                    onRetry: () => void retencao.refetch(),
                  },
                  {
                    // Mesma RPC, quadros diferentes: o argumento entra no rótulo
                    // porque é ele que distingue as duas leituras.
                    rpc: `bi_cs_funil (${QUADRO_KICKOFF})`,
                    titulo: 'Cards do quadro de Kickoff, por etapa',
                    descricao: 'foto da posição atual, não fluxo do período · grão de cliente',
                    linhas: kickoff.data,
                    isLoading: kickoff.isLoading,
                    isError: kickoff.isError,
                    onRetry: () => void kickoff.refetch(),
                  },
                  {
                    rpc: `bi_cs_funil (${QUADRO_REVERSAO})`,
                    titulo: 'Cards do quadro de Reversão, por etapa',
                    descricao: 'foto da posição atual, não fluxo do período · grão de empresa',
                    linhas: reversao.data,
                    isLoading: reversao.isLoading,
                    isError: reversao.isError,
                    onRetry: () => void reversao.refetch(),
                  },
                ]}
              />
            </div>
          ),

          analise: <AnaliseDaTela tela="cs" />,
          plano: <PlanoDaTela tela="cs" />,
        }}
      />
    </div>
  )
}
