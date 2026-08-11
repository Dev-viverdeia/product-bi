import { useMemo } from 'react'
import { AlertTriangleIcon, ArmchairIcon, CrownIcon, PackageOpenIcon } from 'lucide-react'

import { CategoryBarChart, ChartCard, KpiCard, KpiGrid } from '@/components/charts'
import { BentoGrid, BentoItem } from '@/components/layout/bento'
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
import {
  useEfeitoMaster,
  useOrgsKpis,
  useOrgsOcupacao,
  useOrgsRisco,
  useValorNaoConsumido,
} from '@/features/organizacoes/queries'

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

  // O benefício mais desperdiçado é o que o card pede para agir.
  const maisDesperdicado = useMemo(() => {
    const itens = (valor.data ?? []).filter((v) => v.pct_uso != null)
    if (itens.length === 0) return null
    return itens.reduce((a, b) => ((b.pct_uso ?? 1) < (a.pct_uso ?? 1) ? b : a))
  }, [valor.data])

  // Faixa com mais organizações — onde a base de fato está.
  const faixaLotacao = useMemo(() => {
    const fs = ocupacao.data ?? []
    if (fs.length === 0) return null
    const maior = fs.reduce((a, b) => (b.orgs > a.orgs ? b : a))
    const total = fs.reduce((soma, o) => soma + o.orgs, 0)
    return total > 0 ? { faixa: maior.faixa, parte: maior.orgs / total } : null
  }, [ocupacao.data])

  // Lista de risco vem ordenada pela pior; nada de somar (pode vir cortada).
  const orgMaisParada = risco.data?.[0] ?? null

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
        <TabelaCard
          icon={CrownIcon}
          title="O master engajado puxa o time?"
          headline={lift ? `${formatDecimal(lift)}×` : '—'}
          headlineLabel="mais time ativo com master ativo"
          description="Organizações ativas com 2+ membros · master ativo = teve ação nos últimos 30 dias"
          isLoading={efeito.isLoading}
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
                  <TableCell className="num text-right">{formatInt(e.orgs)}</TableCell>
                  <TableCell className="num text-right">{formatInt(e.membros)}</TableCell>
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
          icon={PackageOpenIcon}
          title="Valor contratado e não consumido"
          headline={
            maisDesperdicado?.pct_uso != null ? formatPercent(maisDesperdicado.pct_uso) : '—'
          }
          headlineLabel={
            maisDesperdicado ? `de uso no mais parado (${maisDesperdicado.item})` : undefined
          }
          description="Benefícios que a empresa entrega e o cliente não usa — churn silencioso e oportunidade de ativação por CS"
          isLoading={valor.isLoading}
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
                <TableCell className="num text-right">{formatInt(v.disponivel)}</TableCell>
                <TableCell className="num text-right">{formatInt(v.usado)}</TableCell>
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

      <BentoItem span={4}>
        <ChartCard
          tone="brand"
          icon={ArmchairIcon}
          title="Ocupação de assentos"
          headline={faixaLotacao ? formatPercent(faixaLotacao.parte) : '—'}
          headlineLabel={faixaLotacao ? `das orgs em ${faixaLotacao.faixa}` : undefined}
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
        <TabelaCard
          icon={AlertTriangleIcon}
          title="Organizações em risco — time parado"
          headline={
            orgMaisParada?.pct_time_ativo != null
              ? formatPercent(orgMaisParada.pct_time_ativo)
              : '—'
          }
          headlineLabel={
            orgMaisParada ? `de time ativo na pior (${orgMaisParada.organizacao})` : undefined
          }
          description="Orgs ativas com 3+ membros, ordenadas pelo menor percentual de time ativo · lista para ação de CS"
          isLoading={risco.isLoading}
          isError={risco.isError}
          onRetry={() => void risco.refetch()}
        >
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
        </TabelaCard>
      </BentoItem>
    </BentoGrid>
  )
}
