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
 * ⚠️ **A trava que mais importa aqui é a do valor `graficos`.** Todas as regras do
 * motor gravam `insights.regra.ancora_aba = 'graficos'`, e é por esse texto que
 * o link "ver o gráfico que sustenta" navega. Renomear o valor da aba no
 * `nav-items.ts` quebraria todos eles **em silêncio** — o link trocaria de aba
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

  /**
   * Cada item da navegação, com a rota e as abas que ele declara.
   *
   * A varredura é por ITEM e não por bloco `abas:` solto, porque a régua das
   * três abas é dos MÓDULOS. As seções de topo (`/plano`, `/explorar`)
   * atravessam os módulos e não têm um domínio para fatiar em dado, leitura e
   * ação — a tela inteira já é uma das três camadas. Elas se declaram em
   * `ROTAS_TRANSVERSAIS`, e é essa lista que este teste respeita.
   */
  const itens = [...semComentarios(navItems).matchAll(/to: '([^']+)'/g)].map((m, i, todos) => {
    const fim = todos[i + 1]?.index ?? semComentarios(navItems).length
    const corpo = semComentarios(navItems).slice(m.index, fim)
    return {
      rota: m[1]!,
      abas: [...corpo.matchAll(/valor:\s*'([a-z-]+)'/g)].map((a) => a[1]!),
    }
  })

  const transversais = [...semComentarios(navItems).matchAll(/ROTAS_TRANSVERSAIS = \[([^\]]*)\]/g)]
    .flatMap((m) => [...m[1]!.matchAll(/'([^']+)'/g)].map((r) => r[1]!))

  const modulos = itens.filter((i) => i.abas.length > 0 && !transversais.includes(i.rota))

  it('há módulo com aba declarada, e transversal declarada', () => {
    expect(modulos.length).toBeGreaterThan(5)
    expect(transversais.length).toBeGreaterThan(0)
  })

  /*
    ⚠️ A trava que mais importa aqui é a do valor `graficos`. Todas as regras do
    motor gravam `insights.regra.ancora_aba = 'graficos'`, e é por esse texto que
    o link "ver o gráfico que sustenta" navega. Renomear o valor da aba no
    `nav-items.ts` quebraria todos eles **em silêncio** — o link trocaria de aba
    e não rolaria para nada, sem erro, sem aviso, sem teste falhando. Até 18/ago
    a única proteção era uma frase no CLAUDE.md, que não reprova build nenhum.

    A ordem também é contrato: `useAbaAtiva` cai em `abas[0]` quando a URL não
    traz `?aba=`, então a primeira aba é a que o leitor vê primeiro.
  */
  it.each(modulos)('$rota', ({ abas }) => {
    expect(abas).toEqual(['graficos', 'analise', 'plano'])
  })
})

describe('rail de navegação', () => {
  const rail = fontes.find((f) => f.caminho.endsWith('app-rail.tsx'))

  it('o arquivo existe', () => {
    expect(rail, 'app-rail.tsx não encontrado').toBeDefined()
  })

  /**
   * ⚠️ O rótulo do rail é decisão do CEO (19/ago) e reverte o rail só de ícone
   * que valia desde 13/ago.
   *
   * Esta trava existe porque a decisão anterior estava ESCRITA no CLAUDE.md como
   * "não reintroduzir sidebar com rótulo" — ou seja, a documentação empurrava
   * ativamente na direção contrária. Sem um teste, a próxima sessão que lesse
   * aquela linha desfaria isto de boa-fé e ninguém notaria até o CEO abrir a
   * tela de novo.
   *
   * O tooltip era o rótulo enquanto não havia rótulo; com o nome visível ele
   * vira ruído, então a ausência dele também entra no contrato.
   *
   * ⚠️ **A primeira versão deste teste passava com um rail só de ícone.** Ela
   * exigia apenas `{item.title}` no fonte, e `aria-label={item.title}` ou um
   * `<span className="sr-only">{item.title}</span>` casam com isso — os dois são
   * o idioma normal de nav de ícone, e nenhum desenha rótulo. Pior: a própria
   * asserção que proíbe `Tooltip` EMPURRA para lá, porque quem reverte lê "sem
   * tooltip" e nomeia o ícone do jeito acessível. Por isso o rótulo só
   * acessível está barrado explicitamente, e a largura antiga junto: as duas
   * fecham as saídas que sobravam.
   */
  it('desenha o nome do módulo, não só o ícone', () => {
    const fonte = semComentarios(rail!.fonte)
    expect(fonte, 'o rail precisa renderizar item.title').toMatch(/\{item\.title\}/)
    expect(fonte, 'rótulo VISÍVEL, não só acessível').not.toMatch(
      /sr-only|aria-label=\{\s*item\.title\s*\}/,
    )
    expect(fonte, 'w-[68px] era o rail só de ícone').not.toMatch(/w-\[68px\]/)
    expect(fonte, 'tooltip repetindo rótulo visível é ruído').not.toMatch(/Tooltip/)
  })

  /**
   * ⚠️ `first:` casa com `:first-child`, então num elemento que é SEMPRE o
   * primeiro filho do próprio contêiner ele é sempre-verdadeiro.
   *
   * O separador de grupos nasceu assim: `<span className="h-3 first:hidden" />`
   * como primeiro filho da div de cada grupo. Resultado: escondido em todos os
   * grupos, sempre, de 13 a 19/ago — enquanto o código e o `nav-items.ts`
   * afirmavam que o agrupamento era "a única pista de arquitetura que o rail
   * dá". A pista nunca foi desenhada, e nada falhou.
   *
   * A variante precisa morar no elemento que SE REPETE (a div do grupo), não no
   * que ele envolve.
   */
  it('não esconde o separador de grupo com first: num filho fixo', () => {
    expect(semComentarios(rail!.fonte)).not.toMatch(/first:hidden/)
  })
})
