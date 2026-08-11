import { CategoryBarChart, ChartCard, KpiCard, KpiGrid } from '@/components/charts'
import { BentoGrid, BentoItem } from '@/components/layout/bento'
import { TabelaLonga } from '@/components/tabela/tabela-longa'
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
import { formatDecimal, formatInt, formatPercent } from '@/lib/format'
import {
  useEfeitoMaster,
  useOrgsKpis,
  useOrgsOcupacao,
  useOrgsRisco,
  useValorNaoConsumido,
} from '@/features/organizacoes/queries'

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
        {Array.from({ length: 5 }, (_, i) => (
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

export function OrganizacoesPage() {
  const kpis = useOrgsKpis()
  const risco = useOrgsRisco()
  const efeito = useEfeitoMaster()
  const ocupacao = useOrgsOcupacao()
  const valor = useValorNaoConsumido()

  const comMaster = efeito.data?.find((e) => e.grupo.startsWith('Master ativo'))
  const semMaster = efeito.data?.find((e) => e.grupo.startsWith('Master parado'))
  const lift =
    comMaster?.pct_time_ativo && semMaster?.pct_time_ativo
      ? comMaster.pct_time_ativo / semMaster.pct_time_ativo
      : null

  return (
    <BentoGrid>
      <BentoItem span={12}>
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Organizações</h2>
          <p className="text-muted-foreground text-sm">
            Saúde dos times, efeito do master e valor contratado que não está sendo
            consumido · time ativo = membros com ação nos últimos 30 dias
          </p>
        </div>
      </BentoItem>

      <BentoItem span={12}>
        <KpiGrid>
          <KpiCard
            label="Organizações ativas"
            value={kpis.data?.orgs_ativas ?? 0}
            format={formatInt}
            isLoading={kpis.isLoading}
          />
          <KpiCard
            label="Membros em organizações"
            value={kpis.data?.membros_total ?? 0}
            format={formatInt}
            isLoading={kpis.isLoading}
          />
          <KpiCard
            label="Time ativo (média)"
            value={kpis.data?.pct_time_ativo_medio ?? 0}
            format={formatPercent}
            isLoading={kpis.isLoading}
          />
          <KpiCard
            label="Orgs com master ativo"
            value={kpis.data?.orgs_master_ativo ?? 0}
            format={formatPercent}
            isLoading={kpis.isLoading}
          />
        </KpiGrid>
      </BentoItem>

      <BentoItem span={6}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              O master engajado puxa o time?
            </CardTitle>
            <CardDescription>
              Organizações ativas com 2+ membros · master ativo = teve ação nos últimos
              30 dias
              {lift ? ` · times com master ativo são ${formatDecimal(lift)}× mais ativos` : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EstadoTabela isLoading={efeito.isLoading} isError={efeito.isError}>
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
                      <TableCell className="num text-right">{formatInt(e.orgs)}</TableCell>
                      <TableCell className="num text-right">{formatInt(e.membros)}</TableCell>
                      <TableCell className="num text-right font-medium">
                        {e.pct_time_ativo != null ? formatPercent(e.pct_time_ativo) : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </EstadoTabela>
          </CardContent>
        </Card>
      </BentoItem>

      <BentoItem span={6}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Valor contratado e não consumido
            </CardTitle>
            <CardDescription>
              Benefícios que a empresa entrega e o cliente não usa — churn silencioso e
              oportunidade de ativação por CS
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EstadoTabela isLoading={valor.isLoading} isError={valor.isError}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Benefício</TableHead>
                    <TableHead className="text-right">Disponível</TableHead>
                    <TableHead className="text-right">Usado</TableHead>
                    <TableHead className="text-right">% de uso</TableHead>
                    <TableHead className="text-right">Beneficiários</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(valor.data ?? []).map((v) => (
                    <TableRow key={v.item}>
                      <TableCell className="font-medium">{v.item}</TableCell>
                      <TableCell className="num text-right">{formatInt(v.disponivel)}</TableCell>
                      <TableCell className="num text-right">{formatInt(v.usado)}</TableCell>
                      <TableCell className="num text-right font-medium">
                        {v.pct_uso != null ? formatPercent(v.pct_uso) : '—'}
                      </TableCell>
                      <TableCell className="num text-right">
                        {formatInt(v.beneficiarios)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </EstadoTabela>
          </CardContent>
        </Card>
      </BentoItem>

      <BentoItem span={4}>
        <ChartCard
          title="Ocupação de assentos"
          description="Membros vs limite contratado · orgs lotadas são oportunidade de upsell; abaixo de 50%, risco de valor não percebido"
          isLoading={ocupacao.isLoading}
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

      <BentoItem span={8}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Organizações em risco — time parado
            </CardTitle>
            <CardDescription>
              Orgs ativas com 3+ membros, ordenadas pelo menor percentual de time ativo ·
              lista para ação de CS
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EstadoTabela isLoading={risco.isLoading} isError={risco.isError}>
              <TabelaLonga
                linhas={risco.data ?? []}
                chave={(r) => String(r.organizacao)}
                buscarEm={(r) => [r.organizacao]}
                rotuloBusca="Buscar por organização"
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
                    <TableCell className="num text-right">{formatInt(r.membros)}</TableCell>
                    <TableCell className="num text-right">{formatInt(r.ativos_30d)}</TableCell>
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
            </EstadoTabela>
          </CardContent>
        </Card>
      </BentoItem>
    </BentoGrid>
  )
}
