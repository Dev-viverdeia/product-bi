import { useMemo, useState } from 'react'
import {
  BugIcon,
  DoorClosedIcon,
  FunnelIcon,
  HourglassIcon,
  ListChecksIcon,
  LogInIcon,
  MailCheckIcon,
  MilestoneIcon,
  NetworkIcon,
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
import { AnaliseDaTela } from '@/features/resumo/analise-tela'
import { PlanoDaTela } from '@/features/resumo/plano-da-tela'
import {
  useAceiteConvite,
  useEfeitoOnboarding,
  useEntradaKpis,
  useErrosLogin,
  useErrosPorTela,
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
  const errosLogin = useErrosLogin(periodo)
  const errosTela = useErrosPorTela(periodo)

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

  const incompletos = useMemo(
    () => (onboarding.data ?? []).reduce((soma, o) => soma + o.clientes, 0),
    [onboarding.data],
  )

  // Categoria dominante do erro de login. O denominador é o conjunto inteiro
  // que a RPC devolve (não há corte), então a fatia é honesta.
  const erroDominante = useMemo(() => {
    const cats = errosLogin.data ?? []
    if (cats.length === 0) return null
    const maior = cats.reduce((a, b) => (b.ocorrencias > a.ocorrencias ? b : a))
    const total = cats.reduce((soma, e) => soma + e.ocorrencias, 0)
    return total > 0 ? { categoria: maior.categoria, parte: maior.ocorrencias / total } : null
  }, [errosLogin.data])

  // Lista de erros por tela pode vir cortada em LIMITE_LISTA, então nada de
  // somar: a pior tela vem primeiro e não depende do corte.
  const piorTela = errosTela.data?.[0] ?? null

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
        <KpiCard
          label="Erros de login"
          value={kpis.data?.erros_login ?? null}
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
                titulo="Quantos convites viram gente dentro da plataforma"
                icone={FunnelIcon}
                descricao="Os dois cards contam convites, não pessoas — convite recusado e cliente que nunca apareceu são fatos diferentes, e só o primeiro está aqui. A janela é o que os separa: o funil acompanha a safra do período escolhido, enquanto o aceite só admite convite com mais de 30 dias, para não registrar como recusa o que ainda pode ser aceito."
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
                    isError={aceite.isError}
                    onRetry={() => void aceite.refetch()}
                    isEmpty={aceite.data?.length === 0}
                  >
                    <CategoryBarChart
                      layout="bar"
                      label="Convites"
                      data={(aceite.data ?? []).map((a) => ({
                        category: a.faixa,
                        value: a.pct ?? 0,
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
              </SecaoDeAnalise>

              <SecaoDeAnalise
                titulo="Depois de entrar, quanto tempo até a primeira ação"
                icone={HourglassIcon}
                descricao="Safra fechada e única, para que comprador e convidado tenham tido exatamente a mesma janela de oportunidade. É por isso que estes números não conversam com os da seção acima: lá a safra é a do período escolhido, e quem entrou ontem ainda conta como quem não agiu."
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
              </SecaoDeAnalise>

              <SecaoDeAnalise
                titulo="O que acontece com quem não termina o onboarding"
                icone={MilestoneIcon}
                descricao="As bases não são as mesmas: a distribuição por etapa é a foto de todo mundo que ficou pelo caminho, hoje, e a comparação de retorno só admite quem tem 120+ dias de casa. Um card não fecha no outro — são recortes de tempo diferentes sobre a mesma etapa inacabada."
              >
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
                    headline={formatInt(incompletos)}
                    headlineLabel="não concluíram o onboarding"
                    description="Distribuição por etapa atual de quem não concluiu · o número que estava aqui era escrito à mão e estava errado (dizia 89,5% quando a régua e_cliente dá 92,5%); percentual só entra vindo do banco"
                    isLoading={onboarding.isLoading}
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

              <SecaoDeAnalise
                titulo="Quem traz gente nova para dentro"
                icone={NetworkIcon}
                descricao="Único bloco da tela que olha para quem convida, e não para quem foi convidado — e o único que ignora o seletor de período: os números valem desde o começo, então o topo da lista se move devagar e não reage ao filtro do cabeçalho."
              >
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
                titulo="Onde o cliente esbarra antes de conseguir usar"
                icone={DoorClosedIcon}
                descricao="Duas telemetrias distintas, que não se somam: uma registra a tentativa de entrar que falhou, a outra o erro de JavaScript numa tela já aberta. As duas contam ocorrências, não pessoas — o mesmo cliente insistindo aparece várias vezes, então volume alto pode ser muita gente ou uma só."
              >
                <BentoItem span={6}>
                  <ChartCard
                    nivel="descritivo"
                    id="card-erros-login"
                    icon={LogInIcon}
                    title="Erros de login por categoria"
                    headline={erroDominante ? formatPercent(erroDominante.parte) : '—'}
                    headlineLabel={erroDominante ? `em ${erroDominante.categoria}` : undefined}
                    description={`auth_error_telemetry · últimos ${periodo} dias · invalid_credentials = senha errada (esperado); investigar FALLBACK`}
                    isLoading={errosLogin.isLoading}
                    isError={errosLogin.isError}
                    onRetry={() => void errosLogin.refetch()}
                    isEmpty={errosLogin.data?.length === 0}
                  >
                    <CategoryBarChart
                      layout="bar"
                      label="Ocorrências"
                      data={(errosLogin.data ?? []).map((e) => ({
                        category: e.categoria,
                        value: e.ocorrencias,
                      }))}
                      valueFormatter={formatInt}
                      className="h-[300px]"
                    />
                  </ChartCard>
                </BentoItem>

                <BentoItem span={6}>
                  <TabelaCard
                    nivel="prescritivo"
                    icon={BugIcon}
                    title="Erros de JavaScript por tela"
                    headline={piorTela ? formatInt(piorTela.ocorrencias) : '—'}
                    headlineLabel={piorTela ? `na pior tela (${piorTela.tela})` : undefined}
                    description={`client_error_logs · últimos ${periodo} dias · onde o cliente sofre`}
                    isLoading={errosTela.isLoading}
                    isError={errosTela.isError}
                    onRetry={() => void errosTela.refetch()}
                  >
                    <TabelaLonga
                      linhas={errosTela.data ?? []}
                      limiteDaFonte={LIMITE_LISTA}
                      chave={(e) => String(e.tela)}
                      buscarEm={(e) => [e.tela]}
                      rotuloBusca="Buscar por tela"
                      cabecalho={
                        <TableRow>
                          <TableHead>Tela</TableHead>
                          <TableHead className="text-right">Ocorrências</TableHead>
                        </TableRow>
                      }
                      renderLinha={(e) => (
                        <TableRow>
                          <TableCell className="font-mono text-xs">{e.tela}</TableCell>
                          <TableCell className="num text-right">
                            {formatInt(e.ocorrencias)}
                          </TableCell>
                        </TableRow>
                      )}
                    />
                  </TabelaCard>
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
                  {
                    rpc: 'bi_erros_login',
                    titulo: 'Por que a tentativa de entrar falhou',
                    descricao: `auth_error_telemetry · últimos ${periodo} dias · conta ocorrências, não pessoas`,
                    linhas: errosLogin.data,
                    isLoading: errosLogin.isLoading,
                    isError: errosLogin.isError,
                    onRetry: () => void errosLogin.refetch(),
                  },
                  {
                    rpc: 'bi_erros_por_tela',
                    titulo: 'Em que tela o JavaScript quebra',
                    descricao: `client_error_logs · últimos ${periodo} dias · conta ocorrências, não pessoas`,
                    linhas: errosTela.data,
                    limite: LIMITE_LISTA,
                    isLoading: errosTela.isLoading,
                    isError: errosTela.isError,
                    onRetry: () => void errosTela.refetch(),
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
