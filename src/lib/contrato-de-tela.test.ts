import { describe, expect, it } from 'vitest'

/**
 * Contratos que valem para a tela inteira, verificados no fonte.
 *
 * Os outros testes cobrem função pura. Estes cobrem uma classe de defeito que
 * não tem função onde morar: a régua da casa é "não mostrar número errado", e
 * as duas formas de quebrá-la que já aconteceram aqui são invisíveis para o
 * type-checker — um fallback que transforma falha em zero, e um percentual
 * calculado no front a partir de contagens que o banco nunca suprime.
 *
 * O fonte entra por `import.meta.glob` em vez de `node:fs` de propósito: isto é
 * um app de navegador, e ler arquivo pelo Vite evita arrastar os tipos do Node
 * para dentro do type-check da aplicação.
 */

const paginas = Object.entries(
  import.meta.glob('../features/**/*-page.tsx', {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>,
).map(([caminho, fonte]) => ({
  caminho: caminho.replace('../', ''),
  fonte,
}))

/** Achata quebras de linha para casar props que o formatador espalhou. */
function achatar(fonte: string) {
  return fonte.replace(/\s+/g, ' ')
}

describe('valor nunca cai para zero', () => {
  /*
    `value={dados?.campo ?? 0}` publica "0" quando a consulta não trouxe o
    campo — e zero é indistinguível de "não carregou" e de "suprimido pela
    régua de amostra". Foi o defeito dos KPIs de CS, que anunciavam "0
    atendimentos" com as tabelas vazias. O KpiCard aceita `null` com
    `motivoSemValor` justamente para separar as três coisas.

    Zero de verdade continua passando: quando a linha existe e o campo vale 0,
    `?? null` devolve 0.

    ⚠️ AS DUAS FORMAS, e a segunda é a que passou despercebida. A régua nasceu
    casando só `value={… ?? 0}`, a forma de PROP JSX — e a coerção que estava no
    produto era `value: … ?? 0`, a forma de CHAVE DE OBJETO, dentro do `.map`
    que monta o `data` do gráfico. Cinco páginas escreviam assim, o teste ficou
    verde por acidente, e Formações publicou uma coluna de "0,0%" num card de
    destaque cuja própria descrição negava o precipício. É o mesmo modo de
    falha que o `contrato-do-motor` já teve: régua que casa uma grafia e não a
    classe de defeito.

    Aqui o par não é retórico — a barra suprimida é `value: null` +
    `motivoSemValor` no `CategoryDatum`, exatamente como no `KpiCard`.
  */
  it('há página para verificar', () => {
    expect(paginas.length).toBeGreaterThan(5)
  })

  it.each(paginas)('$caminho', ({ fonte }) => {
    const chato = achatar(fonte)
    const ocorrencias = [
      ...(chato.match(/value=\{[^}]*\?\?\s*0\s*[})]/g) ?? []),
      ...(chato.match(/value:\s*[^,}]*\?\?\s*0\s*[,}]/g) ?? []),
    ]
    expect(ocorrencias).toEqual([])
  })
})

/*
  Telas em que a régua de "percentual sai do banco" já vale.

  Percentual derivado de contagem no cliente escapa da supressão, porque
  contagem nunca é suprimida — num recorte estreito a tela imprime fatia sobre
  denominador abaixo do mínimo. E foi assim que o headline de frequência
  publicou 37,2% onde a resposta é 57,8%: o corte por prefixo de rótulo comeu
  um balde inteiro.

  O risco só existe onde há recorte que estreita a base, e hoje o
  `SegmentoFiltro` está em duas telas. As outras sete somam sobre a base
  inteira, então a fatia é honesta enquanto o filtro não chegar nelas — e
  entram nesta lista na fase que trouxer o recorte, junto com a migração dos
  cálculos para o banco. Lista curta de propósito: cada nome que entra aqui é
  uma tela que já passou pela migração.
*/
const TELAS_COM_RECORTE = [
  'features/clientes/clientes-page.tsx',
  'features/visao-geral/visao-geral-page.tsx',
]

// Esta régua já se pagou duas vezes: pegou o defeito de 20 pontos da Fase 0 e,
// na Fase 2, pegou dois percentuais que eu mesmo tinha acabado de escrever no
// front da Visão Geral. Os dois foram para o banco.

describe('headline não afirma número antes de ter o dado', () => {
  /*
    `headline={formatInt(x)}` imprime "0" enquanto a consulta corre e quando ela
    falha — e o headline é o corpo 30px, o primeiro lugar onde o olho pousa.

    É o mesmo defeito de `value={… ?? 0}` que a régua acima pega, entrando pela
    porta do lado: o formatador SEMPRE devolve string, então zero derivado de
    `[].reduce(…)` vira um número afirmado com cara de medido.

    O pior dos quatro sites era "0 rastreios quebrados, com prova" na Visão
    Geral — um "está tudo bem" dito antes de saber, no card que existe
    justamente para provar os outros.

    Passa quem guarda: `headline={q.data ? formatInt(x) : '—'}`. O travessão é
    a mesma gramática de "não há valor" que o KpiCard e o CategoryBarChart usam.
  */
  it('há página para verificar', () => {
    expect(paginas.length).toBeGreaterThan(5)
  })

  it.each(paginas)('$caminho', ({ fonte }) => {
    const ocorrencias = achatar(fonte).match(/headline=\{format[A-Za-z]+\(/g) ?? []
    expect(ocorrencias).toEqual([])
  })
})

describe('percentual não é calculado no front', () => {
  const sobRegra = paginas.filter((p) => TELAS_COM_RECORTE.includes(p.caminho))

  it('a lista de telas sob a régua bate com o disco', () => {
    expect(sobRegra.map((p) => p.caminho).sort()).toEqual([...TELAS_COM_RECORTE].sort())
  })

  it.each(sobRegra)('$caminho', ({ fonte }) => {
    const plano = achatar(fonte)
    const somaTotal = /const total = [^;]*\.reduce\(/.test(plano)
    const dividePorTotal = /\/\s*total\b/.test(plano)
    expect(somaTotal && dividePorTotal).toBe(false)
  })
})

describe('headline não conta uma lista que ainda não chegou', () => {
  /*
    `headline={formatInt((x.data ?? []).length)}` publica "0" enquanto a
    consulta está no ar — e "0 formações com aluno no período" é uma afirmação
    falsa com cara de resultado, não um estado de carregamento. O esqueleto do
    card cobre o corpo, não o headline.

    É o mesmo defeito do `?? 0` do KPI, com outra roupa: o fallback vazio existe
    para a lista renderizar sem quebrar, e acaba virando número na tela. A forma
    certa separa as duas coisas — `x.data ? formatInt(x.data.length) : '—'`.

    Encontrado pela sonda de navegador em quatro cards de uma vez (Formações,
    Soluções, Clientes e o catálogo de regras) depois de a espera da sonda ser
    corrigida para olhar o headline.
  */
  it.each(paginas)('$caminho', ({ fonte }) => {
    expect(achatar(fonte)).not.toMatch(/headline=\{[^}]*\?\?\s*\[\]\)\.length/)
  })
})

describe('filho direto de SecaoDeAnalise é sempre BentoItem', () => {
  /*
    `SecaoDeAnalise` renderiza os filhos DENTRO de um `BentoGrid`, que é
    `grid-cols-1 md:grid-cols-6 xl:grid-cols-12`. Um `<div>` cru ali não é
    largura nenhuma: ele vira item de UMA coluna a partir de `md` — a página
    inteira espremida numa tira de 1/12 no desktop.

    O modo de falha é o pior possível: **no celular passa**, porque o grid é de
    uma coluna só. Quem revisa em tela estreita não vê nada de errado, e o
    type-checker menos ainda. Aconteceu em 18/ago nas duas telas novas
    (`/plano` e `/explorar`), montadas sem verificação de navegador, e só
    apareceu quando alguém abriu no desktop.

    A saída é `<BentoItem span={12}>` quando o bloco ocupa a seção inteira — ou
    não usar `SecaoDeAnalise`, que é o que as duas telas fizeram no fim: elas
    são documento e ferramenta, não mosaico de cards.
  */
  const comSecao = paginas.filter((p) => p.fonte.includes('<SecaoDeAnalise'))

  it('há tela com seção para verificar', () => {
    expect(comSecao.length).toBeGreaterThan(5)
  })

  it.each(comSecao)('$caminho', ({ fonte }) => {
    const plano = achatar(fonte)
    const forasteiros: string[] = []

    for (const abertura of plano.matchAll(/<SecaoDeAnalise\b/g)) {
      // pula o resto da tag de abertura e olha o primeiro elemento do corpo
      const depois = plano.slice(abertura.index)
      const fimDaTag = depois.indexOf('>')
      if (fimDaTag === -1) continue
      const primeiro = /<([A-Za-z][\w.]*)/.exec(depois.slice(fimDaTag + 1, fimDaTag + 400))
      if (primeiro && primeiro[1] !== 'BentoItem') forasteiros.push(primeiro[1]!)
    }

    expect(forasteiros).toEqual([])
  })
})
