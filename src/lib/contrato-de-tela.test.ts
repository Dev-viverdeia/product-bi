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

describe('valor de KPI nunca cai para zero', () => {
  /*
    `value={dados?.campo ?? 0}` publica "0" quando a consulta não trouxe o
    campo — e zero é indistinguível de "não carregou" e de "suprimido pela
    régua de amostra". Foi o defeito dos KPIs de CS, que anunciavam "0
    atendimentos" com as tabelas vazias. O KpiCard aceita `null` com
    `motivoSemValor` justamente para separar as três coisas.

    Zero de verdade continua passando: quando a linha existe e o campo vale 0,
    `?? null` devolve 0.
  */
  it('há página para verificar', () => {
    expect(paginas.length).toBeGreaterThan(5)
  })

  it.each(paginas)('$caminho', ({ fonte }) => {
    const ocorrencias = achatar(fonte).match(/value=\{[^}]*\?\?\s*0\s*[})]/g) ?? []
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
