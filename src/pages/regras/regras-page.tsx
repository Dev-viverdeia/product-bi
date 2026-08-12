import { useMemo } from 'react'
import { ListChecksIcon } from 'lucide-react'

import { BentoCabecalho, BentoGrid, BentoItem } from '@/components/layout/bento'
import { TabelaCard } from '@/components/tabela/tabela-card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatInt } from '@/lib/format'
import { useRegras } from '@/features/resumo/queries'

const NOME_DA_TELA: Record<string, string> = {
  'visao-geral': 'Visão geral',
  clientes: 'Clientes & Retenção',
}

/**
 * O catálogo do motor de achados, aberto.
 *
 * Existe porque o bloco de resumo faz uma afirmação forte quando fica em
 * silêncio — "nada fora do padrão" — e um motor de catálogo não tem lastro para
 * dizer que está tudo bem: ele só sabe o que alguém previu. Esta página é o
 * "alguém previu": mostra exatamente quais perguntas são feitas, com que
 * limiar, e qual frase sai quando a resposta é sim.
 */
export function RegrasPage() {
  const regras = useRegras()

  const lista = regras.data
  const porTela = useMemo(() => {
    const grupos = new Map<string, NonNullable<typeof lista>>()
    for (const regra of lista ?? []) {
      grupos.set(regra.tela, [...(grupos.get(regra.tela) ?? []), regra])
    }
    return [...grupos.entries()]
  }, [lista])

  return (
    <BentoGrid>
      <BentoCabecalho>
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Regras do resumo</h2>
          <p className="text-muted-foreground text-sm">
            O que o bloco de direcionamento sabe perguntar · quando ele fica em silêncio, é
            porque nenhuma destas cruzou o limiar — não porque está tudo bem
          </p>
        </div>
      </BentoCabecalho>

      {porTela.map(([tela, lista]) => (
        <BentoItem key={tela} span={12}>
          <TabelaCard
            icon={ListChecksIcon}
            title={NOME_DA_TELA[tela] ?? tela}
            headline={lista ? formatInt(lista.length) : '—'}
            headlineLabel="perguntas avaliadas a cada carga"
            description="O limiar de cada regra vive na migration, não em tela editável: o ciclo lento é o recurso, porque impede afrouxar a régua na semana em que o bloco ficou vazio."
            isLoading={regras.isLoading}
            isError={regras.isError}
            onRetry={() => void regras.refetch()}
            linhasEsqueleto={4}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pergunta</TableHead>
                  <TableHead>Família</TableHead>
                  <TableHead>Quando vira achado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(lista ?? []).map((regra) => (
                  <TableRow key={regra.id}>
                    <TableCell>
                      <div className="font-medium">{regra.pergunta}</div>
                      <div className="text-muted-foreground text-xs">{regra.titulo}</div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">{regra.familia}</TableCell>
                    <TableCell className="text-muted-foreground max-w-96 text-xs">
                      {regra.limiar_descricao}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabelaCard>
        </BentoItem>
      ))}
    </BentoGrid>
  )
}
