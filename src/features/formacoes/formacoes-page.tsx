import { useMemo, useState } from 'react'
import {
  AwardIcon,
  BookOpenIcon,
  CheckCheckIcon,
  DoorOpenIcon,
  GraduationCapIcon,
  HourglassIcon,
  LibraryIcon,
  MessageSquareIcon,
  RouteIcon,
  StarIcon,
  TimerIcon,
  TrendingDownIcon,
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
import { AnaliseDaTela } from '@/features/resumo/analise-tela'
import { PlanoDaTela } from '@/features/resumo/plano-da-tela'
import {
  useAssuntos,
  useDropoffPosicao,
  useDuracaoIdeal,
  useEfeitoCertificado,
  useEntradaNaGrade,
  useFormacoesKpis,
  useFormacoesUso,
  useJornadaCursos,
  useNpsCursos,
} from '@/features/formacoes/queries'

export function FormacoesPage() {
  const [periodo, setPeriodo] = useState<Periodo>(30)

  const kpis = useFormacoesKpis(periodo)
  const uso = useFormacoesUso(periodo)
  const duracao = useDuracaoIdeal()
  const dropoff = useDropoffPosicao()
  const nps = useNpsCursos()
  const jornada = useJornadaCursos()
  const assuntos = useAssuntos(periodo)
  const efeitoCert = useEfeitoCertificado()
  const entradaGrade = useEntradaNaGrade()

  // O headline de cada comparativo é o lado que responde a pergunta do título.
  // As duas taxas e a margem saem prontas do banco — aqui só se escolhe a linha.
  const comCertificado = useMemo(
    () => (efeitoCert.data ?? []).find((e) => e.grupo === 'Tirou certificado') ?? null,
    [efeitoCert.data],
  )

  const pelaPrimeira = useMemo(
    () => (entradaGrade.data ?? []).find((e) => e.grupo === 'Começou pela 1ª aula') ?? null,
    [entradaGrade.data],
  )

  // O outro lado de cada comparação entra no rótulo do headline. Vem do dado,
  // nunca escrito à mão: número em texto fixo envelhece na carga seguinte e
  // ninguém percebe, porque continua parecendo certo.
  const noMeioDaGrade = useMemo(
    () => (entradaGrade.data ?? []).find((e) => e.grupo === 'Entrou no meio da grade') ?? null,
    [entradaGrade.data],
  )

  const semCertificado = useMemo(
    () => (efeitoCert.data ?? []).find((e) => e.grupo === 'Estudou e não tirou') ?? null,
    [efeitoCert.data],
  )

  // Nenhuma destas RPCs corta a lista, então somar e comparar aqui é honesto.
  const assuntoLider = useMemo(() => {
    const cats = assuntos.data ?? []
    if (cats.length === 0) return null
    const maior = cats.reduce((a, b) => (b.aulas_concluidas > a.aulas_concluidas ? b : a))
    const total = cats.reduce((soma, a) => soma + a.aulas_concluidas, 0)
    return total > 0 ? { categoria: maior.categoria, parte: maior.aulas_concluidas / total } : null
  }, [assuntos.data])

  const melhorDuracao = useMemo(() => {
    const faixas = (duracao.data ?? []).filter((d) => d.taxa_media != null)
    if (faixas.length === 0) return null
    return faixas.reduce((a, b) => ((b.taxa_media ?? 0) > (a.taxa_media ?? 0) ? b : a))
  }, [duracao.data])

  // Último decil da grade: de quem começou o curso, quem chega ao fim.
  const chegamAoFim = (dropoff.data ?? []).at(-1)?.taxa_media ?? null

  // Mediana das medianas — o curso do meio, não uma média de medianas (que
  // misturaria cursos de tamanhos muito diferentes).
  const cursoMediano = useMemo(() => {
    const dias = (jornada.data ?? [])
      .map((j) => j.mediana_dias)
      .filter((d): d is number => d != null)
      .sort((a, b) => a - b)
    return dias.length > 0 ? dias[Math.floor(dias.length / 2)] : null
  }, [jornada.data])

  const piorNps = useMemo(() => {
    const cursos = (nps.data ?? []).filter((c) => c.pct_detratores != null)
    if (cursos.length === 0) return null
    return cursos.reduce((a, b) => ((b.pct_detratores ?? 0) > (a.pct_detratores ?? 0) ? b : a))
  }, [nps.data])

  return (
    <div className="space-y-4">
      {/* Título, régua e controles saem de `nav-items.ts` — a página não
          reescreve a própria régua. O frescor do dado anda junto dos controles. */}
      <CabecalhoDeModulo controles={<PeriodoFiltro valor={periodo} onChange={setPeriodo} />} />

      {/* Fora das abas: contexto do módulo inteiro. Trocar de aba não pode
          custar o número de referência nem obrigar a reajustar o período. */}
      <KpiGrid>
        <KpiCard
          label="Alunos ativos"
          value={kpis.data?.alunos_ativos ?? null}
          format={formatInt}
          isLoading={kpis.isLoading}
          isError={kpis.isError}
        />
        <KpiCard
          label="Aulas concluídas"
          value={kpis.data?.aulas_concluidas ?? null}
          format={formatInt}
          isLoading={kpis.isLoading}
          isError={kpis.isError}
        />
        <KpiCard
          label="Certificados emitidos"
          value={kpis.data?.certificados ?? null}
          format={formatInt}
          isLoading={kpis.isLoading}
          isError={kpis.isError}
        />
        <KpiCard
          label="NPS médio das aulas"
          value={kpis.data?.nps_medio ?? null}
          format={formatDecimal}
          isLoading={kpis.isLoading}
          isError={kpis.isError}
        />
      </KpiGrid>

      <ModuloTabs
        rota="/formacoes"
        conteudos={{
          graficos: (
            <div className="space-y-4">
              <SecaoDeAnalise
                titulo="O que os alunos estão assistindo"
                icone={LibraryIcon}
                descricao="Os dois lados contam a mesma aula concluída e mudam só o agrupamento — por formação e por categoria de curso. A janela é que diverge: o gráfico e as colunas de período seguem o filtro do topo, enquanto histórico, certificados e conclusão da tabela correm desde o início e não se comparam com eles."
              >
                <BentoItem span={6}>
                  <TabelaCard
                    nivel="descritivo"
                    id="card-uso-formacoes"
                    icon={GraduationCapIcon}
                    title="Uso por formação"
                    headline={uso.data ? formatInt(uso.data.length) : '—'}
                    headlineLabel="formações com aluno no período"
                    description="Alunos e aulas no período selecionado · histórico e conclusão desde o início · ordenado por alunos no período"
                    isLoading={uso.isLoading}
                    isError={uso.isError}
                    onRetry={() => void uso.refetch()}
                  >
                    <TabelaLonga
                      linhas={uso.data ?? []}
                      chave={(c) => String(c.curso)}
                      buscarEm={(c) => [c.curso]}
                      rotuloBusca="Buscar por formação"
                      cabecalho={
                        <TableRow>
                          <TableHead>Formação</TableHead>
                          <TableHead>Categoria</TableHead>
                          <TableHead className="text-right">Alunos ({periodo}d)</TableHead>
                          <TableHead className="text-right">Aulas ({periodo}d)</TableHead>
                          <TableHead className="text-right">Alunos (hist.)</TableHead>
                          <TableHead className="text-right">Certificados</TableHead>
                          <TableHead className="text-right">Conclusão</TableHead>
                        </TableRow>
                      }
                      renderLinha={(c) => (
                        <TableRow>
                          <TableCell className="max-w-64 truncate font-medium">{c.curso}</TableCell>
                          <TableCell>{c.categoria ?? '—'}</TableCell>
                          <TableCell className="num text-right">{formatInt(c.alunos)}</TableCell>
                          <TableCell className="num text-right">
                            {formatInt(c.aulas_concluidas)}
                          </TableCell>
                          <TableCell className="num text-right">
                            {formatInt(c.alunos_historico)}
                          </TableCell>
                          <TableCell className="num text-right">
                            {formatInt(c.certificados_historico)}
                          </TableCell>
                          <TableCell className="num text-right">
                            {c.conclusao_historica != null
                              ? formatPercent(c.conclusao_historica)
                              : '—'}
                          </TableCell>
                        </TableRow>
                      )}
                    />
                  </TabelaCard>
                </BentoItem>

                <BentoItem span={6}>
                  <ChartCard
                    nivel="descritivo"
                    icon={BookOpenIcon}
                    title="Assuntos mais assistidos"
                    headline={assuntoLider ? formatPercent(assuntoLider.parte) : '—'}
                    headlineLabel={assuntoLider ? `em ${assuntoLider.categoria}` : undefined}
                    description={`Aulas concluídas por categoria de curso · últimos ${periodo} dias`}
                    isLoading={assuntos.isLoading}
                    isError={assuntos.isError}
                    onRetry={() => void assuntos.refetch()}
                    isEmpty={assuntos.data?.length === 0}
                  >
                    <CategoryBarChart
                      layout="bar"
                      label="Aulas concluídas"
                      data={(assuntos.data ?? []).map((a) => ({
                        category: a.categoria,
                        value: a.aulas_concluidas,
                      }))}
                      valueFormatter={formatInt}
                      className="h-[280px]"
                    />
                  </ChartCard>
                </BentoItem>
              </SecaoDeAnalise>

              <SecaoDeAnalise
                titulo="O que decide se o aluno chega ao fim"
                icone={CheckCheckIcon}
                descricao="Os dois primeiros contam aula — taxa normalizada dentro do próprio curso, sobre todo o catálogo publicado, sem recorte de período. O terceiro troca de unidade e conta aluno, em coorte de 90+ dias desde a 1ª aula. Cada taxa tem denominador próprio: elas não se somam nem se comparam entre si."
              >
                <BentoItem span={8}>
                  <ChartCard
                    tone="brand"
                    nivel="diagnostico"
                    id="card-duracao"
                    icon={TimerIcon}
                    title="Duração de aula que maximiza conclusão"
                    headline={
                      melhorDuracao?.taxa_media != null
                        ? formatPercent(melhorDuracao.taxa_media)
                        : '—'
                    }
                    headlineLabel={melhorDuracao ? `na faixa ${melhorDuracao.faixa}` : undefined}
                    description="Taxa de conclusão normalizada por curso (conclusões da aula ÷ aula mais vista do mesmo curso) · só curso E aula publicados, com 50+ conclusões · faixa com menos de 10 aulas não vira média · a queda com a duração é real mas suave, e acima de 30 min não há aula publicada suficiente para afirmar — o precipício que esta tela mostrava vinha de 76 aulas longas em cursos não publicados"
                    isLoading={duracao.isLoading}
                    isError={duracao.isError}
                    onRetry={() => void duracao.refetch()}
                    isEmpty={duracao.data?.length === 0}
                  >
                    <CategoryBarChart
                      label="Taxa de conclusão"
                      data={(duracao.data ?? []).map((d) => ({
                        category: `${d.faixa} (${formatInt(d.aulas)} aulas)`,
                        value: d.taxa_media,
                        motivoSemValor: `amostra de ${formatInt(d.aulas)} ${
                          d.aulas === 1 ? 'aula' : 'aulas'
                        }, mínimo de 10`,
                      }))}
                      valueFormatter={formatPercent}
                      className="h-[300px]"
                    />
                  </ChartCard>
                </BentoItem>

                <BentoItem span={4}>
                  <ChartCard
                    nivel="diagnostico"
                    id="card-dropoff"
                    icon={TrendingDownIcon}
                    title="Onde o aluno para no curso"
                    headline={chegamAoFim != null ? formatPercent(chegamAoFim) : '—'}
                    headlineLabel="chegam ao fim da grade"
                    description="Sobrevivência média por posição da aula (conclusões ÷ 1ª aula do curso) · decis da grade"
                    isLoading={dropoff.isLoading}
                    isError={dropoff.isError}
                    onRetry={() => void dropoff.refetch()}
                    isEmpty={dropoff.data?.length === 0}
                  >
                    <CategoryBarChart
                      label="Sobrevivência"
                      data={(dropoff.data ?? []).map((d) => ({
                        category: `${d.decil * 10}%`,
                        // `bi_dropoff_posicao` não tem cláusula de supressão: a
                        // média do decil só não existe se o decil não existe.
                        value: d.taxa_media,
                      }))}
                      valueFormatter={formatPercent}
                      className="h-[280px]"
                    />
                  </ChartCard>
                </BentoItem>

                <BentoItem span={12}>
                  <TabelaCard
                    nivel="comparativo"
                    id="card-entrada-na-grade"
                    icon={DoorOpenIcon}
                    title="Quem começa pela primeira aula termina mais"
                    headline={pelaPrimeira?.pct != null ? formatPercent(pelaPrimeira.pct) : '—'}
                    headlineLabel={
                      noMeioDaGrade?.pct != null
                        ? `certificam, contra ${formatPercent(noMeioDaGrade.pct)} de quem entra no meio`
                        : 'certificam ao abrir o curso pela primeira aula'
                    }
                    description={
                      pelaPrimeira
                        ? `A unidade é a INSCRIÇÃO, não a pessoa: a mesma pessoa abre um curso pela 1ª aula e outro pelo meio, então ela aparece nos dois grupos · inscrições com 90+ dias desde a 1ª aula daquele curso · margem de ${formatDecimal(pelaPrimeira.margem_pp)} pp, calculada sobre PESSOAS — observações da mesma pessoa não são independentes, e usar inscrições encolheria a margem · entrar no meio também descreve quem já conhecia o assunto, e isso não sai daqui`
                        : 'Inscrições com 90+ dias desde a 1ª aula daquele curso'
                    }
                    isLoading={entradaGrade.isLoading}
                    isError={entradaGrade.isError}
                    onRetry={() => void entradaGrade.refetch()}
                    linhasEsqueleto={2}
                  >
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Por onde abriu o curso</TableHead>
                          <TableHead className="text-right">Inscrições</TableHead>
                          <TableHead className="text-right">Pessoas</TableHead>
                          <TableHead className="text-right">Certificaram</TableHead>
                          <TableHead className="text-right">Taxa</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(entradaGrade.data ?? []).map((e) => (
                          <TableRow key={e.grupo}>
                            <TableCell className="font-medium">{e.grupo}</TableCell>
                            <TableCell className="num text-right">
                              {formatInt(e.inscricoes)}
                            </TableCell>
                            <TableCell className="num text-muted-foreground text-right">
                              {formatInt(e.pessoas)}
                            </TableCell>
                            <TableCell className="num text-right">
                              {formatInt(e.certificaram)}
                            </TableCell>
                            <TableCell className="num text-right font-medium">
                              {e.pct != null ? formatPercent(e.pct) : '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TabelaCard>
                </BentoItem>
              </SecaoDeAnalise>

              <SecaoDeAnalise
                titulo="Quanto tempo leva até o certificado, e o que vem depois"
                icone={RouteIcon}
                descricao="Um olha para trás — quanto tempo a formação leva de quem já certificou — e o outro para a frente, comparando certificados com quem estudou e parou antes. As bases são recortadas por critérios diferentes (formação com volume mínimo de certificados de um lado, cliente com 120+ dias de casa do outro), então nenhum dos dois números explica o outro."
              >
                <BentoItem span={6}>
                  <TabelaCard
                    nivel="comparativo"
                    id="card-efeito-certificado"
                    icon={AwardIcon}
                    title="O certificado prende, ou só marca quem já estava preso?"
                    headline={
                      comCertificado?.pct_ativo != null
                        ? formatPercent(comCertificado.pct_ativo)
                        : '—'
                    }
                    headlineLabel={
                      semCertificado?.pct_ativo != null
                        ? `de quem certificou agiu no último mês, contra ${formatPercent(semCertificado.pct_ativo)}`
                        : 'de quem certificou agiu no último mês'
                    }
                    description={
                      comCertificado
                        ? `Clientes com 120+ dias de casa · os dois lados já estudaram, de propósito: sem isso a conta viraria "quem usa o produto × quem não usa" · margem de ${formatDecimal(comCertificado.margem_pp)} pp · associação, não causa — quem já ia ficar também termina mais`
                        : 'Clientes com 120+ dias de casa que já estudaram'
                    }
                    isLoading={efeitoCert.isLoading}
                    isError={efeitoCert.isError}
                    onRetry={() => void efeitoCert.refetch()}
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
                        {(efeitoCert.data ?? []).map((e) => (
                          <TableRow key={e.grupo}>
                            <TableCell className="font-medium">{e.grupo}</TableCell>
                            <TableCell className="num text-right">
                              {formatInt(e.clientes)}
                            </TableCell>
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
                    nivel="descritivo"
                    id="card-jornada"
                    icon={HourglassIcon}
                    title="Tempo até o certificado"
                    headline={cursoMediano != null ? formatDecimal(cursoMediano) : '—'}
                    headlineLabel="dias na formação mediana"
                    description="Mediana de dias entre a 1ª aula iniciada e o certificado · cursos com 20+ certificados · 0 = concluído no mesmo dia · o número acima é a formação do meio da lista, não uma média"
                    isLoading={jornada.isLoading}
                    isError={jornada.isError}
                    onRetry={() => void jornada.refetch()}
                  >
                    <TabelaLonga
                      linhas={jornada.data ?? []}
                      chave={(j) => String(j.curso)}
                      buscarEm={(j) => [j.curso]}
                      rotuloBusca="Buscar por formação"
                      cabecalho={
                        <TableRow>
                          <TableHead>Formação</TableHead>
                          <TableHead className="text-right">Certificados</TableHead>
                          <TableHead className="text-right">Mediana (dias)</TableHead>
                        </TableRow>
                      }
                      renderLinha={(j) => (
                        <TableRow>
                          <TableCell className="max-w-56 truncate font-medium">{j.curso}</TableCell>
                          <TableCell className="num text-right">
                            {formatInt(j.certificados)}
                          </TableCell>
                          <TableCell className="num text-right">
                            {j.mediana_dias != null ? formatDecimal(j.mediana_dias) : '—'}
                          </TableCell>
                        </TableRow>
                      )}
                    />
                  </TabelaCard>
                </BentoItem>
              </SecaoDeAnalise>

              <SecaoDeAnalise
                titulo="O que o aluno diz sobre a aula"
                icone={MessageSquareIcon}
                descricao="Única leitura do módulo que não sai de comportamento: é resposta declarada, e só de quem escolheu responder — quem abandonou o curso raramente responde, então a base já entra puxada para cima. A nota nasce na aula e sobe para o curso, de modo que uma aula ruim se dilui na média da formação."
              >
                <BentoItem span={12}>
                  <TabelaCard
                    nivel="prescritivo"
                    icon={StarIcon}
                    title="NPS por formação"
                    headline={
                      piorNps?.pct_detratores != null ? formatPercent(piorNps.pct_detratores) : '—'
                    }
                    headlineLabel="de detratores na pior formação"
                    description="Escala 0–10 por aula, agregado por curso · 10+ respostas · média geral 9,5 tem viés de positividade — o sinal está nos detratores"
                    isLoading={nps.isLoading}
                    isError={nps.isError}
                    onRetry={() => void nps.refetch()}
                  >
                    <TabelaLonga
                      linhas={nps.data ?? []}
                      chave={(n) => String(n.curso)}
                      buscarEm={(n) => [n.curso]}
                      rotuloBusca="Buscar por formação"
                      cabecalho={
                        <TableRow>
                          <TableHead>Formação</TableHead>
                          <TableHead className="text-right">Respostas</TableHead>
                          <TableHead className="text-right">Média</TableHead>
                          <TableHead className="text-right">Detratores</TableHead>
                        </TableRow>
                      }
                      renderLinha={(n) => (
                        <TableRow>
                          <TableCell className="max-w-56 truncate font-medium">{n.curso}</TableCell>
                          <TableCell className="num text-right">{formatInt(n.respostas)}</TableCell>
                          <TableCell className="num text-right">
                            {n.media != null ? formatDecimal(n.media) : '—'}
                          </TableCell>
                          <TableCell className="num text-right">
                            {n.pct_detratores != null ? formatPercent(n.pct_detratores) : '—'}
                          </TableCell>
                        </TableRow>
                      )}
                    />
                  </TabelaCard>
                </BentoItem>
              </SecaoDeAnalise>

              {/* A camada de dados fecha a aba, depois dos gráficos que ela
                  sustenta: as MESMAS queries, passadas já resolvidas. Nenhuma
                  consulta nova — se a lista refizesse a leitura, ela poderia
                  divergir do card logo acima. */}
              <AbaDeDados
                fontes={[
                  {
                    rpc: 'bi_formacoes_kpis',
                    titulo: 'Os quatro KPIs do topo do módulo',
                    descricao: 'uma linha só · segue o período do topo',
                    linhas: kpis.data ? [kpis.data] : [],
                    isLoading: kpis.isLoading,
                    isError: kpis.isError,
                    onRetry: () => void kpis.refetch(),
                  },
                  {
                    rpc: 'bi_formacoes_uso',
                    titulo: 'Alunos e aulas por formação',
                    descricao:
                      'alunos e aulas seguem o período do topo; histórico, certificados e conclusão correm desde o início e não se comparam com eles',
                    linhas: uso.data,
                    isLoading: uso.isLoading,
                    isError: uso.isError,
                    onRetry: () => void uso.refetch(),
                  },
                  {
                    rpc: 'bi_assuntos',
                    titulo: 'Aulas concluídas por categoria de curso',
                    linhas: assuntos.data,
                    isLoading: assuntos.isLoading,
                    isError: assuntos.isError,
                    onRetry: () => void assuntos.refetch(),
                  },
                  {
                    rpc: 'bi_duracao_ideal',
                    titulo: 'Conclusão da aula por faixa de duração',
                    descricao:
                      'taxa normalizada dentro do próprio curso · só curso E aula publicados, com 50+ conclusões · faixa com menos de 10 aulas não vira média',
                    linhas: duracao.data,
                    isLoading: duracao.isLoading,
                    isError: duracao.isError,
                    onRetry: () => void duracao.refetch(),
                  },
                  {
                    rpc: 'bi_dropoff_posicao',
                    titulo: 'Sobrevivência por posição da aula na grade',
                    descricao: 'conclusões ÷ 1ª aula do curso, por decil da grade',
                    linhas: dropoff.data,
                    isLoading: dropoff.isLoading,
                    isError: dropoff.isError,
                    onRetry: () => void dropoff.refetch(),
                  },
                  {
                    rpc: 'bi_formacoes_entrada_na_grade',
                    titulo: 'Certificação de quem começa pela 1ª aula, contra quem entra no meio',
                    descricao:
                      'alunos com 90+ dias desde a 1ª aula do curso · margem_pp é o piso para a diferença não ser ruído',
                    linhas: entradaGrade.data,
                    isLoading: entradaGrade.isLoading,
                    isError: entradaGrade.isError,
                    onRetry: () => void entradaGrade.refetch(),
                  },
                  {
                    rpc: 'bi_formacoes_efeito_certificado',
                    titulo: 'Atividade recente de quem certificou, contra quem estudou e parou',
                    descricao:
                      'clientes com 120+ dias de casa, os dois lados já estudaram · associação, não causa',
                    linhas: efeitoCert.data,
                    isLoading: efeitoCert.isLoading,
                    isError: efeitoCert.isError,
                    onRetry: () => void efeitoCert.refetch(),
                  },
                  {
                    rpc: 'bi_jornada_cursos',
                    titulo: 'Dias entre a 1ª aula e o certificado, por formação',
                    descricao: 'mediana · cursos com 20+ certificados',
                    linhas: jornada.data,
                    isLoading: jornada.isLoading,
                    isError: jornada.isError,
                    onRetry: () => void jornada.refetch(),
                  },
                  {
                    rpc: 'bi_nps_cursos',
                    titulo: 'Nota declarada da aula, agregada por formação',
                    descricao:
                      'escala 0–10 · 10+ respostas · só quem escolheu responder, então a base já entra puxada para cima',
                    linhas: nps.data,
                    isLoading: nps.isLoading,
                    isError: nps.isError,
                    onRetry: () => void nps.refetch(),
                  },
                ]}
              />
            </div>
          ),
          analise: <AnaliseDaTela tela="formacoes" periodo={periodo} />,
          plano: <PlanoDaTela tela="formacoes" periodo={periodo} />,
        }}
      />
    </div>
  )
}
