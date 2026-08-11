import { CategoryBarChart, ChartCard, KpiCard, KpiGrid, TimeSeriesChart } from '@/components/charts'
import { BentoGrid, BentoItem } from '@/components/layout/bento'
import { ModuloTabs } from '@/components/layout/modulo-tabs'
import { TabelaLonga } from '@/components/tabela/tabela-longa'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
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
import {
  useLtvCohort,
  useReceitaKpis,
  useReceitaMensal,
  useSaudeCobranca,
  useUsoVsReceita,
} from '@/features/receita/queries'

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
        {Array.from({ length: 5 }, (_, i) => (
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

export function ReceitaPage() {
  const kpis = useReceitaKpis()
  const mensal = useReceitaMensal()
  const cobranca = useSaudeCobranca()
  const ltv = useLtvCohort()
  const usoReceita = useUsoVsReceita()

  const dadosAte = kpis.data?.dados_ate

  return (
    <div className="space-y-4">
      {/* Fora das abas: contexto do módulo inteiro. Trocar de aba não pode
          custar o número de referência nem obrigar a reajustar o período. */}
      <BentoGrid>
        <BentoItem span={12}>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Receita & Renovação</h2>
            <p className="text-muted-foreground text-sm">
              Receita reconhecida a partir dos webhooks de pagamento (Hubla), com faturas
              deduplicadas
            </p>
          </div>
        </BentoItem>

        <BentoItem span={12}>
          {/* Limitações são parte do dado: ficam visíveis, não em nota de rodapé */}
          <Card className="border-destructive/40">
            <CardHeader>
              <CardTitle className="text-base">Leia antes de usar estes números</CardTitle>
              <CardDescription className="space-y-1.5">
                <span className="block">
                  <strong>A fonte parou.</strong> O último webhook de pagamento recebido pela
                  plataforma é de{' '}
                  {dadosAte ? formatDateShort(dadosAte) : 'abr/2026'} — esta tela mostra o
                  histórico até essa data e <strong>não reflete a receita de hoje</strong>.
                </span>
                <span className="block">
                  <strong>A view de receita da plataforma está incorreta.</strong> A
                  <code className="bg-muted mx-1 rounded px-1 py-0.5 text-xs">bi_receita_hubla</code>
                  lê um caminho de JSON que não existe no payload real, então retorna vazio.
                  Aqui usamos o caminho correto — os dois números não vão bater.
                </span>
              </CardDescription>
            </CardHeader>
          </Card>
        </BentoItem>

        <BentoItem span={12}>
          <KpiGrid>
            <KpiCard
              label="Receita reconhecida"
              value={kpis.data?.receita_brl ?? 0}
              format={formatCurrencyCompact}
              isLoading={kpis.isLoading}
            />
            <KpiCard
              label="Faturas pagas"
              value={kpis.data?.faturas ?? 0}
              format={formatInt}
              isLoading={kpis.isLoading}
            />
            <KpiCard
              label="Compradores"
              value={kpis.data?.compradores ?? 0}
              format={formatInt}
              isLoading={kpis.isLoading}
            />
            <KpiCard
              label="Ticket mediano"
              value={kpis.data?.ticket_mediano ?? 0}
              format={formatCurrency}
              isLoading={kpis.isLoading}
            />
          </KpiGrid>
        </BentoItem>
      </BentoGrid>

      <ModuloTabs
        rota="/receita"
        conteudos={{
          receita: (
            <BentoGrid>
              <BentoItem span={8}>
                <ChartCard
                  title="Receita por mês"
                  description="Faturas com pagamento aprovado · série encerra quando o rastreamento parou"
                  isLoading={mensal.isLoading}
                  isError={mensal.isError}
                  onRetry={() => void mensal.refetch()}
                  isEmpty={mensal.data?.length === 0}
                >
                  <TimeSeriesChart
                    variant="area"
                    data={(mensal.data ?? []).map((m) => ({ x: m.mes, receita: m.receita_brl ?? 0 }))}
                    series={[{ dataKey: 'receita', label: 'Receita' }]}
                    xTickFormatter={formatMesAno}
                    valueFormatter={formatCurrencyCompact}
                    className="h-[280px]"
                  />
                </ChartCard>
              </BentoItem>

              <BentoItem span={4}>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Saúde da cobrança</CardTitle>
                    <CardDescription>
                      Falha de pagamento e reembolso comparados ao valor aprovado — dinheiro que
                      tentou entrar e não entrou, ou entrou e voltou
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <EstadoTabela isLoading={cobranca.isLoading} isError={cobranca.isError}>
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
                    </EstadoTabela>
                  </CardContent>
                </Card>
              </BentoItem>

              <BentoItem span={12}>
                <ChartCard
                  title="Compradores por mês"
                  description="Pessoas distintas com fatura paga no mês"
                  isLoading={mensal.isLoading}
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
            </BentoGrid>
          ),
          safra: (
            <BentoGrid>
              <BentoItem span={6}>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Receita por safra de entrada</CardTitle>
                    <CardDescription>
                      Clientes agrupados pelo mês em que entraram · receita por cliente considera
                      toda a safra, inclusive quem nunca comprou
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <EstadoTabela isLoading={ltv.isLoading} isError={ltv.isError}>
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
                            <TableCell className="font-medium">{formatMesAno(l.cohort_mes)}</TableCell>
                            <TableCell className="num text-right">{formatInt(l.clientes)}</TableCell>
                            <TableCell className="num text-right">{formatInt(l.compradores)}</TableCell>
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
                    </EstadoTabela>
                  </CardContent>
                </Card>
              </BentoItem>

              <BentoItem span={6}>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Quem paga mais usa mais?</CardTitle>
                    <CardDescription>
                      Clientes agrupados por receita total · dias ativos é histórico completo ·
                      amostra pequena em algumas faixas, leia com cautela
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <EstadoTabela isLoading={usoReceita.isLoading} isError={usoReceita.isError}>
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
                                {u.dias_ativos_medio != null ? formatDecimal(u.dias_ativos_medio) : '—'}
                              </TableCell>
                              <TableCell className="num text-right">
                                {u.pct_ativos_30d != null ? formatPercent(u.pct_ativos_30d) : '—'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
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
