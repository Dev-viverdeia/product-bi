import { useMemo } from 'react'
import { ListChecksIcon } from 'lucide-react'

import { moduloDaTela } from '@/components/layout/nav-items'
import { TabelaCard } from '@/components/tabela/tabela-card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatInt } from '@/lib/format'
import { useRegras } from '@/features/resumo/queries'

/**
 * O nome da tela sai de `nav-items.ts`, não de um mapa próprio.
 *
 * Havia aqui um objeto com duas entradas — `visao-geral` e `clientes` — de
 * quando o motor cobria só as duas telas piloto. As sete que entraram depois
 * apareciam com o slug cru no título do card ("formacoes", "ia", "jornada"),
 * e ninguém notou porque a página não quebra: ela só fica feia e desalinhada
 * do resto do app.
 *
 * A conversão slug→módulo subiu para `nav-items.ts` quando o plano de ação
 * passou a precisar dela: era a segunda cópia nascendo.
 */
function nomeDaTela(tela: string) {
  return moduloDaTela(tela)?.title ?? tela
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
    // Ferramenta interna, não módulo de produto: fica fora do `CabecalhoDeModulo`
    // de propósito. Ele carrega o `FrescorDoDado`, e carimbar "dados até tal dia"
    // num catálogo de perguntas diria que a régua é do dado quando ela é do
    // limiar — que vive na migration e não muda com a carga.
    <div className="space-y-4">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight md:text-[2.5rem] md:leading-[1.06]">
          Regras do resumo
        </h1>
        <p className="text-muted-foreground mt-3 max-w-[68ch] text-[15px] leading-relaxed">
          O que o bloco de direcionamento sabe perguntar · quando ele fica em silêncio, é porque
          nenhuma destas cruzou o limiar — não porque está tudo bem
        </p>
      </header>

      {porTela.map(([tela, lista]) => (
        <div key={tela}>
          <TabelaCard
            icon={ListChecksIcon}
            title={nomeDaTela(tela)}
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
        </div>
      ))}
    </div>
  )
}
