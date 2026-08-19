import type { Achado } from '@/features/resumo/queries'

/** Teto de achados na leitura. Acima disso vira lista e ninguém lê até o fim. */
export const MAXIMO_DE_ACHADOS = 3

/**
 * Seleção de achados: no máximo três, no máximo um por família.
 *
 * Sem o corte por família a leitura diz "retenção" três vezes com palavras
 * diferentes. A ordem já vem do banco, por múltiplo do próprio limiar de cada
 * regra — é o que torna comparáveis regras de unidades diferentes.
 *
 * ⚠️ **Vive em módulo próprio porque as duas abas TÊM de usar a mesma.** A
 * função nasceu dentro de `AnaliseDaTela` e o `PlanoDaTela` filtrava só por
 * `!suprimida`, sem teto e sem corte por família. Em Clientes isso dava 3
 * achados na aba `Análise` e 6 sugestões na aba `Plano` — a mesma RPC, o mesmo
 * cache, e dois conjuntos diferentes nas duas abas da mesma tela.
 *
 * O custo não era estético: a aba `Plano` propunha AÇÃO cujo FATO não aparecia
 * na aba ao lado. É a mesma família de defeito que o motor tem contrato de CI
 * para impedir do lado do banco — número que não existe em lugar nenhum da
 * tela —, entrando pela porta da composição.
 *
 * E o `PlanoDaTela` afirmava por escrito, no próprio aparato, que lia "o mesmo
 * achado que a aba Análise, com a mesma régua". A tela dizia de si algo falso.
 */
export function selecionar(achados: Achado[]) {
  const candidatos = achados.filter((a) => !a.suprimida)
  const visiveis: Achado[] = []
  for (const achado of candidatos) {
    if (visiveis.length >= MAXIMO_DE_ACHADOS) break
    if (visiveis.some((v) => v.familia === achado.familia)) continue
    visiveis.push(achado)
  }
  return {
    visiveis,
    suprimidos: achados.filter((a) => a.suprimida),
    abaixoDoCorte: candidatos.length - visiveis.length,
    avaliadas: achados.length,
  }
}
