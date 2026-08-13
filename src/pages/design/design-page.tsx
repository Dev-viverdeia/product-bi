import { useState } from 'react'
import {
  ChartColumnIcon,
  CoinsIcon,
  LayersIcon,
  PieChartIcon,
  RadioIcon,
  ClockIcon,
  TableIcon,
  UsersIcon,
} from 'lucide-react'

import {
  CategoryBarChart,
  ChartCard,
  DonutChart,
  HeatmapChart,
  KpiCard,
  KpiGrid,
  TimeSeriesChart,
} from '@/components/charts'
import { SegmentoFiltro } from '@/components/filters/segmento-filtro'
import { BentoItem } from '@/components/layout/bento'
import { SecaoDeAnalise } from '@/components/layout/secao-de-analise'
import { ListaDeAcao, type ItemDeAcao } from '@/components/tabela/lista-de-acao'
import { TabelaCard } from '@/components/tabela/tabela-card'
import { ControleSegmentado } from '@/components/ui-marca/controle-segmentado'
import { TabelaLonga } from '@/components/tabela/tabela-longa'
import { Button } from '@/components/ui/button'
import { TableCell, TableHead, TableRow } from '@/components/ui/table'
import {
  formatCompact,
  formatCurrency,
  formatCurrencyCompact,
  formatInt,
  formatMonthShort,
  formatPercent,
} from '@/lib/format'
import { notaAmostra } from '@/lib/segmento'
import { cn } from '@/lib/utils'
import {
  assinaturasPorPlano,
  kpis,
  receitaMensal,
  receitaPorProduto,
  sessoesPorCanal,
  usuariosMensal,
} from '@/pages/design/sample-data'

type DemoState = 'ok' | 'loading' | 'empty' | 'error' | 'sem-amostra'

/** Recorte só para exercitar o segmentado — não escreve na URL. */
const RECORTES_DEMO = [
  { valor: 'todos', rotulo: 'Todos' },
  { valor: 'comprador', rotulo: 'Comprador' },
  { valor: 'convidado', rotulo: 'Convidado' },
] as const

/*
  Os quatro degraus, na ordem em que aparecem na tela. Referenciam a UTILITY
  (`bg-moldura`) e não o valor: o showcase existe para exercitar o token, então
  se um degrau sumir do tema o quadrado fica transparente e o defeito aparece
  aqui antes de aparecer em produto.
*/
const SUPERFICIES = [
  { nome: 'página', classe: 'bg-background', papel: 'margem em volta da moldura' },
  { nome: 'moldura', classe: 'bg-moldura', papel: 'o quadro — e a cor da aba ativa' },
  { nome: 'seção', classe: 'bg-secao', papel: 'agrupa cards da mesma pergunta' },
  { nome: 'cromo · card', classe: 'bg-card', papel: 'barra, rail e card — o único branco' },
] as const

/** Amostra da lista de ação — nomes fictícios, como o resto do showcase. */
const clientesEmRisco: ItemDeAcao[] = [
  { id: '1', titulo: 'Ricardo Souza', subtitulo: 'Órbita Digital · Pro', valor: '47 d' },
  { id: '2', titulo: 'Carla Menezes', subtitulo: 'Vetor Consultoria · Enterprise', valor: '39 d' },
  { id: '3', titulo: 'André Pacheco', subtitulo: 'Casa Nova · Pro', valor: '31 d' },
]

const demoStates: { value: DemoState; label: string }[] = [
  { value: 'ok', label: 'Normal' },
  { value: 'loading', label: 'Carregando' },
  { value: 'empty', label: 'Vazio' },
  { value: 'error', label: 'Erro' },
  { value: 'sem-amostra', label: 'Sem amostra' },
]

/**
 * Showcase interno do kit de gráficos — cada peça é validada aqui (light,
 * dark, mobile) antes de entrar em módulo de produto.
 */
export function DesignPage() {
  // O seletor governa também os KpiCards do topo: o estado de erro do stat tile
  // é justamente o que não existia antes, e sem demonstrá-lo aqui ele voltaria a
  // passar despercebido. KPI que mostra 0 quando a consulta falhou é número
  // errado com cara de certo.
  const [demoState, setDemoState] = useState<DemoState>('ok')
  const [recorteDemo, setRecorteDemo] = useState<(typeof RECORTES_DEMO)[number]['valor']>('todos')

  // Headlines derivados do próprio dado de exemplo — o showcase segue a mesma
  // regra do produto: o número que responde o card sai do que ele desenha.
  const melhorMes = receitaMensal.reduce((a, b) => (Number(b.receita) > Number(a.receita) ? b : a))
  const canalLider = sessoesPorCanal.reduce((a, b) => (b.value > a.value ? b : a))
  const totalSessoes = sessoesPorCanal.reduce((soma, c) => soma + c.value, 0)
  const produtoLider = receitaPorProduto.reduce((a, b) => (b.value > a.value ? b : a))
  const totalAssinaturas = assinaturasPorPlano.reduce((soma, p) => soma + p.value, 0)
  const ultimoMes = usuariosMensal.at(-1)

  // padrão determinístico: pico em dias úteis, 10h–16h
  const dadosHeatmap = Array.from({ length: 7 }, (_, dia) =>
    Array.from({ length: 24 }, (_, hora) => ({
      dia,
      hora,
      valor:
        dia === 0 || dia === 6
          ? Math.max(0, 12 - Math.abs(hora - 14) * 2)
          : Math.max(0, 80 - Math.abs(hora - 11) * 9 - (dia === 5 ? 18 : 0)),
    })),
  ).flat()
  const picoHeatmap = dadosHeatmap.reduce((maior, c) => Math.max(maior, c.valor), 0)

  // 19 linhas de propósito: é o tamanho em que a paginação de 12 aparece, que
  // é o comportamento que este card existe para validar.
  const linhasDaTabela = Array.from({ length: 19 }, (_, i) => {
    const base = receitaPorProduto[i % receitaPorProduto.length]
    const volta = Math.floor(i / receitaPorProduto.length)
    return {
      produto: volta === 0 ? base.category : `${base.category} ${volta + 1}`,
      receita: base.value / (volta + 1),
      assinantes: ([1180, 890, 240, 310, 12][i % 5] ?? 0) / (volta + 1),
    }
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Design system</h2>
          <p className="text-muted-foreground text-sm">
            Showcase do kit de gráficos — dados de exemplo · o recorte ao lado é o
            componente real e escreve na URL
          </p>
        </div>
        <SegmentoFiltro />
      </div>

      <KpiGrid>
        <KpiCard
          label="Receita (mês)"
          icone={CoinsIcon}
          value={demoState === 'sem-amostra' ? null : kpis.receita.value}
          format={formatCurrencyCompact}
          delta={{ value: kpis.receita.delta, vs: 'vs mês anterior' }}
          trend={kpis.receita.trend}
          motivoSemValor={notaAmostra(12)}
          isLoading={demoState === 'loading'}
          isError={demoState === 'error'}
        />
        <KpiCard
          label="Usuários ativos"
          icone={UsersIcon}
          value={demoState === 'sem-amostra' ? null : kpis.usuariosAtivos.value}
          format={formatInt}
          delta={{ value: kpis.usuariosAtivos.delta, vs: 'vs mês anterior' }}
          trend={kpis.usuariosAtivos.trend}
          motivoSemValor={notaAmostra(12)}
          isLoading={demoState === 'loading'}
          isError={demoState === 'error'}
        />
        <KpiCard
          label="Conversão"
          icone={ChartColumnIcon}
          value={demoState === 'sem-amostra' ? null : kpis.conversao.value}
          format={formatPercent}
          delta={{ value: kpis.conversao.delta, vs: 'vs mês anterior' }}
          trend={kpis.conversao.trend}
          motivoSemValor={notaAmostra(12)}
          isLoading={demoState === 'loading'}
          isError={demoState === 'error'}
        />
        <KpiCard
          label="Churn"
          icone={ClockIcon}
          value={demoState === 'sem-amostra' ? null : kpis.churn.value}
          format={formatPercent}
          delta={{ value: kpis.churn.delta, vs: 'vs mês anterior', upIsGood: false }}
          trend={kpis.churn.trend}
          motivoSemValor={notaAmostra(12)}
          isLoading={demoState === 'loading'}
          isError={demoState === 'error'}
        />
      </KpiGrid>

      {/* A seção é o degrau de hierarquia entre a tela e o card. Aqui ela é
          também a prova da rampa: o cinza dela precisa se distinguir da moldura
          atrás e dos cards brancos dentro, nos dois temas. */}
      <SecaoDeAnalise
        titulo="Fundação do layout"
        icone={LayersIcon}
        descricao="Peças do shell fora do kit de gráficos. A seção é o contêiner desta caixa cinza; o segmentado e a lista de ação são componentes dentro dela."
        controles={
          <ControleSegmentado
            rotulo="Recorte da seção (demonstração)"
            valor={recorteDemo}
            opcoes={RECORTES_DEMO}
            onChange={setRecorteDemo}
          />
        }
      >
        <BentoItem span={6}>
          <TabelaCard
            icon={UsersIcon}
            title="Clientes em risco"
            headline={formatInt(clientesEmRisco.length)}
            headlineLabel="para contatar esta semana"
            description="Lista de ação: quem contatar primeiro, não como o risco se distribui. Ordenada por dias sem aparecer."
          >
            <ListaDeAcao
              itens={clientesEmRisco}
              isLoading={demoState === 'loading'}
              rodape="Ativo nos 60 dias anteriores e zero nos últimos 14."
              verTodos={{ para: '/clientes' }}
            />
          </TabelaCard>
        </BentoItem>

        <BentoItem span={6}>
          <TabelaCard
            icon={LayersIcon}
            title="Rampa de superfícies"
            headline="4"
            headlineLabel="degraus, do fundo ao cromo"
            description="A aba ativa da barra é pintada com a cor da moldura. Se moldura e cromo chegarem perto demais, ela desaparece — por isso o piso é medido, não escolhido no olho."
          >
            <ul className="space-y-2">
              {SUPERFICIES.map((superficie) => (
                <li key={superficie.nome} className="flex items-center gap-3">
                  <span
                    className={cn(
                      'border-border size-10 shrink-0 rounded-md border',
                      superficie.classe,
                    )}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{superficie.nome}</p>
                    <p className="text-muted-foreground text-xs">{superficie.papel}</p>
                  </div>
                </li>
              ))}
            </ul>
          </TabelaCard>
        </BentoItem>
      </SecaoDeAnalise>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          tone="brand"
          icon={CoinsIcon}
          title="Receita mensal"
          headline={formatCurrencyCompact(Number(melhorMes.receita))}
          headlineLabel={`no melhor mês (${formatMonthShort(String(melhorMes.x))})`}
          description="Últimos 12 meses · bloco navy de destaque — um por tela"
        >
          <TimeSeriesChart
            variant="area"
            data={receitaMensal}
            series={[{ dataKey: 'receita', label: 'Receita' }]}
            xTickFormatter={formatMonthShort}
            valueFormatter={formatCurrencyCompact}
          />
        </ChartCard>

        <ChartCard
          icon={UsersIcon}
          title="Usuários por mês"
          headline={
            ultimoMes
              ? formatCompact(Number(ultimoMes.recorrentes) + Number(ultimoMes.novos))
              : '—'
          }
          headlineLabel="no último mês"
          description="Novos × recorrentes — 2ª série tracejada (segundo canal)"
        >
          <TimeSeriesChart
            data={usuariosMensal}
            series={[
              { dataKey: 'recorrentes', label: 'Recorrentes' },
              { dataKey: 'novos', label: 'Novos' },
            ]}
            xTickFormatter={formatMonthShort}
            valueFormatter={formatCompact}
          />
        </ChartCard>

        <ChartCard
          icon={RadioIcon}
          title="Sessões por canal"
          headline={formatPercent(canalLider.value / totalSessoes)}
          headlineLabel={`em ${canalLider.category}`}
          description="Agosto de 2026"
        >
          <CategoryBarChart
            data={sessoesPorCanal}
            label="Sessões"
            valueFormatter={formatCompact}
          />
        </ChartCard>

        <ChartCard
          icon={ChartColumnIcon}
          title="Receita por produto"
          headline={formatCurrencyCompact(produtoLider.value)}
          headlineLabel={`no líder (${produtoLider.category})`}
          description="Barras horizontais para categorias longas"
        >
          <CategoryBarChart
            data={receitaPorProduto}
            label="Receita"
            layout="bar"
            valueFormatter={formatCurrencyCompact}
          />
        </ChartCard>

        <ChartCard
          icon={PieChartIcon}
          title="Assinaturas por plano"
          headline={formatInt(totalAssinaturas)}
          headlineLabel="assinaturas no total"
          description="6 planos → 4 + “Outros” (regra de fatias do DS)"
        >
          <DonutChart
            data={assinaturasPorPlano}
            totalLabel="assinaturas"
            valueFormatter={formatInt}
          />
        </ChartCard>

        <ChartCard
          icon={LayersIcon}
          title="Estados"
          description="Todo gráfico nasce com os quatro · o seletor governa também os KpiCards do topo — erro e “sem amostra” (percentual suprimido pela régua de 30) são os estados que não podiam faltar"
          action={
            <div className="flex flex-wrap gap-1">
              {demoStates.map((state) => (
                <Button
                  key={state.value}
                  size="sm"
                  variant={demoState === state.value ? 'secondary' : 'ghost'}
                  onClick={() => setDemoState(state.value)}
                >
                  {state.label}
                </Button>
              ))}
            </div>
          }
          isLoading={demoState === 'loading'}
          isEmpty={demoState === 'empty'}
          isError={demoState === 'error'}
          onRetry={() => setDemoState('loading')}
        >
          <div />
        </ChartCard>
      </div>

      <ChartCard
        icon={ClockIcon}
        title="Heatmap dia × hora"
        headline={formatInt(picoHeatmap)}
        headlineLabel="eventos na célula de pico"
        description="Sequencial de 1 hue por alfa — funciona igual nos 2 temas"
      >
        <HeatmapChart label="eventos" data={dadosHeatmap} />
      </ChartCard>

      {/* TabelaCard: mesmo cabeçalho do card de gráfico, tabela plana (sem
          vidro) e a TabelaLonga por dentro. Com 19 linhas os controles de busca
          e paginação aparecem — abaixo de uma página eles ficam escondidos. */}
      <TabelaCard
        icon={TableIcon}
        title="Tabela densa"
        headline={formatCurrency(produtoLider.value)}
        headlineLabel={`no líder (${produtoLider.category})`}
        description="Plana, sem vidro (regra do DS) · doze linhas por página · a busca varre o nome do produto · números em mono tabular, alinhados à direita"
      >
        <TabelaLonga
          linhas={linhasDaTabela}
          chave={(l) => l.produto}
          buscarEm={(l) => [l.produto]}
          rotuloBusca="Buscar produto"
          cabecalho={
            <TableRow>
              <TableHead>Produto</TableHead>
              <TableHead className="text-right">Receita</TableHead>
              <TableHead className="text-right">Assinantes</TableHead>
              <TableHead className="text-right">Ticket médio</TableHead>
            </TableRow>
          }
          renderLinha={(l) => (
            <TableRow>
              <TableCell>{l.produto}</TableCell>
              <TableCell className="num text-right">{formatCurrency(l.receita)}</TableCell>
              <TableCell className="num text-right">{formatInt(l.assinantes)}</TableCell>
              <TableCell className="num text-right">
                {formatCurrency(l.assinantes ? l.receita / l.assinantes : 0)}
              </TableCell>
            </TableRow>
          )}
        />
      </TabelaCard>
    </div>
  )
}
