import { useQuery } from '@tanstack/react-query'

import type { LinhaBruta } from '@/components/tabela/celula-bruta'
import { rpc } from '@/lib/rpc'
import { supabase } from '@/lib/supabase'

/** Teto rígido do banco. A tela declara; ela não escolhe. */
export const LIMITE_POR_PAGINA = 100

export type ItemDoCatalogo = {
  tabela: string
  colunas_servidas: string[]
  /** o que existe na tabela e o catálogo não serve — declarado, não escondido */
  colunas_retidas: string[]
  linhas: number
}

export type PaginaBruta = {
  tabela: string
  colunas: string[]
  offset: number
  limite: number
  linhas: LinhaBruta[]
}

/**
 * O índice do Explorar.
 *
 * `staleTime: Infinity` porque o catálogo é **congelado por migration** — ele
 * não muda entre navegações, e revalidá-lo sugeriria o contrário.
 */
export function useCatalogo() {
  return useQuery({
    queryKey: ['explorar', 'catalogo'],
    staleTime: Infinity,
    queryFn: async () =>
      ((await rpc(supabase.rpc('bi_explorar_catalogo'))) ?? []) as ItemDoCatalogo[],
  })
}

/** Uma página de linhas cruas. `null` em `tabela` mantém a consulta parada. */
export function usePaginaBruta(tabela: string | null, offset: number) {
  return useQuery({
    queryKey: ['explorar', 'linhas', tabela, offset],
    enabled: tabela !== null,
    /*
      Segura a página anterior só quando a TABELA é a mesma — é paginação, e o
      caso mais forte de `keepPreviousData` no repositório.

      O `keepPreviousData` global não serviria aqui: a chave carrega duas
      coisas, e ao TROCAR de tabela ele manteria as linhas da anterior por um
      frame, com colunas diferentes. Cabeçalho novo sobre dado velho é pior que
      esqueleto — não parece carregamento, parece resultado.
    */
    placeholderData: (anterior, consultaAnterior) =>
      consultaAnterior?.queryKey[2] === tabela ? anterior : undefined,
    queryFn: async () =>
      (await rpc(
        supabase.rpc('bi_explorar', {
          p_tabela: tabela!,
          p_limite: LIMITE_POR_PAGINA,
          p_offset: offset,
        }),
      )) as unknown as PaginaBruta,
  })
}
