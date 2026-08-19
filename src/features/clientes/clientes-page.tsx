import { useMemo, useState } from 'react'
import {
  ActivityIcon,
  AlertTriangleIcon,
  CalendarCheckIcon,
  HandCoinsIcon,
  HistoryIcon,
  LayersIcon,
  LightbulbIcon,
  ListChecksIcon,
  LogOutIcon,
  MicroscopeIcon,
  ScaleIcon,
  ShieldCheckIcon,
  SkullIcon,
  TargetIcon,
  UserCheckIcon,
  UsersRoundIcon,
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
import { SegmentoFiltro } from '@/components/filters/segmento-filtro'
import { useSegmento } from '@/components/filters/use-segmento'
import { AnaliseDaTela } from '@/features/resumo/analise-tela'
import { PlanoDaTela } from '@/features/resumo/plano-da-tela'
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
      {/* Título, régua e controles saem de `nav-items.ts` — a página não
          reescreve a própria régua. O frescor do dado anda junto dos controles. */}
      <CabecalhoDeModulo
        controles={
          <>
            <SegmentoFiltro />
            <PeriodoFiltro valor={periodo} onChange={setPeriodo} />
          </>
        }
      />

      {/* Fora das abas: contexto do módulo inteiro. Trocar de aba não pode
          custar o número de referência nem obrigar a reajustar o período. */}
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

      <ModuloTabs
        rota="/clientes"
        conteudos={{
          graficos: (
            <div className="space-y-4">
              <SecaoDeAnalise
                titulo="Quanto de cada safra ainda está de pé meses depois"
                icone={HistoryIcon}
                descricao="Única leitura longitudinal do módulo: a janela conta a partir da entrada de cada safra, não do período escolhido no topo — mexer no seletor de dias não altera nada aqui. A comparação honesta é na diagonal (mesma idade, safras diferentes); ler na horizontal mistura idade de vida com época de entrada."
              >
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
                    isRefreshing={cohort.isFetching && !!cohort.data}
                    isError={cohort.isError}
                    onRetry={() => void cohort.refetch()}
                  >
                    <CohortTable linhas={cohort.data ?? []} />
                  </TabelaCard>
                </BentoItem>
              </SecaoDeAnalise>

              <SecaoDeAnalise
                titulo="Quem fica depois que a novidade passa"
                icone={ScaleIcon}
                descricao="Os dois cortam a mesma população pela mesma régua — 120+ dias de casa, ativo nos últimos 30 — e trocam só o eixo: como a pessoa entrou no produto, e o que o contrato diz que ela é. Os eixos se cruzam, então as barras de um card não somam nem explicam as do outro. Nenhum dos dois responde ao seletor de período, e o de papel responde só ao filtro de plano."
              >
                <BentoItem span={6}>
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

                <BentoItem span={6}>
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
              </SecaoDeAnalise>

              <SecaoDeAnalise
                titulo="Quanto do produto o cliente alcança, e onde ele para"
                icone={ActivityIcon}
                descricao="Frequência e amplitude contam clientes dentro do período escolhido no topo; a mortalidade é taxa sobre a audiência de cada módulo e olha a base histórica inteira, sem período. Por isso os três não se somam: os dois primeiros medem quanto do produto cabe numa janela de dias, o último mede em que porta a jornada acabou."
              >
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
                      moduloMaisMortal
                        ? `de quem usou ${moduloMaisMortal.modulo} parou ali`
                        : undefined
                    }
                    description="De quem passou por cada módulo, que fatia teve ali a última ação antes de sumir · a divisão é pela audiência do próprio módulo, não pelo total de quem sumiu: sem isso a leitura mede popularidade, porque o módulo mais usado tende a ser o último de qualquer jornada"
                    isLoading={mortalidade.isLoading}
                    isRefreshing={mortalidade.isFetching && !!mortalidade.data}
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
              </SecaoDeAnalise>

              <SecaoDeAnalise
                titulo="Quem ainda dá para segurar"
                icone={ListChecksIcon}
                descricao="Único bloco do módulo que aponta pessoas com nome e e-mail, e o único que olha para frente: os dois motivos são condições vigentes hoje, não autópsia de quem já foi. A lista vem cortada no limite da fonte, então a contagem do topo é o tamanho da lista, não o tamanho do problema."
              >
                <BentoItem span={12}>
                  <TabelaCard
                    nivel="prescritivo"
                    icon={AlertTriangleIcon}
                    title="Clientes em risco — lista para ação"
                    headline={risco.data ? formatInt(risco.data.length) : '—'}
                    headlineLabel="clientes na lista"
                    description="Inatividade: era ativo e está 14+ dias em silêncio · Plano vencendo: contrato expira em ≤30 dias sem uso recente do master"
                    isLoading={risco.isLoading}
                    isRefreshing={risco.isFetching && !!risco.data}
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
              </SecaoDeAnalise>

              <SecaoDeAnalise
                titulo="O que quem saiu deixou de usar"
                icone={MicroscopeIcon}
                descricao="Os dois testam a mesma hipótese — cobertura de módulos separa quem fica de quem some — por caminhos opostos: um olha para trás, comparando quem já saiu com quem ficou; o outro olha para frente, a partir dos primeiros 30 dias de vida. Nos dois a leitura é de correlação: módulo pouco tocado por quem saiu pode ser causa, sintoma ou só o módulo que ninguém alcança."
              >
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
                    isRefreshing={churnModulos.isFetching && !!churnModulos.data}
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
                      retencaoTopo?.pct_retidos != null
                        ? formatPercent(retencaoTopo.pct_retidos)
                        : '—'
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
              </SecaoDeAnalise>

              <SecaoDeAnalise
                titulo="O que a primeira semana já denuncia sobre ficar"
                icone={TargetIcon}
                descricao="Esta seção responde a uma pergunta só: que ação inicial acompanha retenção maior aos 90 dias. Cada linha é um par de grupos da mesma safra — quem fez e quem não fez — e o lift é a razão entre as duas retenções, não o ganho que a ação entregaria. Linha com “—” de um dos lados não é ação sem efeito: é grupo pequeno demais para a régua de amostra."
              >
                <BentoItem span={12}>
                  <TabelaCard
                    nivel="diagnostico"
                    id="card-aha"
                    icon={LightbulbIcon}
                    title="Momento “aha” — o que a 1ª semana prevê"
                    headline={melhorSinal?.lift != null ? `${formatDecimal(melhorSinal.lift)}×` : '—'}
                    headlineLabel={
                      melhorSinal
                        ? `no melhor sinal (${labelTipoEvento(melhorSinal.acao)})`
                        : undefined
                    }
                    description="Ação nos primeiros 7 dias × retenção aos 90 dias (clientes com 120+ dias de casa) · correlação, não causalidade — validar com experimento · só ações com tracking cobrindo todo o período aparecem · régua de amostra: 50+ fizeram, e % de “não fizeram” só com 30+"
                    isLoading={aha.isLoading}
                    isRefreshing={aha.isFetching && !!aha.data}
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
                          <TableCell className="num text-right">
                            {formatInt(a.nao_fizeram)}
                          </TableCell>
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
              </SecaoDeAnalise>

              {/* As linhas cruas fecham a aba: são as MESMAS queries que os
                  cards acima desenham, passadas já resolvidas. Nenhuma consulta
                  nova — se a lista refizesse a leitura, ela poderia divergir do
                  gráfico logo acima. */}
              <AbaDeDados
                fontes={[
                  {
                    rpc: 'bi_engajamento_clientes',
                    titulo: 'Os quatro KPIs do topo: hábito, frequência e amplitude',
                    descricao:
                      'uma linha só · taxa nula é supressão pela régua de amostra (menos de 30 no recorte)',
                    linhas: engajamento.data ? [engajamento.data] : [],
                    isLoading: engajamento.isLoading,
                    isError: engajamento.isError,
                    onRetry: () => void engajamento.refetch(),
                  },
                  {
                    rpc: 'bi_retencao_cohort',
                    titulo: 'Quanto de cada safra de entrada seguia ativo em cada janela',
                    descricao:
                      'janela contada da entrada da safra, não do período do topo · nulo = janela ainda não completa, ou safra com menos de 30 clientes',
                    linhas: cohort.data,
                    isLoading: cohort.isLoading,
                    isError: cohort.isError,
                    onRetry: () => void cohort.refetch(),
                  },
                  {
                    rpc: 'bi_retencao_comprador',
                    titulo: 'Retenção de quem comprou contra quem foi convidado',
                    descricao:
                      'corte por is_master (dono da organização), que não é o papel do contrato · 120+ dias de casa, ativo nos últimos 30',
                    linhas: comprador.data,
                    isLoading: comprador.isLoading,
                    isError: comprador.isError,
                    onRetry: () => void comprador.refetch(),
                  },
                  {
                    rpc: 'bi_retencao_por_papel',
                    titulo: 'Retenção pelos 3 papéis que cobrem 99% da base',
                    descricao:
                      'responde ao filtro de plano e ignora o de papel de propósito — a comparação é o card',
                    linhas: retencaoPapel.data,
                    isLoading: retencaoPapel.isLoading,
                    isError: retencaoPapel.isError,
                    onRetry: () => void retencaoPapel.refetch(),
                  },
                  {
                    rpc: 'bi_mortalidade_modulo',
                    titulo: 'De quem passou por cada módulo, que fatia parou ali',
                    descricao:
                      'taxa sobre a audiência de cada módulo, base histórica inteira — não responde ao período do topo',
                    linhas: mortalidade.data,
                    isLoading: mortalidade.isLoading,
                    isError: mortalidade.isError,
                    onRetry: () => void mortalidade.refetch(),
                  },
                  {
                    rpc: 'bi_dias_ativos_distribuicao',
                    titulo: 'Clientes por faixa de dias ativos no período',
                    linhas: diasAtivos.data,
                    isLoading: diasAtivos.isLoading,
                    isError: diasAtivos.isError,
                    onRetry: () => void diasAtivos.refetch(),
                  },
                  {
                    rpc: 'bi_amplitude_modulos',
                    titulo: 'Clientes por número de módulos usados no período',
                    linhas: amplitude.data,
                    isLoading: amplitude.isLoading,
                    isError: amplitude.isError,
                    onRetry: () => void amplitude.refetch(),
                  },
                  {
                    rpc: 'bi_clientes_em_risco',
                    titulo: 'Quem ainda dá para segurar, com nome e e-mail',
                    descricao:
                      'inatividade (14+ dias em silêncio) ou plano vencendo em ≤30 dias · a lista vem cortada no limite da fonte',
                    linhas: risco.data,
                    isLoading: risco.isLoading,
                    isError: risco.isError,
                    onRetry: () => void risco.refetch(),
                    limite: LIMITE_LISTA,
                  },
                  {
                    rpc: 'bi_churn_resumo',
                    titulo: 'Tamanho do churn e vida média de quem saiu',
                    descricao: 'uma linha só · churn = 60+ dias sem uso',
                    linhas: churnResumo.data ? [churnResumo.data] : [],
                    isLoading: churnResumo.isLoading,
                    isError: churnResumo.isError,
                    onRetry: () => void churnResumo.refetch(),
                  },
                  {
                    rpc: 'bi_churn_modulos',
                    titulo: 'O que quem saiu nunca usou, contra quem ficou',
                    descricao:
                      'gap em pontos percentuais entre os dois grupos · % só com 30+ clientes no grupo',
                    linhas: churnModulos.data,
                    isLoading: churnModulos.isLoading,
                    isError: churnModulos.isError,
                    onRetry: () => void churnModulos.refetch(),
                  },
                  {
                    rpc: 'bi_retencao_por_amplitude',
                    titulo: 'Módulos usados nos primeiros 30 dias × retenção hoje',
                    descricao: 'faixa com menos de 30 clientes sai com taxa nula',
                    linhas: retencaoAmplitude.data,
                    isLoading: retencaoAmplitude.isLoading,
                    isError: retencaoAmplitude.isError,
                    onRetry: () => void retencaoAmplitude.refetch(),
                  },
                  {
                    rpc: 'bi_aha_moment',
                    titulo: 'Ação na 1ª semana × retenção aos 90 dias',
                    descricao:
                      'correlação, não causalidade · régua de amostra: 50+ fizeram, e % de “não fizeram” só com 30+',
                    linhas: aha.data,
                    isLoading: aha.isLoading,
                    isError: aha.isError,
                    onRetry: () => void aha.refetch(),
                  },
                ]}
              />
            </div>
          ),
          analise: <AnaliseDaTela tela="clientes" periodo={periodo} recorte={recorte} />,
          plano: <PlanoDaTela tela="clientes" periodo={periodo} recorte={recorte} />,
        }}
      />
    </div>
  )
}
