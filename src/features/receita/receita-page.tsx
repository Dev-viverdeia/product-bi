import { useMemo } from 'react'
import { CreditCardIcon, LineChartIcon, SproutIcon, WalletIcon } from 'lucide-react'

import { CategoryBarChart, ChartCard, KpiCard, KpiGrid, TimeSeriesChart } from '@/components/charts'
import { BentoGrid, BentoItem } from '@/components/layout/bento'
import { ModuloTabs } from '@/components/layout/modulo-tabs'
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

  const dadosAte = kpis.data?.dados_ate

  // Melhor mês da série — o teto que a receita já alcançou.
  const melhorMes = useMemo(() => {
    const meses = (mensal.data ?? []).filter((m) => m.receita_brl != null)
    if (meses.length === 0) return null
    return meses.reduce((a, b) => ((b.receita_brl ?? 0) > (a.receita_brl ?? 0) ? b : a))
  }, [mensal.data])

  // O card de cobrança é sobre dinheiro que não entrou: lidera pelo pior evento.
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
                  tone="brand"
                  icon={LineChartIcon}
                  title="Receita por mês"
                  headline={
                    melhorMes?.receita_brl != null
                      ? formatCurrencyCompact(melhorMes.receita_brl)
                      : '—'
                  }
                  headlineLabel={melhorMes ? `no melhor mês (${formatMesAno(melhorMes.mes)})` : undefined}
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
                <TabelaCard
                  icon={CreditCardIcon}
                  title="Saúde da cobrança"
                  headline={
                    piorEventoCobranca?.pct_do_pago != null
                      ? formatPercent(piorEventoCobranca.pct_do_pago)
                      : '—'
                  }
                  headlineLabel={
                    piorEventoCobranca ? `do valor pago em ${piorEventoCobranca.evento}` : undefined
                  }
                  description="Falha de pagamento e reembolso comparados ao valor aprovado — dinheiro que tentou entrar e não entrou, ou entrou e voltou"
                  isLoading={cobranca.isLoading}
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
                <TabelaCard
                  icon={SproutIcon}
                  title="Receita por safra de entrada"
                  headline={
                    melhorSafra?.receita_por_cliente != null
                      ? formatCurrency(melhorSafra.receita_por_cliente)
                      : '—'
                  }
                  headlineLabel={
                    melhorSafra ? `por cliente na melhor safra (${formatMesAno(melhorSafra.cohort_mes)})` : undefined
                  }
                  description="Clientes agrupados pelo mês em que entraram · receita por cliente considera toda a safra, inclusive quem nunca comprou"
                  isLoading={ltv.isLoading}
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
                            {u.dias_ativos_medio != null ? formatDecimal(u.dias_ativos_medio) : '—'}
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
            </BentoGrid>
          ),
        }}
      />
    </div>
  )
}
