import { useMemo, useState } from 'react'
import {
  AlertTriangleIcon,
  CalendarCheckIcon,
  LayersIcon,
  LightbulbIcon,
  HandCoinsIcon,
  LogOutIcon,
  ShieldCheckIcon,
  SkullIcon,
  UserCheckIcon,
  UsersRoundIcon,
} from 'lucide-react'
import { BentoCabecalho, BentoGrid, BentoItem } from '@/components/layout/bento'
import { ModuloTabs } from '@/components/layout/modulo-tabs'
import { TabelaCard } from '@/components/tabela/tabela-card'
import { TabelaLonga } from '@/components/tabela/tabela-longa'

import { CategoryBarChart, ChartCard, KpiCard, KpiGrid } from '@/components/charts'
import { PeriodoFiltro, type Periodo } from '@/components/filters/periodo-filtro'
import { SegmentoFiltro } from '@/components/filters/segmento-filtro'
import { useSegmento } from '@/components/filters/use-segmento'
import { AnaliseDaTela } from '@/features/resumo/analise-tela'
import { StatusPill } from '@/components/ui-marca/status-pill'
import { TableCell, TableHead, TableRow } from '@/components/ui/table'
import {
  formatDateShort,
  formatDecimal,
  formatInt,
  formatPercent,
} from '@/lib/format'
import { labelTipoEvento } from '@/lib/labels-plataforma'
import { CohortTable } from '@/features/clientes/cohort-table'
import { LIMITE_LISTA } from '@/lib/rpc'
import { notaAmostra, rotuloPapel } from '@/lib/segmento'
import {
  useAhaMoment,
  useAmplitudeModulos,
  useChurnModulos,
  useChurnResumo,
  useClientesEmRisco,
  useDiasAtivosDistribuicao,
  useEngajamento,
  useMortalidadeModulo,
  useRetencaoCohort,
  useRetencaoComprador,
  useRetencaoPorAmplitude,
  useRetencaoPorPapel,
} from '@/features/clientes/queries'

export function ClientesPage() {
  const [periodo, setPeriodo] = useState<Periodo>(30)
  const { papel, plano } = useSegmento()
  const recorte = { papel, plano }

  const engajamento = useEngajamento(periodo, recorte)
  const risco = useClientesEmRisco(recorte)
  const cohort = useRetencaoCohort(recorte)
  const retencaoPapel = useRetencaoPorPapel(plano)
  const aha = useAhaMoment(recorte)
  const churnResumo = useChurnResumo(recorte)
  const churnModulos = useChurnModulos(recorte)
  const mortalidade = useMortalidadeModulo(recorte)
  const comprador = useRetencaoComprador(recorte)
  const diasAtivos = useDiasAtivosDistribuicao(periodo, recorte)
  const amplitude = useAmplitudeModulos(periodo, recorte)
  const retencaoAmplitude = useRetencaoPorAmplitude(recorte)

  // A safra mais recente com janela de 90 dias fechada é a leitura honesta de
  // retenção: as safras mais novas ainda têm "—" e enganariam para cima.
  const cohortMaduro = useMemo(
    () => (cohort.data ?? []).find((c) => c.ret_90d != null) ?? null,
    [cohort.data],
  )

  // Papel suprimido (amostra < 30 no plano filtrado) sai do desenho — barra em
  // zero seria mentira e barra fantasma seria adivinhação.
  const papeisComTaxa = useMemo(
    () => (retencaoPapel.data ?? []).filter((r) => r.pct_retidos != null),
    [retencaoPapel.data],
  )

  const gapPapeis = useMemo(() => {
    if (papeisComTaxa.length < 2) return null
    const maior = papeisComTaxa[0]!
    const menor = papeisComTaxa[papeisComTaxa.length - 1]!
    return {
      pp: (maior.pct_retidos - menor.pct_retidos) * 100,
      maior: rotuloPapel(maior.papel),
      menor: rotuloPapel(menor.papel),
    }
  }, [papeisComTaxa])

  // Taxa calculada e suprimida no banco; a RPC ordena por taxa, então a
  // primeira linha é a maior — não somar aqui, que escaparia da régua.
  const moduloMaisMortal = (mortalidade.data ?? []).find((m) => m.taxa != null) ?? null

  const compradorComTaxa = useMemo(
    () => (comprador.data ?? []).filter((g) => g.pct_retidos != null),
    [comprador.data],
  )

  const gapComprador = useMemo(() => {
    if (compradorComTaxa.length < 2) return null
    return (compradorComTaxa[0]!.pct_retidos - compradorComTaxa[1]!.pct_retidos) * 100
  }, [compradorComTaxa])

  // Frequência e amplitude respondem "quantos usam de verdade": em ambos, o
  // sinal é quem passou do mínimo, não a faixa mais cheia.
  //
  // Os dois saem do banco, junto com os outros percentuais da tela. Calculá-los
  // aqui custou caro: a versão anterior subtraía o balde "1–2 dias" inteiro do
  // total e publicava 37,2% onde a resposta é 57,8% — e percentual derivado de
  // contagem no front escapa da régua de supressão, porque contagem nunca é
  // suprimida.
  const alemDeUmDia = engajamento.data?.pct_mais_de_um_dia ?? null
  const multiModulo = engajamento.data?.pct_multimodulo ?? null

  // Listas de ação podem vir cortadas em LIMITE_LISTA: lidero pela primeira
  // linha, que a ordenação garante, nunca por um total somado.
  const piorGap = useMemo(() => {
    const ms = (churnModulos.data ?? []).filter((m) => m.gap_pp != null)
    if (ms.length === 0) return null
    return ms.reduce((a, b) => ((b.gap_pp ?? 0) > (a.gap_pp ?? 0) ? b : a))
  }, [churnModulos.data])

  const melhorSinal = useMemo(() => {
    const as = (aha.data ?? []).filter((a) => a.lift != null)
    if (as.length === 0) return null
    return as.reduce((a, b) => ((b.lift ?? 0) > (a.lift ?? 0) ? b : a))
  }, [aha.data])

  const retencaoTopo = useMemo(() => {
    const rs = (retencaoAmplitude.data ?? []).filter((r) => r.pct_retidos != null)
    if (rs.length === 0) return null
    return rs.reduce((a, b) => (b.modulos > a.modulos ? b : a))
  }, [retencaoAmplitude.data])

  return (
    <div className="space-y-4">
      {/* Fora das abas: contexto do módulo inteiro. Trocar de aba não pode
          custar o número de referência nem obrigar a reajustar o período. */}
      <BentoGrid>
        <BentoCabecalho>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Clientes & Retenção</h2>
            <p className="text-muted-foreground text-sm">
              Régua: cliente ativo = 1+ ação de produto no dia · eventos desde mai/2025
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <SegmentoFiltro />
            <PeriodoFiltro valor={periodo} onChange={setPeriodo} />
          </div>
        </BentoCabecalho>

        <BentoItem span={12}>
          <KpiGrid>
            {/* `?? null`, nunca `?? 0`: a RPC suprime a taxa quando a amostra
                do recorte fica abaixo de 30, e o tile declara o porquê */}
            <KpiCard
              label="Stickiness (DAU/MAU)"
              value={engajamento.data?.stickiness ?? null}
              format={formatPercent}
              motivoSemValor={notaAmostra(engajamento.data?.mau)}
              isLoading={engajamento.isLoading}
              isError={engajamento.isError}
            />
            <KpiCard
              label="Hábito semanal"
              value={engajamento.data?.pct_habito_semanal ?? null}
              format={formatPercent}
              motivoSemValor={notaAmostra(engajamento.data?.base_habito)}
              isLoading={engajamento.isLoading}
              isError={engajamento.isError}
            />
            <KpiCard
              label="Dias ativos por cliente"
              value={engajamento.data?.dias_ativos_medio ?? null}
              format={formatDecimal}
              motivoSemValor={notaAmostra(engajamento.data?.mau)}
              isLoading={engajamento.isLoading}
              isError={engajamento.isError}
            />
            <KpiCard
              label="Usam 2+ módulos"
              value={engajamento.data?.pct_multimodulo ?? null}
              format={formatPercent}
              motivoSemValor={notaAmostra(engajamento.data?.mau)}
              isLoading={engajamento.isLoading}
              isError={engajamento.isError}
            />
          </KpiGrid>
        </BentoItem>
      </BentoGrid>

      <ModuloTabs
        rota="/clientes"
        conteudos={{
          analise: <AnaliseDaTela tela="clientes" periodo={periodo} recorte={recorte} />,
          retencao: (
            <BentoGrid>
              <BentoItem span={12}>
                <TabelaCard
                  nivel="comparativo"
                  icon={CalendarCheckIcon}
                  title="Retenção por cohort de entrada"
                  headline={
                    cohortMaduro?.ret_90d != null ? formatPercent(cohortMaduro.ret_90d) : '—'
                  }
                  headlineLabel="aos 90 dias na safra madura mais recente"
                  description="% de clientes ativos na janela após a entrada · “—” = janela ainda não completa, por isso o número acima usa a safra mais recente com 90 dias fechados · safra com menos de 30 clientes no recorte mostra só a contagem (% suprimido pela régua de amostra) · atenção: a régua de atividade ganhou novos tipos de evento ao longo do tempo (Builder out/25, Soluções abr/26, Consultor mai/26) — parte da melhora entre cohorts distantes é instrumentação"
                  isLoading={cohort.isLoading}
                  isError={cohort.isError}
                  onRetry={() => void cohort.refetch()}
                >
                  <CohortTable linhas={cohort.data ?? []} />
                </TabelaCard>
              </BentoItem>

              <BentoItem span={12}>
                <ChartCard
                  nivel="comparativo"
                  id="card-comprador"
                  icon={HandCoinsIcon}
                  title="Quem compra retém; quem foi convidado, não"
                  headline={gapComprador != null ? `${formatDecimal(gapComprador)} pp` : '—'}
                  headlineLabel="separam o comprador de quem ele trouxe"
                  description="O master user é quem comprou o Viver de IA e é dono da organização; os demais entram pelo convite dele. Este é o corte estrutural do produto, e não se confunde com o papel do contrato — 445 membros do Club também são donos de organização. Mesma régua do card ao lado: 120+ dias de casa, ativo nos últimos 30. Como 91% dos clientes estão dentro de alguma organização, esta é a leitura central, não um recorte lateral."
                  isLoading={comprador.isLoading}
                  isError={comprador.isError}
                  onRetry={() => void comprador.refetch()}
                  isEmpty={compradorComTaxa.length === 0}
                  emptyMessage="Nenhum dos dois grupos tem 30+ clientes elegíveis no recorte."
                  isRefreshing={comprador.isFetching && !!comprador.data}
                >
                  <CategoryBarChart
                    layout="bar"
                    label="Retidos"
                    data={compradorComTaxa.map((g) => ({
                      category: `${g.grupo} (${formatInt(g.clientes)})`,
                      value: g.pct_retidos,
                      mute: g.grupo === 'Convidado',
                    }))}
                    valueFormatter={formatPercent}
                    className="h-[160px]"
                  />
                </ChartCard>
              </BentoItem>

              <BentoItem span={12}>
                <ChartCard
                  nivel="comparativo"
                  id="card-retencao-papel"
                  icon={UserCheckIcon}
                  title="Retenção por papel"
                  headline={gapPapeis ? `${formatDecimal(gapPapeis.pp)} pp` : '—'}
                  headlineLabel={
                    gapPapeis ? `separam ${gapPapeis.maior} de ${gapPapeis.menor}` : undefined
                  }
                  description="Clientes com 120+ dias de casa ainda ativos nos últimos 30 dias, comparados entre os 3 papéis que cobrem 99% da base · mesma régua do card “Multi-módulo retém mais?” · papel com menos de 30 elegíveis sai do desenho · responde ao filtro de plano e ignora o de papel de propósito — a comparação é o card"
                  isLoading={retencaoPapel.isLoading}
                  isError={retencaoPapel.isError}
                  onRetry={() => void retencaoPapel.refetch()}
                  isEmpty={papeisComTaxa.length === 0}
                  emptyMessage="Nenhum papel com 30+ clientes elegíveis no recorte."
                  isRefreshing={retencaoPapel.isFetching && !!retencaoPapel.data}
                >
                  <CategoryBarChart
                    layout="bar"
                    label="Retidos"
                    data={papeisComTaxa.map((r) => ({
                      category: `${rotuloPapel(r.papel)} (${formatInt(r.clientes)})`,
                      value: r.pct_retidos,
                    }))}
                    valueFormatter={formatPercent}
                    className="h-[200px]"
                  />
                </ChartCard>
              </BentoItem>

              <BentoItem span={4}>
                <ChartCard
                  nivel="diagnostico"
                  id="card-mortalidade"
                  icon={LogOutIcon}
                  title="Onde a jornada termina"
                  headline={
                    moduloMaisMortal?.taxa != null ? formatPercent(moduloMaisMortal.taxa) : '—'
                  }
                  headlineLabel={
                    moduloMaisMortal ? `de quem usou ${moduloMaisMortal.modulo} parou ali` : undefined
                  }
                  description="De quem passou por cada módulo, que fatia teve ali a última ação antes de sumir. A versão anterior deste card contava clientes e publicava “59% param em Formações” — o que mede popularidade do módulo, porque o mais usado tende a ser o último de qualquer jornada. Dividido pela audiência de cada um, a ordem muda: módulo com muita gente e pouca mortalidade é o que segura."
                  isLoading={mortalidade.isLoading}
                  isError={mortalidade.isError}
                  onRetry={() => void mortalidade.refetch()}
                  isEmpty={mortalidade.data?.length === 0}
                >
                  <CategoryBarChart
                    layout="bar"
                    label="Pararam ali"
                    data={(mortalidade.data ?? [])
                      .filter((m) => m.taxa != null)
                      .map((m) => ({
                        category: `${m.modulo} (${formatInt(m.usaram)})`,
                        value: m.taxa,
                      }))}
                    valueFormatter={formatPercent}
                    className="h-[300px]"
                  />
                </ChartCard>
              </BentoItem>

              <BentoItem span={4}>
                <ChartCard
                  nivel="descritivo"
                  id="card-frequencia"
                  icon={UsersRoundIcon}
                  title="Frequência de uso"
                  headline={alemDeUmDia != null ? formatPercent(alemDeUmDia) : '—'}
                  headlineLabel="ativos em mais de um dia"
                  description={`Clientes por dias ativos · últimos ${periodo} dias`}
                  isLoading={diasAtivos.isLoading}
                  isError={diasAtivos.isError}
                  onRetry={() => void diasAtivos.refetch()}
                  isEmpty={diasAtivos.data?.length === 0}
                  isRefreshing={diasAtivos.isFetching && !!diasAtivos.data}
                >
                  <CategoryBarChart
                    label="Clientes"
                    data={(diasAtivos.data ?? []).map((d) => ({
                      category: d.faixa,
                      value: d.clientes,
                    }))}
                    valueFormatter={formatInt}
                    className="h-[280px]"
                  />
                </ChartCard>

              </BentoItem>

              <BentoItem span={4}>
                <ChartCard
                  nivel="descritivo"
                  icon={LayersIcon}
                  title="Amplitude de uso"
                  headline={multiModulo != null ? formatPercent(multiModulo) : '—'}
                  headlineLabel="usam mais de um módulo"
                  description={`Clientes por nº de módulos usados · últimos ${periodo} dias`}
                  isLoading={amplitude.isLoading}
                  isError={amplitude.isError}
                  onRetry={() => void amplitude.refetch()}
                  isEmpty={amplitude.data?.length === 0}
                  isRefreshing={amplitude.isFetching && !!amplitude.data}
                >
                  <CategoryBarChart
                    label="Clientes"
                    data={(amplitude.data ?? []).map((a) => ({
                      category: `${a.modulos} ${a.modulos === 1 ? 'módulo' : 'módulos'}`,
                      value: a.clientes,
                    }))}
                    valueFormatter={formatInt}
                    className="h-[280px]"
                  />
                </ChartCard>
              </BentoItem>
            </BentoGrid>
          ),
          risco: (
            <BentoGrid>
              <BentoItem span={12}>
                <TabelaCard
                  nivel="prescritivo"
                  icon={AlertTriangleIcon}
                  title="Clientes em risco — lista para ação"
                  headline={risco.data ? formatInt(risco.data.length) : '—'}
                  headlineLabel="clientes na lista"
                  description="Inatividade: era ativo e está 14+ dias em silêncio · Plano vencendo: contrato expira em ≤30 dias sem uso recente do master"
                  isLoading={risco.isLoading}
                  isError={risco.isError}
                  onRetry={() => void risco.refetch()}
                >
                  <TabelaLonga
                    linhas={risco.data ?? []}
                    limiteDaFonte={LIMITE_LISTA}
                    chave={(r) => String(r.email)}
                    buscarEm={(r) => [r.nome, r.email, r.organizacao]}
                    rotuloBusca="Buscar por nome, e-mail ou organização"
                    cabecalho={
                      <TableRow>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Organização</TableHead>
                        <TableHead>Plano</TableHead>
                        <TableHead>Motivo</TableHead>
                        <TableHead className="text-right">Última atividade</TableHead>
                        <TableHead className="text-right">Dias inativo</TableHead>
                        <TableHead className="text-right">Vence em</TableHead>
                      </TableRow>
                    }
                    renderLinha={(r) => (
                      <TableRow>
                        <TableCell>
                          <div className="font-medium">{r.nome ?? '—'}</div>
                          <div className="text-muted-foreground text-xs">{r.email}</div>
                        </TableCell>
                        <TableCell>{r.organizacao ?? '—'}</TableCell>
                        <TableCell>{r.plano ?? '—'}</TableCell>
                        <TableCell>
                          {/* dois motivos com urgências diferentes saíam no mesmo cinza —
                              silêncio de 14 dias é o caso crítico, plano vencendo ainda dá tempo */}
                          <StatusPill tom={r.motivo === 'plano_vencendo' ? 'atencao' : 'critico'}>
                            {r.motivo === 'plano_vencendo' ? 'Plano vencendo' : 'Inatividade'}
                          </StatusPill>
                        </TableCell>
                        <TableCell className="num text-right">
                          {r.ultima_atividade ? formatDateShort(r.ultima_atividade) : '—'}
                        </TableCell>
                        <TableCell className="num text-right">
                          {r.dias_inativo != null ? formatInt(r.dias_inativo) : '—'}
                        </TableCell>
                        <TableCell className="num text-right">
                          {r.dias_ate_vencer != null ? `${formatInt(r.dias_ate_vencer)}d` : '—'}
                        </TableCell>
                      </TableRow>
                    )}
                  />
                </TabelaCard>
              </BentoItem>

              <BentoItem span={8}>
                <TabelaCard
                  nivel="diagnostico"
                  id="card-churn-modulos"
                  icon={SkullIcon}
                  title="Autópsia de churn — módulos nunca usados"
                  headline={piorGap?.gap_pp != null ? `${formatDecimal(piorGap.gap_pp)} pp` : '—'}
                  headlineLabel={piorGap ? `de gap no maior (${piorGap.modulo})` : undefined}
                  description={
                    churnResumo.data
                      ? [
                          `${formatInt(churnResumo.data.churned)} clientes em churn (60+ dias sem uso${
                            churnResumo.data.pct_churn != null
                              ? `, ${formatPercent(churnResumo.data.pct_churn)} da base histórica`
                              : ''
                          })`,
                          churnResumo.data.vida_media_dias != null
                            ? `vida média de ${formatDecimal(churnResumo.data.vida_media_dias)} dias`
                            : null,
                          'gap = diferença, em pontos percentuais, entre quem saiu e quem ficou',
                          '% só com 30+ clientes no grupo (régua de amostra)',
                        ]
                          .filter(Boolean)
                          .join(' · ')
                      : 'Quem saiu vs quem ficou: % que nunca usou cada módulo'
                  }
                  isLoading={churnModulos.isLoading}
                  isError={churnModulos.isError}
                  onRetry={() => void churnModulos.refetch()}
                >
                  <TabelaLonga
                    linhas={churnModulos.data ?? []}
                    chave={(m) => m.modulo}
                    buscarEm={(m) => [m.modulo]}
                    rotuloBusca="Buscar módulo"
                    vazio="Nenhum módulo com tracking cobrindo o período."
                    cabecalho={
                      <TableRow>
                        <TableHead>Módulo</TableHead>
                        <TableHead className="text-right">Churned nunca usou</TableHead>
                        <TableHead className="text-right">Ativos nunca usou</TableHead>
                        <TableHead className="text-right">Gap (pp)</TableHead>
                      </TableRow>
                    }
                    renderLinha={(m) => (
                      <TableRow>
                        <TableCell>
                          <div className="font-medium">{m.modulo}</div>
                          <div className="text-muted-foreground text-xs">
                            medido desde {formatDateShort(m.medido_desde)}
                            {m.modulo === 'Consultor' ? ' (lançamento do produto)' : ''}
                          </div>
                        </TableCell>
                        <TableCell className="num text-right">
                          {m.pct_churned_nunca_usou != null
                            ? formatPercent(m.pct_churned_nunca_usou)
                            : '—'}
                        </TableCell>
                        <TableCell className="num text-right">
                          {m.pct_ativos_nunca_usou != null
                            ? formatPercent(m.pct_ativos_nunca_usou)
                            : '—'}
                        </TableCell>
                        <TableCell className="num text-right font-medium">
                          {m.gap_pp != null ? formatDecimal(m.gap_pp) : '—'}
                        </TableCell>
                      </TableRow>
                    )}
                  />
                </TabelaCard>

              </BentoItem>

              <BentoItem span={4}>
                <ChartCard
                  nivel="diagnostico"
                  id="card-retencao-amplitude"
                  icon={ShieldCheckIcon}
                  title="Multi-módulo retém mais?"
                  headline={
                    retencaoTopo?.pct_retidos != null ? formatPercent(retencaoTopo.pct_retidos) : '—'
                  }
                  headlineLabel={
                    retencaoTopo
                      ? `ainda ativos com ${retencaoTopo.modulos} ${retencaoTopo.modulos === 1 ? 'módulo' : 'módulos'}`
                      : undefined
                  }
                  description="Módulos usados nos primeiros 30 dias de vida × % ainda ativos hoje (clientes com 120+ dias de casa) · faixa com menos de 30 clientes sai do desenho (régua de amostra)"
                  isLoading={retencaoAmplitude.isLoading}
                  isError={retencaoAmplitude.isError}
                  onRetry={() => void retencaoAmplitude.refetch()}
                  isEmpty={retencaoAmplitude.data?.length === 0}
                  isRefreshing={retencaoAmplitude.isFetching && !!retencaoAmplitude.data}
                >
                  <CategoryBarChart
                    label="Retidos"
                    data={(retencaoAmplitude.data ?? [])
                      .filter((r) => r.pct_retidos != null)
                      .map((r) => ({
                        category: `${r.modulos} ${r.modulos === 1 ? 'módulo' : 'módulos'}`,
                        value: r.pct_retidos,
                      }))}
                    valueFormatter={formatPercent}
                    className="h-[260px]"
                  />
                </ChartCard>
              </BentoItem>
            </BentoGrid>
          ),
          funciona: (
            <BentoGrid>
              <BentoItem span={12}>
                <TabelaCard
                  nivel="diagnostico"
                  id="card-aha"
                  icon={LightbulbIcon}
                  title="Momento “aha” — o que a 1ª semana prevê"
                  headline={melhorSinal?.lift != null ? `${formatDecimal(melhorSinal.lift)}×` : '—'}
                  headlineLabel={
                    melhorSinal ? `no melhor sinal (${labelTipoEvento(melhorSinal.acao)})` : undefined
                  }
                  description="Ação nos primeiros 7 dias × retenção aos 90 dias (clientes com 120+ dias de casa) · correlação, não causalidade — validar com experimento · só ações com tracking cobrindo todo o período aparecem · régua de amostra: 50+ fizeram, e % de “não fizeram” só com 30+"
                  isLoading={aha.isLoading}
                  isError={aha.isError}
                  onRetry={() => void aha.refetch()}
                >
                  <TabelaLonga
                    linhas={aha.data ?? []}
                    chave={(a) => a.acao}
                    buscarEm={(a) => [labelTipoEvento(a.acao), a.acao]}
                    rotuloBusca="Buscar ação"
                    vazio="Nenhuma ação com tracking e amostra suficientes no recorte."
                    cabecalho={
                      <TableRow>
                        <TableHead>Ação na 1ª semana</TableHead>
                        <TableHead className="text-right">Fizeram</TableHead>
                        <TableHead className="text-right">Retenção 90d</TableHead>
                        <TableHead className="text-right">Não fizeram</TableHead>
                        <TableHead className="text-right">Retenção 90d</TableHead>
                        <TableHead className="text-right">Lift</TableHead>
                      </TableRow>
                    }
                    renderLinha={(a) => (
                      <TableRow>
                        <TableCell className="font-medium">{labelTipoEvento(a.acao)}</TableCell>
                        <TableCell className="num text-right">{formatInt(a.fizeram)}</TableCell>
                        <TableCell className="num text-right">
                          {a.ret_fizeram != null ? formatPercent(a.ret_fizeram) : '—'}
                        </TableCell>
                        <TableCell className="num text-right">{formatInt(a.nao_fizeram)}</TableCell>
                        <TableCell className="num text-right">
                          {a.ret_nao_fizeram != null ? formatPercent(a.ret_nao_fizeram) : '—'}
                        </TableCell>
                        <TableCell className="num text-right font-medium">
                          {a.lift != null ? `${formatDecimal(a.lift)}×` : '—'}
                        </TableCell>
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
