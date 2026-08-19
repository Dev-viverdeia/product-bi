import { useMemo, useState } from 'react'
import {
  FunnelIcon,
  HourglassIcon,
  ListChecksIcon,
  MailCheckIcon,
  RouteIcon,
  SlidersHorizontalIcon,
  TimerIcon,
  UserPlusIcon,
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
import { formatDecimal, formatInt, formatPercent } from '@/lib/format'
import { fundoIntensidade } from '@/lib/intensidade'
import { LIMITE_LISTA } from '@/lib/rpc'
import { notaAmostra } from '@/lib/segmento'
import { AnaliseDaTela } from '@/features/resumo/analise-tela'
import { PlanoDaTela } from '@/features/resumo/plano-da-tela'
import {
  useAceiteConvite,
  useEfeitoOnboarding,
  useEntradaKpis,
  useFunilEntrada,
  useMastersResumo,
  useMastersTopConvidadores,
  useOnboardingAbandono,
  usePrimeiraAcaoPorOrigem,
} from '@/features/entrada/queries'

export function EntradaPage() {
  const [periodo, setPeriodo] = useState<Periodo>(30)

  const kpis = useEntradaKpis(periodo)
  const funil = useFunilEntrada(periodo)
  const origem = usePrimeiraAcaoPorOrigem()
  const aceite = useAceiteConvite()
  const onboarding = useOnboardingAbandono()
  const efeitoOnboarding = useEfeitoOnboarding()
  const mastersResumo = useMastersResumo()
  const mastersTop = useMastersTopConvidadores()

  // A última etapa do funil é a que responde o card: de tudo que entrou, quanto
  // chegou até agir. As demais linhas contam o caminho.
  const chegamNaPrimeiraAcao = funil.data?.at(-1)?.pct_do_inicio ?? null

  // O headline do card de origem é a distância entre os dois grupos na faixa que
  // decide tudo — nunca agir. Sai pronta do banco nas duas pontas; aqui só se
  // escolhe a linha, nunca se divide nada.
  const nuncaAgiu = useMemo(
    () => (origem.data ?? []).find((o) => o.faixa === 'Nunca agiu') ?? null,
    [origem.data],
  )

  const semOnboarding = useMemo(
    () => (efeitoOnboarding.data ?? []).find((e) => e.grupo === 'Parou no meio') ?? null,
    [efeitoOnboarding.data],
  )

  const convitesNunca = useMemo(
    () => (aceite.data ?? []).find((a) => a.faixa === 'Nunca aceito') ?? null,
    [aceite.data],
  )

  // Coluna de janela, igual em toda linha: o total deixa de ser somado aqui.
  const incompletos = onboarding.data?.[0]?.incompletos_total ?? null

  return (
    <div className="space-y-4">
      {/* Título, régua e controles saem de `nav-items.ts` — a página não
          reescreve a própria régua. O frescor do dado anda junto dos controles. */}
      <CabecalhoDeModulo controles={<PeriodoFiltro valor={periodo} onChange={setPeriodo} />} />

      {/* Fora das abas: contexto do módulo inteiro. Trocar de aba não pode
          custar o número de referência nem obrigar a reajustar o período. */}
      <KpiGrid>
        <KpiCard
          label="Convites criados"
          value={kpis.data?.convites ?? null}
          format={formatInt}
          isLoading={kpis.isLoading}
          isError={kpis.isError}
        />
        <KpiCard
          label="Conversão convite → cadastro"
          value={kpis.data?.conversao ?? null}
          format={formatPercent}
          isLoading={kpis.isLoading}
          isError={kpis.isError}
        />
        <KpiCard
          label="Onboarding concluído (dos cadastrados)"
          value={kpis.data?.onboarding_pct ?? null}
          format={formatPercent}
          isLoading={kpis.isLoading}
          isError={kpis.isError}
        />
        {/* Era "Erros de login", contagem de ocorrencia por enum tecnico
            (invalid_credentials, FALLBACK, captcha_failed). Saiu por decisao do
            Mateus em 19/ago: nao e analise que o CEO faca. No lugar entra o
            DESFECHO do funil desta tela — de todo convite criado, quantos
            chegaram a fazer alguma coisa. O numero e a MESMA expressao da 4a
            barra do funil, nao uma segunda conta. */}
        <KpiCard
          label="Chegaram à 1ª ação"
          value={kpis.data?.primeira_acao ?? null}
          format={formatInt}
          isLoading={kpis.isLoading}
          isError={kpis.isError}
        />
      </KpiGrid>

      <ModuloTabs
        rota="/entrada"
        conteudos={{
          graficos: (
            <div className="space-y-4">
              <SecaoDeAnalise
                titulo="Quem manda convite, e quanto dele vira gente"
                icone={FunnelIcon}
                descricao="Funil e aceite contam convites, não pessoas — recusa não é cliente que nunca apareceu. Três janelas: o funil corre no período do topo; o aceite exige 30+ dias para não chamar de recusa o que ainda pode ser aceito; masters ignora o seletor."
              >
                <BentoItem span={6}>
                  <TabelaCard
                    nivel="diagnostico"
                    id="card-funil-entrada"
                    icon={SlidersHorizontalIcon}
                    title="Funil de entrada"
                    headline={
                      chegamNaPrimeiraAcao != null ? formatPercent(chegamNaPrimeiraAcao) : '—'
                    }
                    headlineLabel="dos convites chegam à 1ª ação"
                    description={`Safra: convites criados nos últimos ${periodo} dias, acompanhados até a 1ª ação · convites deletados fora · etapa de envio não aparece: o rastreamento de entrega da plataforma parou em abr/2026 (registrado para reporte)`}
                    isLoading={funil.isLoading}
                    isRefreshing={funil.isFetching && !!funil.data}
                    isError={funil.isError}
                    onRetry={() => void funil.refetch()}
                    linhasEsqueleto={4}
                  >
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Etapa</TableHead>
                          <TableHead className="text-right">Quantidade</TableHead>
                          <TableHead className="text-right">% do início</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(funil.data ?? []).map((f) => (
                          <TableRow key={f.etapa}>
                            <TableCell className="font-medium">{f.etapa}</TableCell>
                            <TableCell className="num text-right">
                              {formatInt(f.quantidade)}
                            </TableCell>
                            <TableCell
                              className="num text-right"
                              style={fundoIntensidade(f.pct_do_inicio)}
                            >
                              {f.pct_do_inicio != null ? formatPercent(f.pct_do_inicio) : '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TabelaCard>
                </BentoItem>

                <BentoItem span={6}>
                  <ChartCard
                    tone="brand"
                    nivel="diagnostico"
                    id="card-aceite-convite"
                    icon={MailCheckIcon}
                    title="O convite é aceito na hora, ou não é aceito"
                    headline={convitesNunca?.pct != null ? formatPercent(convitesNunca.pct) : '—'}
                    headlineLabel={
                      convitesNunca
                        ? `nunca aceitos · mediana de ${formatDecimal(convitesNunca.mediana_horas)}h para os aceitos`
                        : undefined
                    }
                    description="Convites criados há mais de 30 dias, não deletados · “Nunca aceito” não separa ignorado de nunca enviado: o rastreamento de envio da plataforma parou em abr/2026"
                    isLoading={aceite.isLoading}
                    isRefreshing={aceite.isFetching && !!aceite.data}
                    isError={aceite.isError}
                    onRetry={() => void aceite.refetch()}
                    isEmpty={aceite.data?.length === 0}
                  >
                    <CategoryBarChart
                      layout="bar"
                      label="Convites"
                      data={(aceite.data ?? []).map((a) => ({
                        category: a.faixa,
                        value: a.pct,
                        motivoSemValor: notaAmostra(a.total),
                        nota: `${formatInt(a.convites)} convites`,
                        // A barra de "nunca aceito" é o problema, não o resultado:
                        // recua para o cinza para que as faixas de aceite, que são
                        // o que se quer ler em conjunto, fiquem com a cor.
                        mute: a.faixa === 'Nunca aceito',
                      }))}
                      valueFormatter={formatPercent}
                      className="h-[300px]"
                    />
                  </ChartCard>
                </BentoItem>
                <BentoItem span={12}>
                  <TabelaCard
                    nivel="descritivo"
                    id="card-masters-convites"
                    icon={UserPlusIcon}
                    title="Masters × convites"
                    headline={
                      mastersResumo.data
                        ? formatPercent(mastersResumo.data.pct_convidam ?? 0)
                        : '—'
                    }
                    headlineLabel="dos masters já convidaram alguém"
                    description={
                      mastersResumo.data
                        ? `${formatInt(mastersResumo.data.masters_total)} masters, dos quais ${formatInt(mastersResumo.data.masters_convidaram)} já convidaram · conversão dos convites de masters: ${formatPercent(mastersResumo.data.conversao_convites ?? 0)} · histórico completo`
                        : 'Quem traz gente para dentro — histórico completo'
                    }
                    isLoading={mastersTop.isLoading}
                    isRefreshing={mastersTop.isFetching && !!mastersTop.data}
                    isError={mastersTop.isError}
                    onRetry={() => void mastersTop.refetch()}
                  >
                    <TabelaLonga
                      linhas={mastersTop.data ?? []}
                      limiteDaFonte={LIMITE_LISTA}
                      chave={(m) => String(m.email)}
                      buscarEm={(m) => [m.nome, m.email]}
                      rotuloBusca="Buscar por nome ou e-mail"
                      cabecalho={
                        <TableRow>
                          <TableHead>Master</TableHead>
                          <TableHead>Organização</TableHead>
                          <TableHead className="text-right">Convites</TableHead>
                          <TableHead className="text-right">Usados</TableHead>
                          <TableHead className="text-right">Conversão</TableHead>
                        </TableRow>
                      }
                      renderLinha={(m) => (
                        <TableRow>
                          <TableCell>
                            <div className="font-medium">{m.nome ?? '—'}</div>
                            <div className="text-muted-foreground text-xs">{m.email}</div>
                          </TableCell>
                          <TableCell>{m.organizacao ?? '—'}</TableCell>
                          <TableCell className="num text-right">{formatInt(m.convites)}</TableCell>
                          <TableCell className="num text-right">{formatInt(m.usados)}</TableCell>
                          <TableCell className="num text-right">
                            {m.conversao != null ? formatPercent(m.conversao) : '—'}
                          </TableCell>
                        </TableRow>
                      )}
                    />
                  </TabelaCard>
                </BentoItem>
              </SecaoDeAnalise>

              <SecaoDeAnalise
                titulo="Depois de entrar, quem chega a agir"
                icone={HourglassIcon}
                descricao="Três recortes de tempo diferentes, então um card não fecha no outro: safra fechada de 180–30 dias, casa de 120+ dias e a foto de hoje. Nem fecham com o funil, que corre no período do topo e conta quem entrou ontem como quem não agiu."
              >
                <BentoItem span={12}>
                  <TabelaCard
                    nivel="comparativo"
                    id="card-tempo-primeira-acao"
                    icon={TimerIcon}
                    title="Quem comprou age; quem foi convidado, não"
                    headline={
                      nuncaAgiu?.pct_convidado != null ? formatPercent(nuncaAgiu.pct_convidado) : '—'
                    }
                    headlineLabel="dos convidados nunca fizeram nada"
                    description="Safra fechada: entrou entre 180 e 30 dias atrás, todos com a mesma janela para agir · comprador = dono da organização"
                    isLoading={origem.isLoading}
                    isRefreshing={origem.isFetching && !!origem.data}
                    isError={origem.isError}
                    onRetry={() => void origem.refetch()}
                    linhasEsqueleto={4}
                  >
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Quando agiu pela 1ª vez</TableHead>
                          <TableHead className="text-right">
                            Comprador ({formatInt(nuncaAgiu?.base_comprador ?? 0)})
                          </TableHead>
                          <TableHead className="text-right">
                            Convidado ({formatInt(nuncaAgiu?.base_convidado ?? 0)})
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(origem.data ?? []).map((o) => (
                          <TableRow key={o.faixa}>
                            <TableCell className="font-medium">{o.faixa}</TableCell>
                            <TableCell
                              className="num text-right"
                              style={fundoIntensidade(o.pct_comprador)}
                            >
                              {o.pct_comprador != null ? formatPercent(o.pct_comprador) : '—'}
                            </TableCell>
                            <TableCell
                              className="num text-right"
                              style={fundoIntensidade(o.pct_convidado)}
                            >
                              {o.pct_convidado != null ? formatPercent(o.pct_convidado) : '—'}
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
                    id="card-efeito-onboarding"
                    icon={RouteIcon}
                    title="Quem não termina o onboarding não volta"
                    headline={
                      semOnboarding?.pct_ativo != null ? formatPercent(semOnboarding.pct_ativo) : '—'
                    }
                    headlineLabel="de quem parou no meio agiu no último mês"
                    description="Clientes com 120+ dias de casa · associação, não causa: quem já ia sumir também não terminou o onboarding, e a ordem entre as duas coisas não sai deste card"
                    isLoading={efeitoOnboarding.isLoading}
                    isRefreshing={efeitoOnboarding.isFetching && !!efeitoOnboarding.data}
                    isError={efeitoOnboarding.isError}
                    onRetry={() => void efeitoOnboarding.refetch()}
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
                        {(efeitoOnboarding.data ?? []).map((e) => (
                          <TableRow key={e.grupo}>
                            <TableCell className="font-medium">{e.grupo}</TableCell>
                            <TableCell className="num text-right">
                              {formatInt(e.clientes)}
                            </TableCell>
                            <TableCell className="num text-right">
                              {formatInt(e.ativos)}
                            </TableCell>
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
                  <ChartCard
                    nivel="descritivo"
                    id="card-onboarding-abandono"
                    icon={ListChecksIcon}
                    title="Onde os incompletos param"
                    headline={incompletos != null ? formatInt(incompletos) : '—'}
                    headlineLabel="não concluíram o onboarding"
                    description="Distribuição por etapa atual de quem não concluiu, só clientes · a etapa é a atual, não a de abandono: quem parar e voltar sai desta contagem sem virar conclusão"
                    isLoading={onboarding.isLoading}
                    isRefreshing={onboarding.isFetching && !!onboarding.data}
                    isError={onboarding.isError}
                    onRetry={() => void onboarding.refetch()}
                    isEmpty={onboarding.data?.length === 0}
                  >
                    <CategoryBarChart
                      label="Clientes"
                      data={(onboarding.data ?? []).map((o) => ({
                        category: `Etapa ${o.step_atual}`,
                        value: o.clientes,
                      }))}
                      valueFormatter={formatInt}
                      className="h-[300px]"
                    />
                  </ChartCard>
                </BentoItem>
              </SecaoDeAnalise>

              {/* A camada de dados fecha a aba: as MESMAS queries que os cards
                  acima desenham, passadas já resolvidas. Nenhuma consulta nova —
                  se a lista refizesse a leitura, ela poderia divergir do card. */}
              <AbaDeDados
                fontes={[
                  {
                    rpc: 'bi_entrada_kpis',
                    titulo: 'Os quatro KPIs do topo da tela',
                    descricao: `uma linha só — convites, conversão, onboarding e erros dos últimos ${periodo} dias`,
                    linhas: kpis.data ? [kpis.data] : [],
                    isLoading: kpis.isLoading,
                    isError: kpis.isError,
                    onRetry: () => void kpis.refetch(),
                  },
                  {
                    rpc: 'bi_funil_entrada',
                    titulo: 'Quanto de cada etapa sobrevive até a primeira ação',
                    descricao: `safra de convites criados nos últimos ${periodo} dias, convites deletados fora · a etapa de envio não existe: o rastreamento de entrega da plataforma parou em abr/2026`,
                    linhas: funil.data,
                    isLoading: funil.isLoading,
                    isError: funil.isError,
                    onRetry: () => void funil.refetch(),
                  },
                  {
                    rpc: 'bi_entrada_aceite_convite',
                    titulo: 'Em quanto tempo o convite é aceito',
                    descricao:
                      'só convites com mais de 30 dias, para não registrar como recusa o que ainda pode ser aceito · ignora o período do topo',
                    linhas: aceite.data,
                    isLoading: aceite.isLoading,
                    isError: aceite.isError,
                    onRetry: () => void aceite.refetch(),
                  },
                  {
                    rpc: 'bi_entrada_primeira_acao_por_origem',
                    titulo: 'Quando comprador e convidado agem pela primeira vez',
                    descricao:
                      'safra fechada: entrou entre 180 e 30 dias atrás, os dois grupos com a mesma janela · ignora o período do topo',
                    linhas: origem.data,
                    isLoading: origem.isLoading,
                    isError: origem.isError,
                    onRetry: () => void origem.refetch(),
                  },
                  {
                    rpc: 'bi_entrada_efeito_onboarding',
                    titulo: 'Quem terminou o onboarding volta mais que quem parou no meio',
                    descricao:
                      'clientes com 120+ dias de casa · associação, não causa · ignora o período do topo',
                    linhas: efeitoOnboarding.data,
                    isLoading: efeitoOnboarding.isLoading,
                    isError: efeitoOnboarding.isError,
                    onRetry: () => void efeitoOnboarding.refetch(),
                  },
                  {
                    rpc: 'bi_onboarding_abandono',
                    titulo: 'Em que etapa param os que não concluíram o onboarding',
                    descricao: 'foto de hoje, por etapa atual · ignora o período do topo',
                    linhas: onboarding.data,
                    isLoading: onboarding.isLoading,
                    isError: onboarding.isError,
                    onRetry: () => void onboarding.refetch(),
                  },
                  {
                    rpc: 'bi_masters_convites_resumo',
                    titulo: 'Quantos masters já convidaram alguém',
                    descricao: 'uma linha só — histórico completo, sem janela',
                    linhas: mastersResumo.data ? [mastersResumo.data] : [],
                    isLoading: mastersResumo.isLoading,
                    isError: mastersResumo.isError,
                    onRetry: () => void mastersResumo.refetch(),
                  },
                  {
                    rpc: 'bi_masters_top_convidadores',
                    titulo: 'Quem traz mais gente para dentro',
                    descricao: 'histórico completo, sem janela',
                    linhas: mastersTop.data,
                    limite: LIMITE_LISTA,
                    isLoading: mastersTop.isLoading,
                    isError: mastersTop.isError,
                    onRetry: () => void mastersTop.refetch(),
                  },
                ]}
              />
            </div>
          ),
          analise: <AnaliseDaTela tela="entrada" periodo={periodo} />,
          plano: <PlanoDaTela tela="entrada" periodo={periodo} />,
        }}
      />
    </div>
  )
}
