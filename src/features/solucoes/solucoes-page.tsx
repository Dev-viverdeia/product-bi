import { useState } from 'react'

import { CategoryBarChart, ChartCard, KpiCard, KpiGrid } from '@/components/charts'
import { PeriodoFiltro, type Periodo } from '@/components/filters/periodo-filtro'
import { Badge } from '@/components/ui/badge'
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
import { formatDateShort, formatDecimal, formatInt, formatPercent } from '@/lib/format'
import {
  useCandidatasRemocao,
  useConversaoTela,
  useFunilAbas,
  useSolucoesKpis,
  useSolucoesPorCategoria,
  useSolucoesRanking,
} from '@/features/solucoes/queries'

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
        {Array.from({ length: 6 }, (_, i) => (
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

/* Tinta de intensidade nas etapas do funil (mesma técnica das outras telas) */
function fundoFunil(pct: number | null) {
  if (pct == null) return undefined
  const alfa = Math.min(pct, 1) * 0.45
  return {
    background: `color-mix(in oklab, var(--color-data-1) ${Math.round(alfa * 100)}%, transparent)`,
  }
}

export function SolucoesPage() {
  const [periodo, setPeriodo] = useState<Periodo>(30)

  const kpis = useSolucoesKpis(periodo)
  const conversao = useConversaoTela(periodo)
  const funil = useFunilAbas()
  const candidatas = useCandidatasRemocao()
  const ranking = useSolucoesRanking()
  const categorias = useSolucoesPorCategoria()

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Soluções</h2>
          <p className="text-muted-foreground text-sm">
            Catálogo, funil de implementação e candidatas a remoção
          </p>
        </div>
        <PeriodoFiltro valor={periodo} onChange={setPeriodo} />
      </div>

      <KpiGrid>
        <KpiCard
          label="Soluções publicadas"
          value={kpis.data?.publicadas ?? 0}
          format={formatInt}
          isLoading={kpis.isLoading}
        />
        <KpiCard
          label="Iniciadas no período"
          value={kpis.data?.iniciadas_periodo ?? 0}
          format={formatInt}
          isLoading={kpis.isLoading}
        />
        <KpiCard
          label="Concluídas no período"
          value={kpis.data?.concluidas_periodo ?? 0}
          format={formatInt}
          isLoading={kpis.isLoading}
        />
        <KpiCard
          label="Conclusão (histórica)"
          value={kpis.data?.taxa_conclusao_historica ?? 0}
          format={formatPercent}
          isLoading={kpis.isLoading}
        />
      </KpiGrid>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">A tela de Soluções está boa?</CardTitle>
            <CardDescription>
              Catálogo → detalhe → início → conclusão · usuários únicos
              {/* a janela é recortada no início do rastreio de navegação: as 4
                  etapas precisam cobrir o mesmo período, senão o funil passa
                  de 100% (era o caso no filtro de 90 dias) */}
              {conversao.data?.[0]?.desde
                ? ` desde ${formatDateShort(conversao.data[0].desde)}, quando a navegação passou a ser rastreada`
                : ` nos últimos ${periodo} dias`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EstadoTabela isLoading={conversao.isLoading} isError={conversao.isError}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Etapa</TableHead>
                    <TableHead className="text-right">Usuários</TableHead>
                    <TableHead className="text-right">% do catálogo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(conversao.data ?? []).map((c) => (
                    <TableRow key={c.etapa}>
                      <TableCell className="font-medium">{c.etapa}</TableCell>
                      <TableCell className="num text-right">{formatInt(c.usuarios)}</TableCell>
                      <TableCell className="num text-right" style={fundoFunil(c.pct)}>
                        {c.pct != null ? formatPercent(c.pct) : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </EstadoTabela>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Onde a implementação trava</CardTitle>
            <CardDescription>
              Usuários únicos por aba concluída · ordem validada pela sequência temporal
              real de uso · a plataforma não registra progresso parcial, então o funil
              vem das abas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EstadoTabela isLoading={funil.isLoading} isError={funil.isError}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Aba</TableHead>
                    <TableHead className="text-right">Usuários</TableHead>
                    <TableHead className="text-right">% do topo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(funil.data ?? []).map((f) => (
                    <TableRow key={f.aba}>
                      <TableCell className="font-medium">{f.aba}</TableCell>
                      <TableCell className="num text-right">{formatInt(f.usuarios)}</TableCell>
                      <TableCell className="num text-right" style={fundoFunil(f.pct_do_topo)}>
                        {f.pct_do_topo != null ? formatPercent(f.pct_do_topo) : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </EstadoTabela>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Candidatas a remoção ou revisão
          </CardTitle>
          <CardDescription>
            Soluções publicadas no quartil inferior de uso ou sem nenhuma conclusão ·
            revisar antes de remover: nota alta com pouco uso pode ser problema de
            descoberta, não de qualidade · pageviews só desde jul/2026, então
            podem ficar abaixo das iniciadas (histórico completo)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EstadoTabela isLoading={candidatas.isLoading} isError={candidatas.isError}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Solução</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead className="text-right">Pageviews</TableHead>
                  <TableHead className="text-right">Iniciadas</TableHead>
                  <TableHead className="text-right">Concluídas</TableHead>
                  <TableHead className="text-right">Nota</TableHead>
                  <TableHead className="text-right">Favoritos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(candidatas.data ?? []).map((c) => (
                  <TableRow key={c.solucao}>
                    <TableCell className="max-w-64 truncate font-medium">{c.solucao}</TableCell>
                    <TableCell>{c.categoria ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{c.motivo}</Badge>
                    </TableCell>
                    <TableCell className="num text-right">{formatInt(c.pageviews)}</TableCell>
                    <TableCell className="num text-right">{formatInt(c.iniciadas)}</TableCell>
                    <TableCell className="num text-right">{formatInt(c.concluidas)}</TableCell>
                    <TableCell className="num text-right">
                      {c.nota != null ? formatDecimal(c.nota) : '—'}
                    </TableCell>
                    <TableCell className="num text-right">{formatInt(c.favoritos)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </EstadoTabela>
        </CardContent>
      </Card>

      <ChartCard
        title="Uso por categoria"
        description="Soluções iniciadas por categoria (histórico completo)"
        isLoading={categorias.isLoading}
        isError={categorias.isError}
        onRetry={() => void categorias.refetch()}
        isEmpty={categorias.data?.length === 0}
      >
        <CategoryBarChart
          layout="bar"
          label="Iniciadas"
          data={(categorias.data ?? []).map((c) => ({
            category: c.categoria,
            value: c.iniciadas,
          }))}
          valueFormatter={formatInt}
          className="h-[320px]"
        />
      </ChartCard>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ranking de soluções</CardTitle>
          <CardDescription>
            Ordenado por vezes iniciadas (histórico) · nota em escala 0–10 ·
            somente clientes · pageviews da página da solução, desde jul/2026
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EstadoTabela isLoading={ranking.isLoading} isError={ranking.isError}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Solução</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Pageviews</TableHead>
                  <TableHead className="text-right">Iniciadas</TableHead>
                  <TableHead className="text-right">Concluídas</TableHead>
                  <TableHead className="text-right">Conclusão</TableHead>
                  <TableHead className="text-right">Nota</TableHead>
                  <TableHead className="text-right">Favoritos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(ranking.data ?? []).map((r) => (
                  <TableRow key={r.solucao}>
                    <TableCell className="max-w-64 truncate font-medium">{r.solucao}</TableCell>
                    <TableCell>{r.categoria ?? '—'}</TableCell>
                    <TableCell className="num text-right">{formatInt(r.pageviews)}</TableCell>
                    <TableCell className="num text-right">{formatInt(r.iniciadas)}</TableCell>
                    <TableCell className="num text-right">{formatInt(r.concluidas)}</TableCell>
                    <TableCell className="num text-right">
                      {r.taxa_conclusao != null ? formatPercent(r.taxa_conclusao) : '—'}
                    </TableCell>
                    <TableCell className="num text-right">
                      {r.nota != null ? formatDecimal(r.nota) : '—'}
                    </TableCell>
                    <TableCell className="num text-right">{formatInt(r.favoritos)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </EstadoTabela>
        </CardContent>
      </Card>
    </div>
  )
}
