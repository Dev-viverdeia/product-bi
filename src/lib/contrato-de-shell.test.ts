import { describe, expect, it } from 'vitest'

/**
 * Contratos do shell, verificados no fonte.
 *
 * Cobre uma classe de defeito que não tem função onde morar e que o
 * type-checker não vê: composição de componentes que se anulam em silêncio.
 */

const fontes = Object.entries(
  import.meta.glob('../components/**/*.tsx', {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>,
).map(([caminho, fonte]) => ({ caminho: caminho.replace('../', ''), fonte }))

/**
 * Remove comentário antes de casar.
 *
 * Sem isto o teste reprova justamente o arquivo mais bem documentado: o
 * comentário que EXPLICA a regra cita o nome que a regra proíbe. Já custou uma
 * rodada no `contrato-do-motor`, com `--` de SQL; aqui é a mesma armadilha em
 * JS.
 */
function semComentarios(fonte: string) {
  return fonte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
}

describe('contrato do shell', () => {
  /**
   * `asChild` do Radix usa `Slot`, que CONCATENA o className do gatilho com o do
   * filho. O `NavLink` do react-router aceita `className` como função para
   * receber `isActive` — e concatenar uma string com uma função produz a FONTE
   * da função, que vai parar no atributo `class` como texto.
   *
   * O resultado é mudo: nenhum erro, nenhum aviso, e o item ativo fica
   * indistinguível dos outros. Aconteceu no `AppRail` em 13/ago e só apareceu
   * quando a cor de fundo foi medida no navegador — a olho, doze discos cinza
   * parecem doze discos cinza.
   *
   * A saída é calcular o estado ativo com `useMatch` e passar `className` como
   * string, que é o que este teste exige.
   */
  it('não passa className de função para filho de gatilho asChild', () => {
    const suspeitos: string[] = []

    for (const { caminho, fonte } of fontes) {
      const linhas = semComentarios(fonte).split('\n')
      linhas.forEach((linha, i) => {
        if (!/\basChild\b/.test(linha)) return
        // o filho direto vem logo abaixo; 12 linhas cobrem props espalhadas
        // pelo formatador sem alcançar o próximo elemento irmão
        const janela = linhas.slice(i, i + 12).join('\n')
        if (/className=\{\s*\(/.test(janela)) {
          suspeitos.push(`${caminho}:${i + 1}`)
        }
      })
    }

    expect(suspeitos).toEqual([])
  })

  /**
   * A fileira de abas mora na barra do topo (`AbaCanal` + pílulas). O
   * `ModuloTabs` ficou só com o painel. Uma `TabsList` reintroduzida ali daria
   * duas fileiras de abas na mesma tela, cada uma com o próprio indicador — e
   * como as duas leem o mesmo `?aba=`, elas concordariam entre si e ninguém
   * suspeitaria de defeito: pareceria decisão de layout.
   */
  it('ModuloTabs não desenha a própria fileira de abas', () => {
    const moduloTabs = fontes.find((f) => f.caminho.endsWith('modulo-tabs.tsx'))
    expect(moduloTabs, 'modulo-tabs.tsx não encontrado').toBeDefined()
    expect(semComentarios(moduloTabs!.fonte)).not.toMatch(/TabsList/)
  })
})

/**
 * O padrão de três abas, que passou a valer em todo módulo em 18/ago.
 *
 * `Gráficos` (o dado) · `Análise` (a leitura) · `Plano` (a sugestão), nesta
 * ordem. Antes cada tela declarava as próprias abas por pergunta, e o custo
 * disso era invisível: o leitor reaprendia a navegação em cada módulo.
 *
 * ⚠️ **A trava que mais importa aqui é a do valor `graficos`.** As 35 regras do
 * motor gravam `insights.regra.ancora_aba = 'graficos'`, e é por esse texto que
 * o link "ver o gráfico que sustenta" navega. Renomear o valor da aba no
 * `nav-items.ts` quebraria os 35 links **em silêncio** — o link trocaria de aba
 * e não rolaria para nada, sem erro, sem aviso, sem teste falhando. Até hoje a
 * única proteção era uma frase no CLAUDE.md, que não reprova build nenhum.
 */
describe('padrão de três abas em todo módulo', () => {
  // glob próprio: o `fontes` acima cobre só `.tsx`, e nav-items é `.ts`
  const navItems = Object.values(
    import.meta.glob('../components/layout/nav-items.ts', {
      query: '?raw',
      import: 'default',
      eager: true,
    }) as Record<string, string>,
  )[0]!

  /** Blocos `abas: [...]` declarados no arquivo. */
  const blocos = semComentarios(navItems).match(/abas:\s*\[[^\]]*\]/g) ?? []

  it('há módulo com aba declarada', () => {
    expect(blocos.length).toBeGreaterThan(5)
  })

  it.each(blocos.map((bloco, i) => ({ i, bloco })))('módulo %i', ({ bloco }) => {
    const valores = [...bloco.matchAll(/valor:\s*'([a-z-]+)'/g)].map((m) => m[1])
    expect(valores).toEqual(['graficos', 'analise', 'plano'])
  })

  /*
    A ordem é a da leitura — dado, depois significado, depois ação — e a
    primeira aba é a padrão, porque `useAbaAtiva` cai em `abas[0]` quando a URL
    não traz `?aba=`. Trocar a ordem aqui troca a tela que o leitor vê primeiro.
  */
  it('graficos é a primeira, e portanto a padrão', () => {
    for (const bloco of blocos) {
      const primeiro = bloco.match(/valor:\s*'([a-z-]+)'/)?.[1]
      expect(primeiro).toBe('graficos')
    }
  })
})
