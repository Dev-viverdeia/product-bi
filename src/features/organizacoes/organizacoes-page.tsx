import { useMemo } from 'react'
import {
  AlertTriangleIcon,
  ArmchairIcon,
  ArrowDownWideNarrowIcon,
  Building2Icon,
  ClipboardListIcon,
  CrownIcon,
  NetworkIcon,
  PackageOpenIcon,
  ScaleIcon,
  UsersRoundIcon,
} from 'lucide-react'

import { CategoryBarChart, ChartCard, KpiCard, KpiGrid } from '@/components/charts'
import { BentoItem } from '@/components/layout/bento'
import { CabecalhoDeModulo } from '@/components/layout/cabecalho-de-modulo'
import { ModuloTabs } from '@/components/layout/modulo-tabs'
import { SecaoDeAnalise } from '@/components/layout/secao-de-analise'
import { AbaDeDados } from '@/components/tabela/aba-de-dados'
import { TabelaCard } from '@/components/tabela/tabela-card'
import { TabelaLonga } from '@/components/tabela/tabela-longa'
import { Badge } from '@/components/ui/badge'
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
import { AnaliseDaTela } from '@/features/resumo/analise-tela'
import { PlanoDaTela } from '@/features/resumo/plano-da-tela'
import {
  useEfeitoMaster,
  useOrgsDistribuicao,
  useOrgsKpis,
  useOrgsOcupacao,
  useOrgsPorTamanho,
  useOrgsQuemParouPrimeiro,
  useOrgsRisco,
  useValorNaoConsumido,
} from '@/features/organizacoes/queries'

export function OrganizacoesPage() {
  const kpis = useOrgsKpis()
  const risco = useOrgsRisco()
  const efeito = useEfeitoMaster()
  const ocupacao = useOrgsOcupacao()
  const valor = useValorNaoConsumido()
  const porTamanho = useOrgsPorTamanho()
  const distribuicao = useOrgsDistribuicao()
  const sequencia = useOrgsQuemParouPrimeiro()

  // As RPCs vêm ordenadas; aqui só se escolhe a linha que o headline afirma.
  const orgsGrandes = useMemo(
    () => (porTamanho.data ?? []).find((t) => t.ordem === 3) ?? null,
    [porTamanho.data],
  )
  const orgsPequenas = useMemo(
    () => (porTamanho.data ?? []).find((t) => t.ordem === 1) ?? null,
    [porTamanho.data],
  )
  const semNinguem = useMemo(
    () => (distribuicao.data ?? []).find((d) => d.faixa === 'Ninguém ativo') ?? null,
    [distribuicao.data],
  )
  // A faixa que concentra mais gente não é a que tem mais contas — é o ponto
  // do card, e sai do dado em vez de estar escrita no texto.
  const faixaComMaisGente = useMemo(() => {
    const fs = (distribuicao.data ?? []).filter((d) => d.pessoas > 0)
    if (fs.length === 0) return null
    return fs.reduce((a, b) => (b.pessoas > a.pessoas ? b : a))
  }, [distribuicao.data])
  const masterAntes = useMemo(
    () => (sequencia.data ?? []).find((s) => s.quem === 'O master parou antes') ?? null,
    [sequencia.data],
  )
  const timeAntes = useMemo(
    () => (sequencia.data ?? []).find((s) => s.quem === 'O time parou antes') ?? null,
    [sequencia.data],
  )

  const comMaster = efeito.data?.find((e) => e.grupo.startsWith('Master ativo'))
  const semMaster = efeito.data?.find((e) => e.grupo.startsWith('Master parado'))
  const lift =
    comMaster?.pct_time_ativo && semMaster?.pct_time_ativo
      ? comMaster.pct_time_ativo / semMaster.pct_time_ativo
      : null

  // O benefício mais desperdiçado é o que o card pede para agir.
  const maisDesperdicado = useMemo(() => {
    const itens = (valor.data ?? []).filter((v) => v.pct_uso != null)
    if (itens.length === 0) return null
    return itens.reduce((a, b) => ((b.pct_uso ?? 1) < (a.pct_uso ?? 1) ? b : a))
  }, [valor.data])

  // Faixa com mais organizações — onde a base com limite de fato está. A fatia
  // vem do banco (`pct_das_com_limite`), não de soma no front: contagem nunca é
  // suprimida, e percentual derivado dela escaparia da régua de amostra.
  const faixaLotacao = useMemo(() => {
    const fs = ocupacao.data ?? []
    return fs.length > 0 ? fs.reduce((a, b) => (b.orgs > a.orgs ? b : a)) : null
  }, [ocupacao.data])
  // Cobertura: colunas de janela, iguais em toda linha.
  const coberturaAssentos = ocupacao.data?.[0] ?? null

  // Lista de risco vem ordenada pela pior; nada de somar (pode vir cortada).
  const orgMaisParada = risco.data?.[0] ?? null

  return (
    <div className="space-y-4">
      {/* Título, régua e controles saem de `nav-items.ts` — a página não
          reescreve a própria régua. Esta tela não oferece período nem recorte,
          então o cabeçalho fica só com o frescor do dado. */}
      <CabecalhoDeModulo />

      {/* Fora das abas: contexto das duas. Trocar entre a leitura e os gráficos
          não pode custar os números de referência da tela. */}
      <div id="card-kpis">
        <KpiGrid>
          {/* "com time" e não só "ativas": este KPI conta `ativa and membros > 0`,
              e o card "Onde estão as contas" logo abaixo usa TODAS as ativas —
              1.925 contra 1.957, o mesmo nome para duas populações na mesma
              tela. A diferença são as 32 contas sem ninguém dentro, que o card
              mostra na primeira faixa. As médias desta fileira dependem do
              recorte com time: conta vazia não tem fração de time ativo. */}
          <KpiCard
            label="Organizações ativas com time"
            value={kpis.data?.orgs_ativas ?? null}
            format={formatInt}
            isLoading={kpis.isLoading}
            isError={kpis.isError}
          />
          <KpiCard
            label="Membros em organizações"
            value={kpis.data?.membros_total ?? null}
            format={formatInt}
            isLoading={kpis.isLoading}
            isError={kpis.isError}
          />
          <KpiCard
            label="Time ativo (média)"
            value={kpis.data?.pct_time_ativo_medio ?? null}
            format={formatPercent}
            isLoading={kpis.isLoading}
            isError={kpis.isError}
          />
          <KpiCard
            label="Orgs com master ativo"
            value={kpis.data?.orgs_master_ativo ?? null}
            format={formatPercent}
            isLoading={kpis.isLoading}
            isError={kpis.isError}
          />
        </KpiGrid>
      </div>

      {/*
        As três abas separam formato, não assunto: o panorama continua inteiro
        num painel só. Quem divide por pergunta são as seções dentro do painel,
        não as abas — fatiar o panorama em abas por tema é que deixaria de ser
        panorama.

        Sem período e sem recorte de propósito: esta tela não oferece os dois
        controles, e cada achado declara a própria janela no texto.
      */}
      <ModuloTabs
        rota="/organizacoes"
        conteudos={{
          graficos: (
            <div className="space-y-4">
              <SecaoDeAnalise
                titulo="O que já foi contratado e ainda não virou uso"
                icone={ClipboardListIcon}
                descricao="As duas listas viram tarefa de CS e têm grãos diferentes: uma linha é um benefício oferecido à base inteira, a outra é uma organização nomeada. Nenhuma ordena por dinheiro — não há valor em reais nesta tela, só gente, assento e uso."
              >
                <BentoItem span={12}>
                  <TabelaCard
                    nivel="prescritivo"
                    icon={PackageOpenIcon}
                    title="Valor contratado e não consumido"
                    headline={
                      maisDesperdicado?.pct_uso != null
                        ? formatPercent(maisDesperdicado.pct_uso)
                        : '—'
                    }
                    headlineLabel={
                      maisDesperdicado
                        ? `de uso no mais parado (${maisDesperdicado.item})`
                        : undefined
                    }
                    description="Benefícios que a empresa entrega e o cliente não usa — churn silencioso e oportunidade de ativação por CS"
                    isLoading={valor.isLoading}
                    isRefreshing={valor.isFetching && !!valor.data}
                    isError={valor.isError}
                    onRetry={() => void valor.refetch()}
                  >
                    <TabelaLonga
                      linhas={valor.data ?? []}
                      chave={(v) => v.item}
                      buscarEm={(v) => [v.item]}
                      rotuloBusca="Buscar benefício"
                      vazio="Nenhum benefício disponível no período."
                      cabecalho={
                        <TableRow>
                          <TableHead>Benefício</TableHead>
                          <TableHead className="text-right">Disponível</TableHead>
                          <TableHead className="text-right">Usado</TableHead>
                          <TableHead className="text-right">% de uso</TableHead>
                          <TableHead className="text-right">Beneficiários</TableHead>
                        </TableRow>
                      }
                      renderLinha={(v) => (
                        <TableRow>
                          <TableCell className="font-medium">{v.item}</TableCell>
                          <TableCell className="num text-right">
                            {formatInt(v.disponivel)}
                          </TableCell>
                          <TableCell className="num text-right">
                            {formatInt(v.usado)}
                          </TableCell>
                          <TableCell className="num text-right font-medium">
                            {v.pct_uso != null ? formatPercent(v.pct_uso) : '—'}
                          </TableCell>
                          <TableCell className="num text-right">
                            {formatInt(v.beneficiarios)}
                          </TableCell>
                        </TableRow>
                      )}
                    />
                  </TabelaCard>
                </BentoItem>

                <BentoItem span={12}>
                  <TabelaCard
                    nivel="prescritivo"
                    icon={AlertTriangleIcon}
                    title="Organizações em risco — time parado"
                    headline={
                      orgMaisParada?.pct_time_ativo != null
                        ? formatPercent(orgMaisParada.pct_time_ativo)
                        : '—'
                    }
                    headlineLabel={
                      orgMaisParada
                        ? `de time ativo na pior (${orgMaisParada.organizacao})`
                        : undefined
                    }
                    description="Orgs ativas com 3+ membros, ordenadas pelo menor percentual de time ativo · lista para ação de CS"
                    isLoading={risco.isLoading}
                    isRefreshing={risco.isFetching && !!risco.data}
                    isError={risco.isError}
                    onRetry={() => void risco.refetch()}
                  >
                    <TabelaLonga
                      linhas={risco.data ?? []}
                      chave={(r) => String(r.organizacao)}
                      buscarEm={(r) => [r.organizacao]}
                      rotuloBusca="Buscar por organização"
                      // 25 de 1.031 organizações elegíveis. O corte só existia
                      // na prosa da seção, e a régua de densidade manda encurtar
                      // essa prosa — aqui ele vira mecanismo: a TabelaLonga só
                      // anuncia quando o corte de fato morde.
                      limiteDaFonte={25}
                      cabecalho={
                        <TableRow>
                          <TableHead>Organização</TableHead>
                          <TableHead>Plano</TableHead>
                          <TableHead className="text-right">Membros</TableHead>
                          <TableHead className="text-right">Ativos 30d</TableHead>
                          <TableHead className="text-right">Time ativo</TableHead>
                          <TableHead>Master</TableHead>
                          <TableHead className="text-right">Assentos ociosos</TableHead>
                        </TableRow>
                      }
                      renderLinha={(r) => (
                        <TableRow>
                          <TableCell className="max-w-64 truncate font-medium">
                            {r.organizacao}
                          </TableCell>
                          <TableCell>{r.plano ?? '—'}</TableCell>
                          <TableCell className="num text-right">
                            {formatInt(r.membros)}
                          </TableCell>
                          <TableCell className="num text-right">
                            {formatInt(r.ativos_30d)}
                          </TableCell>
                          <TableCell className="num text-right">
                            {r.pct_time_ativo != null ? formatPercent(r.pct_time_ativo) : '—'}
                          </TableCell>
                          <TableCell>
                            <Badge variant={r.master_ativo ? 'secondary' : 'outline'}>
                              {r.master_ativo ? 'Ativo' : 'Parado'}
                            </Badge>
                          </TableCell>
                          <TableCell className="num text-right">
                            {formatInt(r.assentos_ociosos)}
                          </TableCell>
                        </TableRow>
                      )}
                    />
                  </TabelaCard>
                </BentoItem>
              </SecaoDeAnalise>

              <SecaoDeAnalise
                titulo="Quanto de cada conta está de fato dentro do produto"
                icone={Building2Icon}
                descricao="Três recortes da mesma base, com denominadores que não se somam: a ocupação compara membros com o limite contratado; os outros dois, quem teve ação nos últimos 30 dias com os membros da conta. Assento preenchido não é assento que aparece."
              >
                <BentoItem span={12}>
                  <TabelaCard
                    nivel="diagnostico"
                    id="card-distribuicao-engajamento"
                    icon={ScaleIcon}
                    title="Onde estão as contas, e onde está a gente"
                    headline={
                      semNinguem?.pct_orgs != null ? formatPercent(semNinguem.pct_orgs) : '—'
                    }
                    headlineLabel={
                      semNinguem ? `das contas ativas não têm ninguém aparecendo` : undefined
                    }
                    description={
                      faixaComMaisGente
                        ? `TODAS as organizações ativas — ${formatInt(faixaComMaisGente.total_orgs)}, incluindo as sem membro nenhum, que a fileira de KPIs não conta · fatia do time que apareceu nos 30 dias até o último dia com dado · as duas colunas de percentual apontam para faixas diferentes: a maior parte das CONTAS está zerada, e a maior parte das PESSOAS está em "${faixaComMaisGente.faixa}"`
                        : 'Organizações ativas por fatia do time que apareceu nos últimos 30 dias com dado'
                    }
                    isLoading={distribuicao.isLoading}
                    isRefreshing={distribuicao.isFetching && !!distribuicao.data}
                    isError={distribuicao.isError}
                    onRetry={() => void distribuicao.refetch()}
                    linhasEsqueleto={6}
                  >
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fatia do time ativa</TableHead>
                          <TableHead className="text-right">Organizações</TableHead>
                          <TableHead className="text-right">% das contas</TableHead>
                          <TableHead className="text-right">Pessoas</TableHead>
                          <TableHead className="text-right">% das pessoas</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(distribuicao.data ?? []).map((d) => (
                          <TableRow key={d.faixa}>
                            <TableCell className="font-medium">{d.faixa}</TableCell>
                            <TableCell className="num text-right">{formatInt(d.orgs)}</TableCell>
                            <TableCell
                              className="num text-right"
                              style={fundoIntensidade(d.pct_orgs)}
                            >
                              {d.pct_orgs != null ? formatPercent(d.pct_orgs) : '—'}
                            </TableCell>
                            <TableCell className="num text-right">{formatInt(d.pessoas)}</TableCell>
                            <TableCell
                              className="num text-right"
                              style={fundoIntensidade(d.pct_pessoas)}
                            >
                              {d.pct_pessoas != null ? formatPercent(d.pct_pessoas) : '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TabelaCard>
                </BentoItem>

                <BentoItem span={8}>
                  <TabelaCard
                    nivel="comparativo"
                    id="card-orgs-por-tamanho"
                    icon={UsersRoundIcon}
                    title="Quanto maior o time, menor a fatia que aparece"
                    headline={orgsGrandes?.taxa != null ? formatPercent(orgsGrandes.taxa) : '—'}
                    headlineLabel={
                      orgsPequenas?.taxa != null
                        ? `do time ativo acima de 20 pessoas, contra ${formatPercent(orgsPequenas.taxa)} até 5`
                        : 'do time ativo nas organizações maiores'
                    }
                    description={
                      orgsGrandes
                        ? `Organizações ativas com pelo menos um membro · margem de ${formatDecimal(orgsGrandes.margem_pp)} pp entre as pontas · as duas contas aparecem de propósito: a taxa por pessoa e a média das organizações concordam, então o gradiente não é efeito de misturar conta de uma pessoa com conta de cem`
                        : 'Organizações ativas com pelo menos um membro'
                    }
                    isLoading={porTamanho.isLoading}
                    isRefreshing={porTamanho.isFetching && !!porTamanho.data}
                    isError={porTamanho.isError}
                    onRetry={() => void porTamanho.refetch()}
                    linhasEsqueleto={3}
                  >
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tamanho</TableHead>
                          <TableHead className="text-right">Orgs</TableHead>
                          <TableHead className="text-right">Pessoas</TableHead>
                          <TableHead className="text-right">Taxa por pessoa</TableHead>
                          <TableHead className="text-right">Média das orgs</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(porTamanho.data ?? []).map((t) => (
                          <TableRow key={t.faixa}>
                            <TableCell className="font-medium">{t.faixa}</TableCell>
                            <TableCell className="num text-right">{formatInt(t.orgs)}</TableCell>
                            <TableCell className="num text-right">{formatInt(t.pessoas)}</TableCell>
                            <TableCell className="num text-right font-medium">
                              {t.taxa != null ? formatPercent(t.taxa) : '—'}
                            </TableCell>
                            <TableCell className="text-muted-foreground num text-right">
                              {t.media_das_orgs != null ? formatPercent(t.media_das_orgs) : '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TabelaCard>
                </BentoItem>

                <BentoItem span={4}>
                  <ChartCard
                    tone="brand"
                    nivel="descritivo"
                    icon={ArmchairIcon}
                    title="Ocupação de assentos"
                    headline={
                      faixaLotacao?.pct_das_com_limite != null
                        ? formatPercent(faixaLotacao.pct_das_com_limite)
                        : '—'
                    }
                    headlineLabel={
                      faixaLotacao ? `das orgs com limite em ${faixaLotacao.faixa}` : undefined
                    }
                    description={
                      coberturaAssentos
                        ? `Membros vs limite contratado · orgs lotadas são oportunidade de upsell; abaixo de 50%, risco de valor não percebido · o denominador é a base COM limite (${formatInt(coberturaAssentos.orgs_com_limite)} de ${formatInt(coberturaAssentos.orgs_ativas)} orgs ativas): as outras ${formatInt(coberturaAssentos.orgs_sem_limite)} não têm limite definido e ficam fora do eixo, porque sem limite não há ocupação a medir`
                        : 'Membros vs limite contratado · orgs lotadas são oportunidade de upsell; abaixo de 50%, risco de valor não percebido'
                    }
                    isLoading={ocupacao.isLoading}
                    isRefreshing={ocupacao.isFetching && !!ocupacao.data}
                    isError={ocupacao.isError}
                    onRetry={() => void ocupacao.refetch()}
                    isEmpty={ocupacao.data?.length === 0}
                  >
                    <CategoryBarChart
                      layout="bar"
                      label="Organizações"
                      data={(ocupacao.data ?? []).map((o) => ({
                        category: o.faixa,
                        value: o.orgs,
                      }))}
                      valueFormatter={formatInt}
                      className="h-[260px]"
                    />
                  </ChartCard>
                </BentoItem>
              </SecaoDeAnalise>

              <SecaoDeAnalise
                titulo="O master puxa o time, ou é o primeiro a sumir"
                icone={NetworkIcon}
                descricao="A mesma dupla master–time por ângulos opostos: um compara contas com o master ativo contra contas em que ele parou; o outro entra nas já esfriadas e pergunta quem parou antes. Associação, não causa: master ativo pode ser sintoma."
              >
                <BentoItem span={6}>
                  <TabelaCard
                    nivel="comparativo"
                    id="card-efeito-master"
                    icon={CrownIcon}
                    title="O master engajado puxa o time?"
                    headline={lift ? `${formatDecimal(lift)}×` : '—'}
                    headlineLabel="mais time ativo com master ativo"
                    description="Organizações ativas com 2+ membros · master ativo = teve ação nos 30 dias até o último dia com dado"
                    isLoading={efeito.isLoading}
                    isRefreshing={efeito.isFetching && !!efeito.data}
                    isError={efeito.isError}
                    onRetry={() => void efeito.refetch()}
                    linhasEsqueleto={2}
                  >
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Grupo</TableHead>
                          <TableHead className="text-right">Organizações</TableHead>
                          <TableHead className="text-right">Membros</TableHead>
                          <TableHead className="text-right">Time ativo (média)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(efeito.data ?? []).map((e) => (
                          <TableRow key={e.grupo}>
                            <TableCell className="font-medium">{e.grupo}</TableCell>
                            <TableCell className="num text-right">
                              {formatInt(e.orgs)}
                            </TableCell>
                            <TableCell className="num text-right">
                              {formatInt(e.membros)}
                            </TableCell>
                            <TableCell className="num text-right font-medium">
                              {e.pct_time_ativo != null ? formatPercent(e.pct_time_ativo) : '—'}
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
                    id="card-quem-parou-primeiro"
                    icon={ArrowDownWideNarrowIcon}
                    title="Quando a conta esfria, quem parou primeiro?"
                    headline={masterAntes?.pct != null ? formatPercent(masterAntes.pct) : '—'}
                    headlineLabel={
                      timeAntes?.pct != null
                        ? `das vezes o master parou antes, contra ${formatPercent(timeAntes.pct)} do time`
                        : 'das vezes o master parou antes do time'
                    }
                    description={
                      masterAntes
                        ? `Organizações cujo master está parado há 30+ dias, com histórico dos dois lados (${formatInt(masterAntes.base_com_historico)} contas) · ${formatInt(masterAntes.fora_sem_historico)} ficam de fora porque um dos lados nunca registrou ação: essas não esfriaram, nunca esquentaram · janela de 14 dias para não chamar de "antes" o que é a mesma semana · master que delegou o uso aparece aqui como parado sem ter abandonado`
                        : 'Organizações cujo master está parado há 30+ dias, com histórico dos dois lados'
                    }
                    isLoading={sequencia.isLoading}
                    isRefreshing={sequencia.isFetching && !!sequencia.data}
                    isError={sequencia.isError}
                    onRetry={() => void sequencia.refetch()}
                    linhasEsqueleto={3}
                  >
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Quem registrou a última ação primeiro</TableHead>
                          <TableHead className="text-right">Organizações</TableHead>
                          <TableHead className="text-right">Fatia</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(sequencia.data ?? []).map((s) => (
                          <TableRow key={s.quem}>
                            <TableCell className="font-medium">{s.quem}</TableCell>
                            <TableCell className="num text-right">{formatInt(s.orgs)}</TableCell>
                            <TableCell
                              className="num text-right font-medium"
                              style={fundoIntensidade(s.pct)}
                            >
                              {s.pct != null ? formatPercent(s.pct) : '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TabelaCard>
                </BentoItem>
              </SecaoDeAnalise>

              {/* A camada de dados fecha a aba: as MESMAS queries que os cards
                  acima desenham, passadas já resolvidas. Nenhuma consulta nova —
                  se a lista refizesse a leitura, ela poderia divergir do card. */}
              <AbaDeDados
                fontes={[
                  {
                    rpc: 'bi_orgs_kpis',
                    titulo: 'Os quatro KPIs do topo da tela',
                    descricao:
                      'uma linha só — contas ativas, membros, time ativo médio e fatia com master ativo',
                    linhas: kpis.data ? [kpis.data] : [],
                    isLoading: kpis.isLoading,
                    isError: kpis.isError,
                    onRetry: () => void kpis.refetch(),
                  },
                  {
                    rpc: 'bi_orgs_distribuicao_engajamento',
                    titulo: 'Quantas contas, e quanta gente, em cada faixa de time ativo',
                    descricao:
                      'as duas colunas de percentual têm denominadores diferentes — contas e pessoas — e apontam para faixas diferentes de propósito',
                    linhas: distribuicao.data,
                    isLoading: distribuicao.isLoading,
                    isError: distribuicao.isError,
                    onRetry: () => void distribuicao.refetch(),
                  },
                  {
                    rpc: 'bi_orgs_por_tamanho',
                    titulo: 'A fatia do time que aparece muda com o tamanho da conta',
                    descricao:
                      'taxa por pessoa e média das organizações vêm juntas: quando concordam, o gradiente não é artefato de misturar conta de uma pessoa com conta de cem',
                    linhas: porTamanho.data,
                    isLoading: porTamanho.isLoading,
                    isError: porTamanho.isError,
                    onRetry: () => void porTamanho.refetch(),
                  },
                  {
                    rpc: 'bi_orgs_ocupacao',
                    titulo: 'Quantas contas em cada faixa de assentos preenchidos',
                    descricao:
                      'membros cadastrados contra o limite contratado — assento preenchido não é assento que aparece',
                    linhas: ocupacao.data,
                    isLoading: ocupacao.isLoading,
                    isError: ocupacao.isError,
                    onRetry: () => void ocupacao.refetch(),
                  },
                  {
                    rpc: 'bi_orgs_efeito_master',
                    titulo: 'Quanto time ativo há com o master ativo, e sem ele',
                    descricao:
                      'organizações ativas com 2+ membros · master ativo = ação nos 30 dias até o último dia com dado · associação, não causa',
                    linhas: efeito.data,
                    isLoading: efeito.isLoading,
                    isError: efeito.isError,
                    onRetry: () => void efeito.refetch(),
                  },
                  {
                    rpc: 'bi_orgs_quem_parou_primeiro',
                    titulo: 'Nas contas esfriadas, quem registrou a última ação primeiro',
                    descricao:
                      'só contas com master parado há 30+ dias e histórico dos dois lados · janela de 14 dias para não chamar de "antes" o que é a mesma semana',
                    linhas: sequencia.data,
                    isLoading: sequencia.isLoading,
                    isError: sequencia.isError,
                    onRetry: () => void sequencia.refetch(),
                  },
                  {
                    rpc: 'bi_valor_nao_consumido',
                    titulo: 'Quanto de cada benefício contratado virou uso',
                    descricao: 'uma linha por benefício oferecido à base inteira, não por conta',
                    linhas: valor.data,
                    isLoading: valor.isLoading,
                    isError: valor.isError,
                    onRetry: () => void valor.refetch(),
                  },
                  {
                    rpc: 'bi_orgs_risco',
                    titulo: 'As contas com a menor fatia de time ativo',
                    descricao:
                      'orgs ativas com 3+ membros, ordenadas pela pior · a contagem é o tamanho da lista, não o tamanho do problema',
                    linhas: risco.data,
                    limite: 25,
                    isLoading: risco.isLoading,
                    isError: risco.isError,
                    onRetry: () => void risco.refetch(),
                  },
                ]}
              />
            </div>
          ),
          analise: <AnaliseDaTela tela="organizacoes" />,
          plano: <PlanoDaTela tela="organizacoes" />,
        }}
      />
    </div>
  )
}
