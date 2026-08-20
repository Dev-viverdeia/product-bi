import { useMemo } from 'react'
import {
  BanknoteIcon,
  CreditCardIcon,
  LayersIcon,
  LineChartIcon,
  SproutIcon,
  TriangleAlertIcon,
  WalletIcon,
} from 'lucide-react'

import { CategoryBarChart, ChartCard, KpiCard, KpiGrid, TimeSeriesChart } from '@/components/charts'
import { BentoItem } from '@/components/layout/bento'
import { CabecalhoDeModulo } from '@/components/layout/cabecalho-de-modulo'
import { ModuloTabs } from '@/components/layout/modulo-tabs'
import { SecaoDeAnalise } from '@/components/layout/secao-de-analise'
import { AbaDeDados } from '@/components/tabela/aba-de-dados'
import { TabelaCard } from '@/components/tabela/tabela-card'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { TabelaLonga } from '@/components/tabela/tabela-longa'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  formatCurrency,
  formatCurrencyCompact,
  formatDateShort,
  formatDecimal,
  formatInt,
  formatMesAno,
  formatPercent,
} from '@/lib/format'
import { AnaliseDaTela } from '@/features/resumo/analise-tela'
import { PlanoDaTela } from '@/features/resumo/plano-da-tela'
import {
  useLtvCohort,
  useReceitaKpis,
  useReceitaMensal,
  useSaudeCobranca,
  useUsoVsReceita,
} from '@/features/receita/queries'

export function ReceitaPage() {
  const kpis = useReceitaKpis()
  const mensal = useReceitaMensal()
  const cobranca = useSaudeCobranca()
  const ltv = useLtvCohort()
  const usoReceita = useUsoVsReceita()

  // Duas datas, e elas NÃO são a mesma: o último pagamento aprovado entrou
  // dezesseis dias antes do último registro de qualquer tipo. A fonte seguiu
  // mandando fatura criada e falhada, sem nenhuma aprovada — e enquanto as
  // duas eram uma só, a tela dizia "último webhook de pagamento" sobre uma
  // fatura apenas emitida, fazendo a fonte parecer mais fresca do que está.
  const dadosAte = kpis.data?.dados_ate
  const fonteAte = kpis.data?.fonte_ate

  // Melhor mês da série — o teto que a receita já alcançou.
  const melhorMes = useMemo(() => {
    const meses = (mensal.data ?? []).filter((m) => m.receita_brl != null)
    if (meses.length === 0) return null
    return meses.reduce((a, b) => ((b.receita_brl ?? 0) > (a.receita_brl ?? 0) ? b : a))
  }, [mensal.data])

  // O card de cobrança é sobre dinheiro que não entrou: lidera pelo pior evento.
  //
  // O filtro de nulo é o que faz isso funcionar, e ele passou a ter dente: a
  // linha "Pagamento aprovado" É o denominador, e a RPC devolvia 1,0000 nela.
  // Como este reduce pega o MAIOR pct, o headline publicava "100,0% do valor
  // pago em Pagamento aprovado" — tautologia em corpo 30px. Hoje a RPC
  // suprime a fatia da linha de referência, então ela sai daqui por régua e
  // não por nome, que é o que sobrevive a alguém renomear o evento.
  const piorEventoCobranca = useMemo(() => {
    const evs = (cobranca.data ?? []).filter((c) => c.pct_do_pago != null)
    if (evs.length === 0) return null
    return evs.reduce((a, b) => ((b.pct_do_pago ?? 0) > (a.pct_do_pago ?? 0) ? b : a))
  }, [cobranca.data])

  const melhorSafra = useMemo(() => {
    const safras = (ltv.data ?? []).filter((l) => l.receita_por_cliente != null)
    if (safras.length === 0) return null
    return safras.reduce((a, b) =>
      (b.receita_por_cliente ?? 0) > (a.receita_por_cliente ?? 0) ? b : a,
    )
  }, [ltv.data])

  // Faixa que mais fatura — a resposta de "quem paga mais usa mais?" começa aqui.
  const faixaTopo = (usoReceita.data ?? []).at(-1) ?? null

  return (
    <div className="space-y-4">
      {/* Título e régua saem de `nav-items.ts` — a página não reescreve a
          própria régua. Esta tela não tem período nem recorte: nada a controlar. */}
      <CabecalhoDeModulo />

      {/* Limitações são parte do dado: ficam visíveis, fora das abas, não em
          nota de rodapé. Valem para os gráficos e para a leitura escrita. */}
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-base">Leia antes de usar estes números</CardTitle>
          <CardDescription className="space-y-1.5">
            <span className="block">
              <strong>A fonte parou.</strong> O último pagamento aprovado é de{' '}
              {dadosAte ? formatDateShort(dadosAte) : 'abr/2026'} — esta tela mostra o histórico
              até essa data e <strong>não reflete a receita de hoje</strong>.
              {fonteAte && dadosAte && fonteAte !== dadosAte ? (
                <>
                  {' '}
                  A fonte ainda registrou fatura criada e falhada até{' '}
                  {formatDateShort(fonteAte)}, sem nenhuma aprovada no intervalo: o que parou
                  primeiro foi a cobrança dar certo, não o webhook chegar.
                </>
              ) : null}
            </span>
            <span className="block">
              <strong>A view de receita da plataforma está incorreta.</strong> A
              <code className="bg-muted mx-1 rounded px-1 py-0.5 text-xs">bi_receita_hubla</code>
              lê um caminho de JSON que não existe no payload real, então retorna vazio. Aqui usamos
              o caminho correto — os dois números não vão bater.
            </span>
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Fora das abas: contexto das duas. Trocar entre a leitura e os gráficos
          não pode custar o número de referência. */}
      <KpiGrid>
        <KpiCard
          label="Receita reconhecida"
          value={kpis.data?.receita_brl ?? null}
          format={formatCurrencyCompact}
          isLoading={kpis.isLoading}
          isError={kpis.isError}
        />
        <KpiCard
          label="Faturas pagas"
          value={kpis.data?.faturas ?? null}
          format={formatInt}
          isLoading={kpis.isLoading}
          isError={kpis.isError}
        />
        <KpiCard
          label="Compradores"
          value={kpis.data?.compradores ?? null}
          format={formatInt}
          isLoading={kpis.isLoading}
          isError={kpis.isError}
        />
        <KpiCard
          label="Ticket mediano"
          value={kpis.data?.ticket_mediano ?? null}
          format={formatCurrency}
          isLoading={kpis.isLoading}
          isError={kpis.isError}
        />
      </KpiGrid>

      <ModuloTabs
        rota="/receita"
        conteudos={{
          // As três abas iguais em toda tela: o dado, a leitura, o plano. O
          // agrupamento por pergunta não se perdeu — ele vive na SecaoDeAnalise.
          graficos: (
            <div className="space-y-4">
              <SecaoDeAnalise
                titulo="Quanto entrou, e de quanta gente veio"
                icone={BanknoteIcon}
                descricao="Os dois cards saem da mesma série mensal de faturas aprovadas: um soma o valor, o outro conta pessoas distintas. Quando as duas curvas andam em ritmos diferentes, o que mudou foi o ticket, não o tamanho da base — e as duas terminam no mês do último webhook recebido."
              >
                <BentoItem span={6}>
                  <ChartCard
                    id="card-receita-mensal"
                    tone="brand"
                    icon={LineChartIcon}
                    title="Receita por mês"
                    headline={
                      melhorMes?.receita_brl != null
                        ? formatCurrencyCompact(melhorMes.receita_brl)
                        : '—'
                    }
                    headlineLabel={
                      melhorMes ? `no melhor mês (${formatMesAno(melhorMes.mes)})` : undefined
                    }
                    description="Faturas com pagamento aprovado · série encerra quando o rastreamento parou"
                    isLoading={mensal.isLoading}
                    isRefreshing={mensal.isFetching && !!mensal.data}
                    isError={mensal.isError}
                    onRetry={() => void mensal.refetch()}
                    isEmpty={mensal.data?.length === 0}
                  >
                    <TimeSeriesChart
                      variant="area"
                      data={(mensal.data ?? []).map((m) => ({
                        x: m.mes,
                        receita: m.receita_brl ?? 0,
                      }))}
                      series={[{ dataKey: 'receita', label: 'Receita' }]}
                      xTickFormatter={formatMesAno}
                      valueFormatter={formatCurrencyCompact}
                      className="h-[280px]"
                    />
                  </ChartCard>
                </BentoItem>

                <BentoItem span={6}>
                  <ChartCard
                    id="card-compradores-mes"
                    title="Compradores por mês"
                    description="Pessoas distintas com fatura paga no mês"
                    isLoading={mensal.isLoading}
                    isRefreshing={mensal.isFetching && !!mensal.data}
                    isError={mensal.isError}
                    onRetry={() => void mensal.refetch()}
                    isEmpty={mensal.data?.length === 0}
                  >
                    <CategoryBarChart
                      label="Compradores"
                      data={(mensal.data ?? []).map((m) => ({
                        category: formatMesAno(m.mes),
                        value: m.compradores,
                      }))}
                      valueFormatter={formatInt}
                      className="h-[260px]"
                    />
                  </ChartCard>
                </BentoItem>
              </SecaoDeAnalise>

              <SecaoDeAnalise
                titulo="Quanto do dinheiro cobrado não ficou"
                icone={TriangleAlertIcon}
                descricao="Aqui o denominador não é o mês, é o valor aprovado da série inteira — o percentual não se move ao trocar de aba nem acompanha a curva acima. Falha é dinheiro que nunca entrou; reembolso é dinheiro que entrou e voltou, e só os dois juntos explicam a distância entre o cobrado e o reconhecido."
              >
                <BentoItem span={12}>
                  <TabelaCard
                    id="card-saude-cobranca"
                    icon={CreditCardIcon}
                    title="Saúde da cobrança"
                    headline={
                      piorEventoCobranca?.pct_do_pago != null
                        ? formatPercent(piorEventoCobranca.pct_do_pago)
                        : '—'
                    }
                    headlineLabel={
                      piorEventoCobranca
                        ? `do valor pago em ${piorEventoCobranca.evento}`
                        : undefined
                    }
                    description="Falha de pagamento e reembolso comparados ao valor aprovado — dinheiro que tentou entrar e não entrou, ou entrou e voltou"
                    isLoading={cobranca.isLoading}
                    isRefreshing={cobranca.isFetching && !!cobranca.data}
                    isError={cobranca.isError}
                    onRetry={() => void cobranca.refetch()}
                    linhasEsqueleto={4}
                  >
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Evento</TableHead>
                          <TableHead className="text-right">Faturas</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                          <TableHead className="text-right">% do aprovado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(cobranca.data ?? []).map((c) => (
                          <TableRow key={c.evento}>
                            <TableCell className="font-medium">{c.evento}</TableCell>
                            <TableCell className="num text-right">{formatInt(c.faturas)}</TableCell>
                            <TableCell className="num text-right">
                              {c.valor_brl != null ? formatCurrency(c.valor_brl) : '—'}
                            </TableCell>
                            <TableCell className="num text-right font-medium">
                              {c.pct_do_pago != null ? formatPercent(c.pct_do_pago) : '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TabelaCard>
                </BentoItem>
              </SecaoDeAnalise>

              <SecaoDeAnalise
                titulo="O que cada grupo de cliente rendeu, e como ele usa"
                icone={LayersIcon}
                descricao="Os dois recortam a mesma base por chaves diferentes — mês de entrada e faixa de receita — e mostram média por grupo, então a coluna de clientes é o que diz se a média se sustenta. Os eixos de tempo divergem: a receita para no último webhook recebido, enquanto os dias ativos seguem contando o histórico inteiro de uso."
              >
                <BentoItem span={6}>
                  <TabelaCard
                    icon={SproutIcon}
                    title="Receita por safra de entrada"
                    headline={
                      melhorSafra?.receita_por_cliente != null
                        ? formatCurrency(melhorSafra.receita_por_cliente)
                        : '—'
                    }
                    headlineLabel={
                      melhorSafra
                        ? `por cliente na melhor safra (${formatMesAno(melhorSafra.cohort_mes)})`
                        : undefined
                    }
                    description="Clientes agrupados pelo mês em que entraram · receita por cliente considera toda a safra, inclusive quem nunca comprou"
                    isLoading={ltv.isLoading}
                    isRefreshing={ltv.isFetching && !!ltv.data}
                    isError={ltv.isError}
                    onRetry={() => void ltv.refetch()}
                  >
                    <TabelaLonga
                      linhas={ltv.data ?? []}
                      chave={(l) => l.cohort_mes}
                      buscarEm={(l) => [formatMesAno(l.cohort_mes)]}
                      rotuloBusca="Buscar safra"
                      vazio="Nenhuma safra com receita registrada."
                      cabecalho={
                        <TableRow>
                          <TableHead>Safra</TableHead>
                          <TableHead className="text-right">Clientes</TableHead>
                          <TableHead className="text-right">Compradores</TableHead>
                          <TableHead className="text-right">Receita</TableHead>
                          <TableHead className="text-right">Receita por cliente</TableHead>
                        </TableRow>
                      }
                      renderLinha={(l) => (
                        <TableRow>
                          <TableCell className="font-medium">
                            {formatMesAno(l.cohort_mes)}
                          </TableCell>
                          <TableCell className="num text-right">{formatInt(l.clientes)}</TableCell>
                          <TableCell className="num text-right">
                            {formatInt(l.compradores)}
                          </TableCell>
                          <TableCell className="num text-right">
                            {l.receita_brl != null ? formatCurrency(l.receita_brl) : '—'}
                          </TableCell>
                          <TableCell className="num text-right">
                            {l.receita_por_cliente != null
                              ? formatCurrency(l.receita_por_cliente)
                              : '—'}
                          </TableCell>
                        </TableRow>
                      )}
                    />
                  </TabelaCard>
                </BentoItem>

                <BentoItem span={6}>
                  <TabelaCard
                    icon={WalletIcon}
                    title="Quem paga mais usa mais?"
                    headline={
                      faixaTopo?.dias_ativos_medio != null
                        ? formatDecimal(faixaTopo.dias_ativos_medio)
                        : '—'
                    }
                    headlineLabel={faixaTopo ? `dias ativos na faixa ${faixaTopo.faixa}` : undefined}
                    description="Clientes agrupados por receita total · dias ativos é histórico completo · amostra pequena em algumas faixas, leia com cautela"
                    isLoading={usoReceita.isLoading}
                    isRefreshing={usoReceita.isFetching && !!usoReceita.data}
                    isError={usoReceita.isError}
                    onRetry={() => void usoReceita.refetch()}
                    linhasEsqueleto={3}
                  >
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Faixa de receita</TableHead>
                          <TableHead className="text-right">Clientes</TableHead>
                          <TableHead className="text-right">Receita média</TableHead>
                          <TableHead className="text-right">Dias ativos</TableHead>
                          <TableHead className="text-right">Ativos em 30d</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(usoReceita.data ?? []).map((u) => (
                          <TableRow key={u.faixa}>
                            <TableCell className="font-medium">{u.faixa}</TableCell>
                            <TableCell className="num text-right">{formatInt(u.clientes)}</TableCell>
                            <TableCell className="num text-right">
                              {u.receita_media != null ? formatCurrency(u.receita_media) : '—'}
                            </TableCell>
                            <TableCell className="num text-right">
                              {u.dias_ativos_medio != null
                                ? formatDecimal(u.dias_ativos_medio)
                                : '—'}
                            </TableCell>
                            <TableCell className="num text-right">
                              {u.pct_ativos_30d != null ? formatPercent(u.pct_ativos_30d) : '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TabelaCard>
                </BentoItem>
              </SecaoDeAnalise>

              {/* As linhas cruas por último: as MESMAS queries que os cards
                  acima já leram, passadas resolvidas. Nenhuma consulta nova —
                  se a camada de dados relesse o banco, ela poderia divergir do
                  card que ela deveria auditar. */}
              <AbaDeDados
                fontes={[
                  {
                    rpc: 'bi_receita_kpis',
                    titulo: 'Os quatro números do topo: receita, faturas, compradores e ticket',
                    descricao:
                      'uma linha só · dados_ate é a data do último pagamento APROVADO, e é onde toda série desta tela termina; fonte_ate é a do último registro de qualquer tipo, dezesseis dias depois — a fonte seguiu criando e falhando fatura sem aprovar nenhuma',
                    linhas: kpis.data ? [kpis.data] : [],
                    isLoading: kpis.isLoading,
                    isError: kpis.isError,
                    onRetry: () => void kpis.refetch(),
                  },
                  {
                    rpc: 'bi_receita_mensal',
                    titulo: 'Quanto entrou e quantas pessoas compraram, mês a mês',
                    descricao:
                      'a mesma série alimenta os dois primeiros cards · faturas com pagamento aprovado, deduplicadas',
                    linhas: mensal.data,
                    isLoading: mensal.isLoading,
                    isError: mensal.isError,
                    onRetry: () => void mensal.refetch(),
                  },
                  {
                    rpc: 'bi_receita_saude_cobranca',
                    titulo: 'Quanto do dinheiro cobrado falhou ou voltou',
                    descricao:
                      'pct_do_pago tem como denominador o valor aprovado da série inteira, não o do mês',
                    linhas: cobranca.data,
                    isLoading: cobranca.isLoading,
                    isError: cobranca.isError,
                    onRetry: () => void cobranca.refetch(),
                  },
                  {
                    rpc: 'bi_ltv_cohort',
                    titulo: 'O que cada safra de entrada rendeu',
                    descricao:
                      'receita_por_cliente divide pela safra inteira, inclusive quem nunca comprou',
                    linhas: ltv.data,
                    isLoading: ltv.isLoading,
                    isError: ltv.isError,
                    onRetry: () => void ltv.refetch(),
                  },
                  {
                    rpc: 'bi_uso_vs_receita',
                    titulo: 'Se quem paga mais também usa mais',
                    descricao:
                      'dias_ativos_medio é histórico completo de uso, não a janela da receita · amostra pequena em algumas faixas',
                    linhas: usoReceita.data,
                    isLoading: usoReceita.isLoading,
                    isError: usoReceita.isError,
                    onRetry: () => void usoReceita.refetch(),
                  },
                ]}
              />
            </div>
          ),

          analise: <AnaliseDaTela tela="receita" />,

          plano: <PlanoDaTela tela="receita" />,
        }}
      />
    </div>
  )
}
