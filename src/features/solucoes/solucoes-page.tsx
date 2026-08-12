import { useMemo, useState } from 'react'
import {
  ArchiveXIcon,
  LayersIcon,
  ListChecksIcon,
  RotateCcwIcon,
  SlidersHorizontalIcon,
  TrendingUpIcon,
  TrophyIcon,
} from 'lucide-react'
import { BentoCabecalho, BentoGrid, BentoItem } from '@/components/layout/bento'
import { ModuloTabs } from '@/components/layout/modulo-tabs'
import { TabelaCard } from '@/components/tabela/tabela-card'
import { TabelaLonga } from '@/components/tabela/tabela-longa'

import { CategoryBarChart, ChartCard, KpiCard, KpiGrid } from '@/components/charts'
import { PeriodoFiltro, type Periodo } from '@/components/filters/periodo-filtro'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatDateShort, formatDecimal, formatInt, formatPercent } from '@/lib/format'
import { fundoIntensidade } from '@/lib/intensidade'
import { AnaliseDaTela } from '@/features/resumo/analise-tela'
import {
  useCandidatasRemocao,
  useConclusaoPorAba,
  useConversaoTela,
  useEfeitoConclusao,
  useOrdemDaTentativa,
  useSolucoesKpis,
  useSolucoesPorCategoria,
  useSolucoesRanking,
} from '@/features/solucoes/queries'

export function SolucoesPage() {
  const [periodo, setPeriodo] = useState<Periodo>(30)

  const kpis = useSolucoesKpis(periodo)
  const conversao = useConversaoTela(periodo)
  const abas = useConclusaoPorAba()
  const candidatas = useCandidatasRemocao()
  const ranking = useSolucoesRanking()
  const categorias = useSolucoesPorCategoria()
  const efeitoConclusao = useEfeitoConclusao()
  const ordemTentativa = useOrdemDaTentativa()

  // Os dois lados de cada comparação: o headline afirma um e cita o outro, e os
  // dois saem do banco já suprimidos e arredondados.
  const concluiuAlguma = useMemo(
    () => (efeitoConclusao.data ?? []).find((e) => e.grupo === 'Concluiu alguma solução') ?? null,
    [efeitoConclusao.data],
  )
  const nuncaConcluiu = useMemo(
    () => (efeitoConclusao.data ?? []).find((e) => e.grupo === 'Iniciou e nunca concluiu') ?? null,
    [efeitoConclusao.data],
  )
  const primeiraTentativa = useMemo(
    () => (ordemTentativa.data ?? []).find((o) => o.grupo === 'A primeira que tentou') ?? null,
    [ordemTentativa.data],
  )
  const tentativasSeguintes = useMemo(
    () => (ordemTentativa.data ?? []).find((o) => o.grupo === 'Da segunda em diante') ?? null,
    [ordemTentativa.data],
  )

  const solucaoLider = ranking.data?.[0] ?? null

  const categoriaLider = useMemo(() => {
    const cats = categorias.data ?? []
    if (cats.length === 0) return null
    const maior = cats.reduce((a, b) => (b.iniciadas > a.iniciadas ? b : a))
    const total = cats.reduce((soma, c) => soma + c.iniciadas, 0)
    return total > 0 ? { categoria: maior.categoria, parte: maior.iniciadas / total } : null
  }, [categorias.data])

  // Última etapa do funil da tela: do catálogo até concluir.
  const conclusaoDoCatalogo = conversao.data?.at(-1)?.pct ?? null

  // A aba menos concluída é o que o card pede para olhar — as abas são
  // independentes, então valor baixo é aba pulada, não abandono.
  const abaMenosConcluida = useMemo(() => {
    const lista = (abas.data ?? []).filter((a) => a.pct_da_maior_aba != null)
    if (lista.length === 0) return null
    return lista.reduce((a, b) =>
      (b.pct_da_maior_aba ?? 0) < (a.pct_da_maior_aba ?? 0) ? b : a,
    )
  }, [abas.data])

  return (
    <div className="space-y-4">
      {/* Fora das abas: contexto do módulo inteiro. Trocar de aba não pode
          custar o número de referência nem obrigar a reajustar o período. */}
      <BentoGrid>
        <BentoCabecalho>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Soluções</h2>
            <p className="text-muted-foreground text-sm">
              Catálogo, conclusão das abas de implementação e candidatas a remoção
            </p>
          </div>
          <PeriodoFiltro valor={periodo} onChange={setPeriodo} />
        </BentoCabecalho>

        <BentoItem span={12}>
          <KpiGrid>
            <KpiCard
              label="Soluções publicadas"
              value={kpis.data?.publicadas ?? null}
              format={formatInt}
              isLoading={kpis.isLoading}
              isError={kpis.isError}
            />
            <KpiCard
              label="Iniciadas no período"
              value={kpis.data?.iniciadas_periodo ?? null}
              format={formatInt}
              isLoading={kpis.isLoading}
              isError={kpis.isError}
            />
            <KpiCard
              label="Concluídas no período"
              value={kpis.data?.concluidas_periodo ?? null}
              format={formatInt}
              isLoading={kpis.isLoading}
              isError={kpis.isError}
            />
            <KpiCard
              label="Conclusão (histórica)"
              value={kpis.data?.taxa_conclusao_historica ?? null}
              format={formatPercent}
              isLoading={kpis.isLoading}
              isError={kpis.isError}
            />
          </KpiGrid>
        </BentoItem>
      </BentoGrid>

      <ModuloTabs
        rota="/solucoes"
        conteudos={{
          analise: <AnaliseDaTela tela="solucoes" periodo={periodo} />,
          catalogo: (
            <BentoGrid>
              <BentoItem span={6}>
                <TabelaCard
                  nivel="descritivo"
                  id="card-ranking-solucoes"
                  icon={TrophyIcon}
                  title="Ranking de soluções"
                  headline={solucaoLider ? formatInt(solucaoLider.iniciadas) : '—'}
                  headlineLabel={
                    solucaoLider ? `inícios na líder (${solucaoLider.solucao})` : undefined
                  }
                  description="Ordenado por vezes iniciadas (histórico) · nota em escala 0–10 · somente clientes · pageviews da página da solução, desde jul/2026"
                  isLoading={ranking.isLoading}
                  isError={ranking.isError}
                  onRetry={() => void ranking.refetch()}
                >
                  <TabelaLonga
                    linhas={ranking.data ?? []}
                    chave={(r) => String(r.solucao)}
                    buscarEm={(r) => [r.solucao, r.categoria]}
                    rotuloBusca="Buscar por solução ou categoria"
                    cabecalho={
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
                    }
                    renderLinha={(r) => (
                      <TableRow>
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
                    )}
                  />
                </TabelaCard>
              </BentoItem>

              <BentoItem span={6}>
                <ChartCard
                  tone="brand"
                  nivel="descritivo"
                  icon={LayersIcon}
                  title="Uso por categoria"
                  headline={categoriaLider ? formatPercent(categoriaLider.parte) : '—'}
                  headlineLabel={categoriaLider ? `em ${categoriaLider.categoria}` : undefined}
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
              </BentoItem>
            </BentoGrid>
          ),
          implementacao: (
            <BentoGrid>
              <BentoItem span={6}>
                <TabelaCard
                  nivel="diagnostico"
                  id="card-funil-tela"
                  icon={SlidersHorizontalIcon}
                  title="A tela de Soluções está boa?"
                  headline={
                    conclusaoDoCatalogo != null ? formatPercent(conclusaoDoCatalogo) : '—'
                  }
                  headlineLabel="do catálogo chega a concluir"
                  /* a janela é recortada no início do rastreio de navegação: as 4
                     etapas precisam cobrir o mesmo período, senão o funil passa de
                     100% (era o caso no filtro de 90 dias) */
                  description={
                    'Catálogo → detalhe → início → conclusão · usuários únicos' +
                    (conversao.data?.[0]?.desde
                      ? ` desde ${formatDateShort(conversao.data[0].desde)}, quando a navegação passou a ser rastreada`
                      : ` nos últimos ${periodo} dias`)
                  }
                  isLoading={conversao.isLoading}
                  isError={conversao.isError}
                  onRetry={() => void conversao.refetch()}
                  linhasEsqueleto={4}
                >
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
                          <TableCell className="num text-right" style={fundoIntensidade(c.pct)}>
                            {c.pct != null ? formatPercent(c.pct) : '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TabelaCard>

              </BentoItem>

              <BentoItem span={6}>
                <TabelaCard
                  nivel="diagnostico"
                  icon={ListChecksIcon}
                  title="Conclusão por aba da implementação"
                  headline={
                    abaMenosConcluida?.pct_da_maior_aba != null
                      ? formatPercent(abaMenosConcluida.pct_da_maior_aba)
                      : '—'
                  }
                  headlineLabel={
                    abaMenosConcluida ? `na aba menos concluída (${abaMenosConcluida.aba})` : undefined
                  }
                  description="Usuários únicos que concluíram cada aba, na ordem temporal típica de uso. As abas são independentes — dá para concluir uma sem passar pela anterior —, então não é funil: valor baixo é aba pulada, não abandono. Base de comparação é a aba mais concluída."
                  isLoading={abas.isLoading}
                  isError={abas.isError}
                  onRetry={() => void abas.refetch()}
                  linhasEsqueleto={6}
                >
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Aba</TableHead>
                        <TableHead className="text-right">Usuários</TableHead>
                        <TableHead className="text-right">% da maior aba</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(abas.data ?? []).map((f) => (
                        <TableRow key={f.aba}>
                          <TableCell className="font-medium">{f.aba}</TableCell>
                          <TableCell className="num text-right">{formatInt(f.usuarios)}</TableCell>
                          <TableCell className="num text-right" style={fundoIntensidade(f.pct_da_maior_aba)}>
                            {f.pct_da_maior_aba != null ? formatPercent(f.pct_da_maior_aba) : '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TabelaCard>
              </BentoItem>

              <BentoItem span={6}>
                <TabelaCard
                  nivel="comparativo"
                  id="card-efeito-conclusao"
                  icon={TrendingUpIcon}
                  title="Concluir solução importa?"
                  headline={
                    concluiuAlguma?.pct_ativo != null
                      ? formatPercent(concluiuAlguma.pct_ativo)
                      : '—'
                  }
                  headlineLabel={
                    nuncaConcluiu?.pct_ativo != null
                      ? `seguem ativos, contra ${formatPercent(nuncaConcluiu.pct_ativo)} de quem só iniciou`
                      : 'de quem concluiu segue ativo'
                  }
                  description={
                    concluiuAlguma
                      ? `Clientes com 120+ dias de casa · os dois lados já iniciaram alguma solução, de propósito: sem isso a conta mediria quem entrou no módulo · margem de ${formatDecimal(concluiuAlguma.margem_pp)} pp · associação, não causa`
                      : 'Clientes com 120+ dias de casa que já iniciaram alguma solução'
                  }
                  isLoading={efeitoConclusao.isLoading}
                  isError={efeitoConclusao.isError}
                  onRetry={() => void efeitoConclusao.refetch()}
                  linhasEsqueleto={2}
                >
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Grupo</TableHead>
                        <TableHead className="text-right">Clientes</TableHead>
                        <TableHead className="text-right">Agiram nos 30d</TableHead>
                        <TableHead className="text-right">Taxa</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(efeitoConclusao.data ?? []).map((e) => (
                        <TableRow key={e.grupo}>
                          <TableCell className="font-medium">{e.grupo}</TableCell>
                          <TableCell className="num text-right">{formatInt(e.clientes)}</TableCell>
                          <TableCell className="num text-right">{formatInt(e.ativos)}</TableCell>
                          <TableCell className="num text-right font-medium">
                            {e.pct_ativo != null ? formatPercent(e.pct_ativo) : '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TabelaCard>
              </BentoItem>

              <BentoItem span={6}>
                <TabelaCard
                  nivel="comparativo"
                  id="card-ordem-da-tentativa"
                  icon={RotateCcwIcon}
                  title="A primeira tentativa é a que mais termina"
                  headline={
                    primeiraTentativa?.pct != null ? formatPercent(primeiraTentativa.pct) : '—'
                  }
                  headlineLabel={
                    tentativasSeguintes?.pct != null
                      ? `na 1ª solução, contra ${formatPercent(tentativasSeguintes.pct)} da 2ª em diante`
                      : 'concluem a primeira solução que tentam'
                  }
                  description={
                    primeiraTentativa
                      ? `Só clientes que tentaram 2+ soluções, com 60+ dias desde o início · os dois grupos são as MESMAS ${formatInt(primeiraTentativa.clientes)} pessoas, então a diferença entre clientes sai de cena · margem de ${formatDecimal(primeiraTentativa.margem_pp)} pp`
                      : 'Clientes que tentaram 2+ soluções, com 60+ dias desde o início'
                  }
                  isLoading={ordemTentativa.isLoading}
                  isError={ordemTentativa.isError}
                  onRetry={() => void ordemTentativa.refetch()}
                  linhasEsqueleto={2}
                >
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ordem da tentativa</TableHead>
                        <TableHead className="text-right">Tentativas</TableHead>
                        <TableHead className="text-right">Concluídas</TableHead>
                        <TableHead className="text-right">Taxa</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(ordemTentativa.data ?? []).map((o) => (
                        <TableRow key={o.grupo}>
                          <TableCell className="font-medium">{o.grupo}</TableCell>
                          <TableCell className="num text-right">
                            {formatInt(o.tentativas)}
                          </TableCell>
                          <TableCell className="num text-right">
                            {formatInt(o.concluidas)}
                          </TableCell>
                          <TableCell className="num text-right font-medium">
                            {o.pct != null ? formatPercent(o.pct) : '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TabelaCard>
              </BentoItem>
            </BentoGrid>
          ),
          curadoria: (
            <BentoGrid>
              <BentoItem span={12}>
                <TabelaCard
                  nivel="prescritivo"
                  icon={ArchiveXIcon}
                  title="Candidatas a remoção ou revisão"
                  headline={candidatas.data ? formatInt(candidatas.data.length) : '—'}
                  headlineLabel="soluções para revisar"
                  description="Soluções publicadas no quartil inferior de uso ou sem nenhuma conclusão · revisar antes de remover: nota alta com pouco uso pode ser problema de descoberta, não de qualidade · pageviews só desde jul/2026, então podem ficar abaixo das iniciadas (histórico completo)"
                  isLoading={candidatas.isLoading}
                  isError={candidatas.isError}
                  onRetry={() => void candidatas.refetch()}
                >
                  <TabelaLonga
                    linhas={candidatas.data ?? []}
                    chave={(c) => String(c.solucao)}
                    buscarEm={(c) => [c.solucao, c.categoria]}
                    rotuloBusca="Buscar por solução ou categoria"
                    cabecalho={
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
                    }
                    renderLinha={(c) => (
                      <TableRow>
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
