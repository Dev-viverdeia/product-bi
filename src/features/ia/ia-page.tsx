import { useMemo, useState } from 'react'
import {
  BotIcon,
  DoorOpenIcon,
  GaugeIcon,
  LayersIcon,
  MessagesSquareIcon,
  RepeatIcon,
  RouteIcon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
  TargetIcon,
  TrendingUpIcon,
  UserRoundSearchIcon,
  WrenchIcon,
} from 'lucide-react'
import { BentoItem } from '@/components/layout/bento'
import { CabecalhoDeModulo } from '@/components/layout/cabecalho-de-modulo'
import { ModuloTabs } from '@/components/layout/modulo-tabs'
import { SecaoDeAnalise } from '@/components/layout/secao-de-analise'
import { AbaDeDados } from '@/components/tabela/aba-de-dados'
import { TabelaCard } from '@/components/tabela/tabela-card'
import { TabelaLonga } from '@/components/tabela/tabela-longa'

import { CategoryBarChart, ChartCard, KpiCard, KpiGrid } from '@/components/charts'
import { PeriodoFiltro } from '@/components/filters/periodo-filtro'
import type { Periodo } from '@/lib/periodo'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatDateShort, formatDecimal, formatInt, formatPercent } from '@/lib/format'
import { LIMITE_LISTA } from '@/lib/rpc'
import { notaAmostra } from '@/lib/segmento'
import { AnaliseDaTela } from '@/features/resumo/analise-tela'
import { PlanoDaTela } from '@/features/resumo/plano-da-tela'
import {
  useBuilderSteps,
  useConsultorModos,
  useConsultorRecorrencia,
  useExperimentaramESumiram,
  useIaAdocao,
  useIaImpactoRetencao,
  useIaKpis,
  useModoDeEntrada,
  useProfundidadeConversa,
} from '@/features/ia/queries'

export function IaPage() {
  const [periodo, setPeriodo] = useState<Periodo>(30)

  const kpis = useIaKpis(periodo)
  const adocao = useIaAdocao(periodo)
  const recorrencia = useConsultorRecorrencia(periodo)
  const modos = useConsultorModos()
  const steps = useBuilderSteps()
  const impacto = useIaImpactoRetencao()
  const modoEntrada = useModoDeEntrada()
  const profundidade = useProfundidadeConversa()
  const sumiram = useExperimentaramESumiram()

  // A RPC ordena por número de estreantes, então a primeira linha é a porta
  // principal e a última é a que menos traz de volta. Nada é somado aqui.
  const portaPrincipal = modoEntrada.data?.[0] ?? null
  const portaQueMenosVolta = useMemo(() => {
    const modos = (modoEntrada.data ?? []).filter((m) => m.pct_volta != null)
    if (modos.length < 2) return null
    return modos.reduce((a, b) => ((b.pct_volta ?? 1) < (a.pct_volta ?? 1) ? b : a))
  }, [modoEntrada.data])

  const parouNaPrimeira = useMemo(
    () => (profundidade.data ?? []).find((p) => p.faixa === 'Parou na 1ª mensagem') ?? null,
    [profundidade.data],
  )

  const comIa = impacto.data?.find((i) => i.grupo.startsWith('Usou'))
  const semIa = impacto.data?.find((i) => i.grupo.startsWith('Não'))
  const lift =
    comIa?.pct_retencao && semIa?.pct_retencao
      ? comIa.pct_retencao / semIa.pct_retencao
      : null

  const ferramentaLider = useMemo(() => {
    const fs = adocao.data ?? []
    return fs.length > 0 ? fs.reduce((a, b) => (b.usuarios > a.usuarios ? b : a)) : null
  }, [adocao.data])

  // Recorrência é sobre hábito: interessa quem passou da faixa de um dia só.
  const voltamOutroDia = useMemo(() => {
    const faixas = recorrencia.data ?? []
    const total = faixas.reduce((soma, r) => soma + r.usuarios, 0)
    if (total === 0) return null
    const umDia = faixas.find((r) => r.faixa.startsWith('1'))?.usuarios ?? 0
    return (total - umDia) / total
  }, [recorrencia.data])

  const modoLider = useMemo(() => {
    const ms = modos.data ?? []
    if (ms.length === 0) return null
    const maior = ms.reduce((a, b) => (b.threads > a.threads ? b : a))
    const total = ms.reduce((soma, m) => soma + m.threads, 0)
    return total > 0 ? { modo: maior.modo, parte: maior.threads / total } : null
  }, [modos.data])

  // O card das etapas do Builder é sobre atrito: a etapa que mais falha.
  const etapaMaisFragil = useMemo(() => {
    const es = (steps.data ?? []).filter((e) => e.pct_erro != null)
    if (es.length === 0) return null
    return es.reduce((a, b) => ((b.pct_erro ?? 0) > (a.pct_erro ?? 0) ? b : a))
  }, [steps.data])

  return (
    <div className="space-y-4">
      {/* Título, régua e controles saem de `nav-items.ts` — a página não
          reescreve a própria régua. O frescor do dado anda junto do período. */}
      <CabecalhoDeModulo controles={<PeriodoFiltro valor={periodo} onChange={setPeriodo} />} />

      {/* Fora das abas: contexto do módulo inteiro. Trocar de aba não pode
          custar o número de referência nem obrigar a reajustar o período. */}
      <KpiGrid>
        <KpiCard
          label="Usuários do Consultor"
          value={kpis.data?.usuarios_consultor ?? null}
          format={formatInt}
          isLoading={kpis.isLoading}
          isError={kpis.isError}
        />
        <KpiCard
          label="Mensagens enviadas"
          value={kpis.data?.mensagens_consultor ?? null}
          format={formatInt}
          isLoading={kpis.isLoading}
          isError={kpis.isError}
        />
        <KpiCard
          label="Usuários do Builder"
          value={kpis.data?.usuarios_builder ?? null}
          format={formatInt}
          isLoading={kpis.isLoading}
          isError={kpis.isError}
        />
        <KpiCard
          label="Soluções geradas"
          value={kpis.data?.solucoes_builder ?? null}
          format={formatInt}
          isLoading={kpis.isLoading}
          isError={kpis.isError}
        />
      </KpiGrid>

      <ModuloTabs
        rota="/ia"
        conteudos={{
          graficos: (
            <div className="space-y-4">
              <SecaoDeAnalise
                titulo="Quanto do público as ferramentas alcançam"
                icone={TargetIcon}
                descricao="Os dois acompanham o período escolhido acima — as demais seções do módulo são recortes históricos fixos. Contam clientes distintos, nunca mensagens, e a mesma pessoa entra nos dois: um reparte por ferramenta, o outro por quantos dias diferentes ela voltou."
              >
                <BentoItem span={6}>
                  <ChartCard
                    nivel="descritivo"
                    id="card-adocao-ia"
                    icon={BotIcon}
                    title="Adoção entre clientes ativos"
                    headline={ferramentaLider ? formatInt(ferramentaLider.usuarios) : '—'}
                    headlineLabel={ferramentaLider ? `em ${ferramentaLider.ferramenta}` : undefined}
                    description={`Dos clientes com atividade nos últimos ${periodo} dias, quantos usam cada ferramenta`}
                    isLoading={adocao.isLoading}
                    isError={adocao.isError}
                    onRetry={() => void adocao.refetch()}
                    isEmpty={adocao.data?.length === 0}
                  >
                    <CategoryBarChart
                      layout="bar"
                      label="Usuários"
                      data={(adocao.data ?? []).map((a) => ({
                        category: a.ferramenta,
                        value: a.usuarios,
                      }))}
                      valueFormatter={formatInt}
                      className="h-[240px]"
                    />
                  </ChartCard>
                </BentoItem>

                <BentoItem span={6}>
                  <ChartCard
                    nivel="descritivo"
                    id="card-recorrencia-consultor"
                    icon={RepeatIcon}
                    title="Recorrência do Consultor"
                    headline={voltamOutroDia != null ? formatPercent(voltamOutroDia) : '—'}
                    headlineLabel="voltam em mais de um dia"
                    description={`Dias distintos de uso por cliente nos últimos ${periodo} dias — mede hábito, não experimentação`}
                    isLoading={recorrencia.isLoading}
                    isError={recorrencia.isError}
                    onRetry={() => void recorrencia.refetch()}
                    isEmpty={recorrencia.data?.length === 0}
                  >
                    <CategoryBarChart
                      label="Clientes"
                      data={(recorrencia.data ?? []).map((r) => ({
                        category: r.faixa,
                        value: r.usuarios,
                      }))}
                      valueFormatter={formatInt}
                      className="h-[240px]"
                    />
                  </ChartCard>
                </BentoItem>
              </SecaoDeAnalise>

              <SecaoDeAnalise
                titulo="A estreia decide se o cliente volta"
                icone={RouteIcon}
                descricao="O seletor de período acima não alcança esta seção: a coorte é fixa, e antiga de propósito, para que todo cliente tenha tido a mesma janela de chance de voltar. Diferença entre dois modos só é diferença quando passa da margem declarada no card."
              >
                <BentoItem span={12}>
                  <TabelaCard
                    nivel="comparativo"
                    id="card-modo-de-entrada"
                    icon={DoorOpenIcon}
                    title="A porta de entrada muda se o cliente volta"
                    headline={
                      portaQueMenosVolta?.pct_volta != null
                        ? formatPercent(portaQueMenosVolta.pct_volta)
                        : '—'
                    }
                    headlineLabel={
                      portaQueMenosVolta && portaPrincipal?.pct_volta != null
                        ? `voltam ao estrear em ${portaQueMenosVolta.modo}, contra ${formatPercent(portaPrincipal.pct_volta)} em ${portaPrincipal.modo}`
                        : 'de retorno na porta que menos traz de volta'
                    }
                    description={
                      portaPrincipal
                        ? `Modo da PRIMEIRA conversa de cada cliente, entre quem estreou há 30+ dias · margem de ${formatDecimal(portaPrincipal.margem_pp)} pp · modo com menos de 30 estreantes não aparece · quem entra para montar um plano pode ter resolvido de primeira, e isso o card não separa`
                        : 'Modo da primeira conversa de cada cliente, entre quem estreou há 30+ dias'
                    }
                    isLoading={modoEntrada.isLoading}
                    isError={modoEntrada.isError}
                    onRetry={() => void modoEntrada.refetch()}
                    linhasEsqueleto={2}
                  >
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Modo da 1ª conversa</TableHead>
                          <TableHead className="text-right">Estrearam</TableHead>
                          <TableHead className="text-right">Voltaram</TableHead>
                          <TableHead className="text-right">Taxa</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(modoEntrada.data ?? []).map((m) => (
                          <TableRow key={m.modo}>
                            <TableCell className="font-medium">{m.modo}</TableCell>
                            <TableCell className="num text-right">
                              {formatInt(m.clientes)}
                            </TableCell>
                            <TableCell className="num text-right">
                              {formatInt(m.voltaram)}
                            </TableCell>
                            <TableCell className="num text-right font-medium">
                              {m.pct_volta != null ? formatPercent(m.pct_volta) : '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TabelaCard>
                </BentoItem>
              </SecaoDeAnalise>

              <SecaoDeAnalise
                titulo="Como são as conversas do Consultor"
                icone={LayersIcon}
                descricao="Os dois leem o histórico inteiro de conversas, e não o período escolhido acima. A unidade aqui é a conversa, não o cliente: quem conversa muito pesa mais nestes dois cards do que na seção de adoção, onde cada pessoa vale um."
              >
                <BentoItem span={6}>
                  <ChartCard
                    nivel="diagnostico"
                    id="card-profundidade-conversa"
                    icon={MessagesSquareIcon}
                    title="Onde a conversa para"
                    headline={
                      parouNaPrimeira?.pct != null ? formatPercent(parouNaPrimeira.pct) : '—'
                    }
                    headlineLabel="das conversas param na 1ª mensagem"
                    description="Conversas do Consultor por número de mensagens, histórico completo · conversa curta não é necessariamente falha: pode ser pergunta respondida de primeira, e resposta boa encerra o assunto — o número sozinho não separa as duas coisas"
                    isLoading={profundidade.isLoading}
                    isError={profundidade.isError}
                    onRetry={() => void profundidade.refetch()}
                    isEmpty={profundidade.data?.length === 0}
                  >
                    <CategoryBarChart
                      layout="bar"
                      label="Conversas"
                      data={(profundidade.data ?? []).map((p) => ({
                        category: p.faixa,
                        value: p.pct,
                        motivoSemValor: notaAmostra(p.total),
                        nota: `${formatInt(p.conversas)} conversas`,
                        // As duas faixas de saída precoce são o assunto do card; o
                        // resto é o comportamento normal contra o qual se lê.
                        mute: p.ordem > 2,
                      }))}
                      valueFormatter={formatPercent}
                      className="h-[280px]"
                    />
                  </ChartCard>
                </BentoItem>

                <BentoItem span={6}>
                  <ChartCard
                    tone="brand"
                    nivel="descritivo"
                    icon={SlidersHorizontalIcon}
                    title="Modos do Consultor"
                    headline={modoLider ? formatPercent(modoLider.parte) : '—'}
                    headlineLabel={modoLider ? `em ${modoLider.modo}` : undefined}
                    description="Conversas por modo (histórico completo)"
                    isLoading={modos.isLoading}
                    isError={modos.isError}
                    onRetry={() => void modos.refetch()}
                    isEmpty={modos.data?.length === 0}
                  >
                    <CategoryBarChart
                      label="Conversas"
                      data={(modos.data ?? []).map((m) => ({
                        category: m.modo,
                        value: m.threads,
                      }))}
                      valueFormatter={formatInt}
                      className="h-[240px]"
                    />
                  </ChartCard>
                </BentoItem>
              </SecaoDeAnalise>

              <SecaoDeAnalise
                titulo="Onde o Builder trava"
                icone={GaugeIcon}
                descricao="Única leitura de máquina do módulo: a unidade é a geração, não a pessoa, e a janela é fixa em 90 dias. Volume de etapa aqui não se compara com volume de uso nas outras seções, onde cada linha é um cliente ou uma conversa."
              >
                <BentoItem span={12}>
                  <TabelaCard
                    nivel="diagnostico"
                    id="card-builder-etapas"
                    icon={WrenchIcon}
                    title="Builder — confiabilidade por etapa"
                    headline={
                      etapaMaisFragil?.pct_erro != null
                        ? `${formatDecimal(etapaMaisFragil.pct_erro)}%`
                        : '—'
                    }
                    headlineLabel={
                      etapaMaisFragil
                        ? `de erro na etapa mais frágil (${etapaMaisFragil.step})`
                        : undefined
                    }
                    description="Gerações dos últimos 90 dias · ordenado pelas etapas mais lentas · erro alto ou tempo alto = atrito na experiência"
                    isLoading={steps.isLoading}
                    isError={steps.isError}
                    onRetry={() => void steps.refetch()}
                  >
                    <TabelaLonga
                      linhas={steps.data ?? []}
                      chave={(s) => s.step}
                      buscarEm={(s) => [s.step]}
                      rotuloBusca="Buscar etapa"
                      vazio="Nenhuma geração registrada nos últimos 90 dias."
                      cabecalho={
                        <TableRow>
                          <TableHead>Etapa</TableHead>
                          <TableHead className="text-right">Gerações</TableHead>
                          <TableHead className="text-right">Erro</TableHead>
                          <TableHead className="text-right">Tempo médio</TableHead>
                        </TableRow>
                      }
                      renderLinha={(s) => (
                        <TableRow>
                          <TableCell className="font-mono text-xs">{s.step}</TableCell>
                          <TableCell className="num text-right">{formatInt(s.geracoes)}</TableCell>
                          <TableCell className="num text-right">
                            {s.pct_erro != null ? `${formatDecimal(s.pct_erro)}%` : '—'}
                          </TableCell>
                          <TableCell className="num text-right">
                            {s.segundos_medio != null ? `${formatDecimal(s.segundos_medio)}s` : '—'}
                          </TableCell>
                        </TableRow>
                      )}
                    />
                  </TabelaCard>
                </BentoItem>
              </SecaoDeAnalise>

              <SecaoDeAnalise
                titulo="O que acontece com quem experimenta a IA"
                icone={TrendingUpIcon}
                descricao="Os dois olham o depois do primeiro contato por caminhos opostos: um fecha uma coorte antiga e compara dois grupos, o outro é a lista aberta de hoje, nome a nome. Nenhum responde ao período escolhido acima. E o grupo que usou IA se autosselecionou — quem procura a ferramenta já é diferente de quem não procura, e nenhum recorte desta seção corrige isso."
              >
                <BentoItem span={12}>
                  <TabelaCard
                    nivel="comparativo"
                    id="card-impacto-ia"
                    icon={ShieldCheckIcon}
                    title="Usar IA na 1ª semana muda a retenção?"
                    headline={lift ? `${formatDecimal(lift)}×` : '—'}
                    headlineLabel="de lift na retenção entre 30 e 60 dias"
                    description="Clientes que entraram a partir do lançamento do Consultor (11/mai/2026) e já têm 60+ dias de casa · retenção medida entre os dias 30 e 60 · correlação, não causalidade"
                    isLoading={impacto.isLoading}
                    isError={impacto.isError}
                    onRetry={() => void impacto.refetch()}
                    linhasEsqueleto={2}
                  >
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Grupo</TableHead>
                          <TableHead className="text-right">Clientes</TableHead>
                          <TableHead className="text-right">Retidos</TableHead>
                          <TableHead className="text-right">Retenção</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(impacto.data ?? []).map((i) => (
                          <TableRow key={i.grupo}>
                            <TableCell className="font-medium">{i.grupo}</TableCell>
                            <TableCell className="num text-right">
                              {formatInt(i.clientes)}
                            </TableCell>
                            <TableCell className="num text-right">{formatInt(i.retidos)}</TableCell>
                            <TableCell className="num text-right font-medium">
                              {i.pct_retencao != null ? formatPercent(i.pct_retencao) : '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TabelaCard>
                </BentoItem>

                <BentoItem span={12}>
                  <TabelaCard
                    nivel="prescritivo"
                    id="card-experimentaram-e-sumiram"
                    icon={UserRoundSearchIcon}
                    title="Experimentaram a IA e não voltaram — lista para ação"
                    headline={sumiram.data ? formatInt(sumiram.data.length) : '—'}
                    headlineLabel="clientes ao alcance de um empurrão"
                    // O corte só é declarado quando ele de fato morde. Anunciar
                    // "cortada nos 5.000 mais recentes" numa lista de 269 descreve
                    // uma limitação que não existe — e ensina o leitor a
                    // desconfiar de um número que está inteiro.
                    description={`Usaram o Consultor em UM único dia, não voltaram há 30+ dias e seguem ativos no produto · quem sumiu do produto inteiro é outro problema e tem lista própria em Clientes${
                      (sumiram.data?.length ?? 0) >= LIMITE_LISTA
                        ? ` · lista cortada nos ${formatInt(LIMITE_LISTA)} mais recentes`
                        : ''
                    }`}
                    isLoading={sumiram.isLoading}
                    isError={sumiram.isError}
                    onRetry={() => void sumiram.refetch()}
                  >
                    <TabelaLonga
                      linhas={sumiram.data ?? []}
                      chave={(c) => String(c.email)}
                      buscarEm={(c) => [c.nome, c.email, c.organizacao ?? '']}
                      rotuloBusca="Buscar por nome, e-mail ou organização"
                      vazio="Ninguém neste recorte — toda pessoa que experimentou a IA voltou, ou saiu do produto."
                      cabecalho={
                        <TableRow>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Organização</TableHead>
                          <TableHead>Plano</TableHead>
                          <TableHead className="text-right">Última conversa</TableHead>
                          <TableHead className="text-right">Dias sem IA</TableHead>
                        </TableRow>
                      }
                      renderLinha={(c) => (
                        <TableRow>
                          <TableCell className="max-w-64 truncate font-medium">
                            {c.nome}
                            <span className="text-muted-foreground block truncate text-xs font-normal">
                              {c.email}
                            </span>
                          </TableCell>
                          <TableCell className="max-w-48 truncate">
                            {c.organizacao ?? '—'}
                          </TableCell>
                          <TableCell>{c.plano ?? '—'}</TableCell>
                          <TableCell className="num text-right">
                            {formatDateShort(c.ultima_conversa)}
                          </TableCell>
                          <TableCell className="num text-right font-medium">
                            {formatInt(c.dias_sem_ia)}
                          </TableCell>
                        </TableRow>
                      )}
                    />
                  </TabelaCard>
                </BentoItem>
              </SecaoDeAnalise>

              {/* As linhas cruas fecham a aba do dado: são as MESMAS queries que
                  os cards acima desenham, passadas já resolvidas. Nenhuma
                  consulta nova — se a aba refizesse a leitura, ela poderia
                  divergir do card logo acima. */}
              <AbaDeDados
                fontes={[
                  {
                    rpc: 'bi_ia_kpis',
                    titulo: 'Os quatro KPIs do topo',
                    descricao: 'uma linha só — clientes e volume nas duas ferramentas',
                    linhas: kpis.data ? [kpis.data] : [],
                    isLoading: kpis.isLoading,
                    isError: kpis.isError,
                    onRetry: () => void kpis.refetch(),
                  },
                  {
                    rpc: 'bi_ia_adocao',
                    titulo: 'Quantos clientes ativos usam cada ferramenta',
                    descricao: 'conta clientes distintos, nunca mensagens',
                    linhas: adocao.data,
                    isLoading: adocao.isLoading,
                    isError: adocao.isError,
                    onRetry: () => void adocao.refetch(),
                  },
                  {
                    rpc: 'bi_consultor_recorrencia',
                    titulo: 'Em quantos dias distintos cada cliente volta ao Consultor',
                    linhas: recorrencia.data,
                    isLoading: recorrencia.isLoading,
                    isError: recorrencia.isError,
                    onRetry: () => void recorrencia.refetch(),
                  },
                  {
                    rpc: 'bi_ia_modo_de_entrada',
                    titulo: 'O modo da primeira conversa muda se o cliente volta',
                    descricao:
                      'coorte fixa de quem estreou há 30+ dias, fora do período do topo · modo com menos de 30 estreantes não aparece',
                    linhas: modoEntrada.data,
                    isLoading: modoEntrada.isLoading,
                    isError: modoEntrada.isError,
                    onRetry: () => void modoEntrada.refetch(),
                  },
                  {
                    rpc: 'bi_ia_profundidade_conversa',
                    titulo: 'Em que mensagem a conversa do Consultor para',
                    descricao:
                      'histórico completo, fora do período do topo · a unidade é a conversa, não o cliente',
                    linhas: profundidade.data,
                    isLoading: profundidade.isLoading,
                    isError: profundidade.isError,
                    onRetry: () => void profundidade.refetch(),
                  },
                  {
                    rpc: 'bi_consultor_modos',
                    titulo: 'Conversas por modo do Consultor',
                    descricao: 'histórico completo, fora do período do topo',
                    linhas: modos.data,
                    isLoading: modos.isLoading,
                    isError: modos.isError,
                    onRetry: () => void modos.refetch(),
                  },
                  {
                    rpc: 'bi_builder_steps',
                    titulo: 'Confiabilidade e tempo de cada etapa do Builder',
                    descricao: 'janela fixa de 90 dias · a unidade é a geração, não a pessoa',
                    linhas: steps.data,
                    isLoading: steps.isLoading,
                    isError: steps.isError,
                    onRetry: () => void steps.refetch(),
                  },
                  {
                    rpc: 'bi_ia_impacto_retencao',
                    titulo: 'Retenção de quem usou e de quem não usou IA na 1ª semana',
                    descricao:
                      'coorte a partir do lançamento do Consultor, com 60+ dias de casa · correlação, não causalidade',
                    linhas: impacto.data,
                    isLoading: impacto.isLoading,
                    isError: impacto.isError,
                    onRetry: () => void impacto.refetch(),
                  },
                  {
                    rpc: 'bi_ia_experimentaram_e_sumiram',
                    titulo: 'Quem usou o Consultor em um dia só e não voltou',
                    descricao:
                      'segue ativo no produto — quem sumiu do produto inteiro tem lista própria em Clientes',
                    linhas: sumiram.data,
                    isLoading: sumiram.isLoading,
                    isError: sumiram.isError,
                    onRetry: () => void sumiram.refetch(),
                    limite: LIMITE_LISTA,
                  },
                ]}
              />
            </div>
          ),
          analise: <AnaliseDaTela tela="ia" periodo={periodo} />,
          plano: <PlanoDaTela tela="ia" periodo={periodo} />,
        }}
      />
    </div>
  )
}
