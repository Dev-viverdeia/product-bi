import { useSearchParams } from 'react-router'
import { ChevronLeftIcon, ChevronRightIcon, DatabaseIcon, EyeOffIcon } from 'lucide-react'

import { CabecalhoDeModulo } from '@/components/layout/cabecalho-de-modulo'
import { SecaoDeAnalise } from '@/components/layout/secao-de-analise'
import { CelulaBruta } from '@/components/tabela/celula-bruta'
import { TabelaCard } from '@/components/tabela/tabela-card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { formatInt } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  LIMITE_POR_PAGINA,
  useCatalogo,
  usePaginaBruta,
  type ItemDoCatalogo,
} from '@/features/explorar/queries'

const PARAM_TABELA = 'tabela'
const PARAM_PAGINA = 'p'

/** Uma tabela no índice. O que ela retém aparece, com o nome do campo. */
function ItemDoIndice({
  item,
  ativo,
  onEscolher,
}: {
  item: ItemDoCatalogo
  ativo: boolean
  onEscolher: () => void
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onEscolher}
        aria-current={ativo ? 'true' : undefined}
        className={cn(
          'focus-visible:ring-ring w-full rounded-md px-3 py-2 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none',
          ativo ? 'bg-controle' : 'hover:bg-controle/60',
        )}
      >
        <span className="block truncate font-mono text-xs">{item.tabela}</span>
        <span className="text-muted-foreground num mt-0.5 block text-xs">
          {formatInt(item.linhas)} linhas · {formatInt(item.colunas_servidas.length)} colunas
          {item.colunas_retidas.length > 0 ? (
            <span className="inline-flex items-center gap-1 pl-1">
              <EyeOffIcon aria-hidden className="size-3" />
              {item.colunas_retidas.join(', ')}
            </span>
          ) : null}
        </span>
      </button>
    </li>
  )
}

/**
 * Explorar — o dado bruto dos marts.
 *
 * A outra metade da camada de dados. A aba `Dados` de cada módulo mostra o que
 * aquela tela já leu; aqui se alcança o mart inteiro, inclusive o que nenhum
 * card consome.
 *
 * Quatro regras que não são estéticas:
 *
 * - **O catálogo é uma allowlist congelada por migration**, nos dois eixos:
 *   tabela nova não entra sozinha, coluna nova não passa a ser servida sozinha.
 *   Como não há papel de admin no BI (decisão do Mateus, 18/08), o controle
 *   desta camada é de ARMAZENAMENTO e não de acesso — o que não pode ser visto
 *   não é servido. A allowlist é a peça inteira, não um acabamento.
 * - **A retenção é declarada com o nome do campo.** `dim_usuario` mostra que
 *   retém `nome`, `email` e `organizacao`. Esconder a retenção faria o
 *   explorador concluir que a coluna não existe, e concluir errado sobre o
 *   schema é pior que saber que há um campo fora do alcance.
 * - **Chave e hash são servidos de propósito.** `user_id` e `*_hash` distinguem
 *   sem identificar, e é para isso que o contrato de PII manda usá-los.
 * - **Teto de linhas por página, imposto pelo banco.** A tela declara o teto;
 *   ela não o escolhe. Explorar é para conferir e recortar, não para exportar
 *   a base.
 */
export function ExplorarPage() {
  const [params, setParams] = useSearchParams()
  const tabela = params.get(PARAM_TABELA)
  const pagina = Math.max(0, Number(params.get(PARAM_PAGINA) ?? 0) || 0)

  const catalogo = useCatalogo()
  const dados = usePaginaBruta(tabela, pagina * LIMITE_POR_PAGINA)

  const itens = catalogo.data ?? []
  const item = itens.find((i) => i.tabela === tabela) ?? null
  const linhas = dados.data?.linhas ?? []
  const colunas = dados.data?.colunas ?? []

  function escolher(nome: string) {
    const proximos = new URLSearchParams(params)
    proximos.set(PARAM_TABELA, nome)
    proximos.delete(PARAM_PAGINA)
    setParams(proximos, { replace: true })
  }

  function irPara(destino: number) {
    const proximos = new URLSearchParams(params)
    if (destino <= 0) proximos.delete(PARAM_PAGINA)
    else proximos.set(PARAM_PAGINA, String(destino))
    setParams(proximos, { replace: true })
  }

  const totalDePaginas = item ? Math.ceil(item.linhas / LIMITE_POR_PAGINA) : 0

  return (
    <div className="space-y-4">
      <CabecalhoDeModulo />

      <SecaoDeAnalise
        titulo="O que está aberto para leitura crua"
        icone={DatabaseIcon}
        descricao="Allowlist congelada por migration, tabela e coluna. Chave e hash são servidos de propósito — distinguem sem identificar. O que é retido aparece com o nome do campo, porque esconder a retenção faria o leitor concluir que a coluna não existe."
      >
        <div className="grid gap-4 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
          <div className="bg-card border-border/60 rounded-lg border p-2 shadow-sm">
            {catalogo.isLoading ? (
              <div className="space-y-2 p-2">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : catalogo.isError ? (
              <p className="text-muted-foreground p-3 text-sm">
                Não foi possível carregar o catálogo.
              </p>
            ) : (
              <ul className="max-h-[70vh] space-y-0.5 overflow-y-auto">
                {itens.map((i) => (
                  <ItemDoIndice
                    key={i.tabela}
                    item={i}
                    ativo={i.tabela === tabela}
                    onEscolher={() => escolher(i.tabela)}
                  />
                ))}
              </ul>
            )}
          </div>

          <div className="min-w-0">
            {tabela === null ? (
              <div className="bg-card border-border/60 rounded-lg border p-6 shadow-sm">
                <p className="text-muted-foreground max-w-[68ch] text-[15px] leading-relaxed">
                  Escolha uma tabela no índice. São {formatInt(itens.length)} tabelas abertas,
                  com {formatInt(itens.reduce((soma, i) => soma + i.linhas, 0))} linhas somadas —
                  o arquivo que o BI guarda, incluindo o que nenhuma tela consome.
                </p>
              </div>
            ) : (
              <TabelaCard
                nivel="descritivo"
                icon={DatabaseIcon}
                title={tabela}
                headline={item ? formatInt(item.linhas) : '—'}
                headlineLabel="linhas na tabela"
                description={`marts.${tabela} · ${formatInt(colunas.length)} colunas servidas${
                  item && item.colunas_retidas.length > 0
                    ? ` · retidas: ${item.colunas_retidas.join(', ')}`
                    : ''
                } · até ${formatInt(LIMITE_POR_PAGINA)} linhas por página, teto imposto pelo banco`}
                isLoading={dados.isLoading}
                isError={dados.isError}
                onRetry={() => void dados.refetch()}
                linhasEsqueleto={8}
              >
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {colunas.map((c) => (
                          <TableHead key={c} className="font-mono text-xs whitespace-nowrap">
                            {c}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {linhas.map((linha, i) => (
                        <TableRow key={`${pagina}-${i}`}>
                          {colunas.map((c) => (
                            <CelulaBruta key={c} valor={linha[c]} />
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {totalDePaginas > 1 ? (
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <span className="text-muted-foreground num text-xs">
                      página {formatInt(pagina + 1)} de {formatInt(totalDePaginas)}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => irPara(pagina - 1)}
                        disabled={pagina === 0}
                      >
                        <ChevronLeftIcon aria-hidden className="size-4" />
                        Anterior
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => irPara(pagina + 1)}
                        disabled={pagina + 1 >= totalDePaginas}
                      >
                        Próxima
                        <ChevronRightIcon aria-hidden className="size-4" />
                      </Button>
                    </div>
                  </div>
                ) : null}
              </TabelaCard>
            )}
          </div>
        </div>
      </SecaoDeAnalise>
    </div>
  )
}
