import { NIVEIS, type NivelDeAnalise } from '@/lib/escada'

/**
 * A régua de densidade — irmã da escada, e com a pergunta invertida.
 *
 * A escada responde **"esta tela é rasa?"** e só tem mínimos para os degraus
 * altos. Esta responde **"esta tela é lida?"**.
 *
 * Ela existe porque o produto tem uma catraca de mão única, e isso foi medido:
 * contando cards de conteúdo em cada commit de cada página desde o primeiro,
 * **em 130 commits a contagem caiu UMA vez**, e nove das dez telas nunca
 * perderam um card. Cada fase somou; nenhuma teve a pergunta "o que sai?". A
 * própria `REGUA` da escada empurra no mesmo sentido — mínimos que sobem, teto
 * para um só dos quatro degraus e nenhum teto de total. Um produto que só
 * acumula fica poluído por construção, não por descuido.
 *
 * Por isso a peça tem DUAS metades:
 *
 * - `REGUA_DE_DENSIDADE`, limites absolutos, cobrando das telas que já foram
 *   refeitas (`TELAS_NA_DENSIDADE`);
 * - `TETO_POR_TELA`, uma catraca ao contrário: o placar de hoje vira teto para
 *   TODAS as dez. Baixar é de graça; subir exige editar este arquivo e escrever
 *   por quê. É o que impede a lista de crescer em silêncio de novo enquanto as
 *   telas esperam a vez de entrar na régua absoluta.
 */

/** As dez telas de produto. `/plano`, `/explorar`, `/regras` e `/design` não são módulos. */
export const TELAS_DE_PRODUTO = [
  'features/visao-geral/visao-geral-page.tsx',
  'features/clientes/clientes-page.tsx',
  'features/entrada/entrada-page.tsx',
  'features/formacoes/formacoes-page.tsx',
  'features/solucoes/solucoes-page.tsx',
  'features/ia/ia-page.tsx',
  'features/organizacoes/organizacoes-page.tsx',
  'features/jornada/jornada-page.tsx',
  'features/receita/receita-page.tsx',
  'features/cs/cs-page.tsx',
] as const

/**
 * Cada número saiu de medição, não de convenção.
 *
 * - **9 cards** — toda tela com ≤8 recebeu do próprio auditor um veredito de que
 *   a análise está limpa; as duas com ≥10 (clientes 10, CS 12) são as duas em
 *   que os auditores acharam desordem estrutural. É o primeiro inteiro acima da
 *   maior tela que ninguém reprovou.
 * - **2 cards por seção** — `SecaoDeAnalise` existe para dizer "estes três
 *   respondem a mesma coisa". Doze das 43 seções têm um card só: um card com um
 *   segundo título e mais um parágrafo cinza por cima. Dois é o menor grupo que
 *   existe.
 * - **5 seções** — distribuição medida: 3, 3, 3, 4, 4, 4, 5, 5, 6, 6. As duas
 *   com 6 (clientes, CS) são exatamente as duas cujos auditores propuseram
 *   fundir seções.
 * - **piso de 1 descritivo** — é a trava da catraca no sentido contrário.
 *   Somadas, as dez auditorias levariam o produto de 19 descritivos para ~11, e
 *   organizações a ZERO, sem nenhum teste reclamar. Tela sem descritivo não tem
 *   denominador visível fora do KPI, e "denominador ausente" foi a queixa mais
 *   repetida das dez auditorias.
 * - **240 caracteres de prosa de seção** — 3 linhas a 80ch. O CLAUDE.md já rege
 *   a descrição de *card* em "uma ou duas linhas"; a seção ganha uma linha a
 *   mais e nada além. Medido hoje: 43 descrições, 12.430 caracteres, média 289,
 *   máxima 460 — e **34 das 43 excedem**.
 */
export const REGUA_DE_DENSIDADE = {
  cardsDeConteudoNoMaximo: 9,
  cardsPorSecaoNoMinimo: 2,
  secoesNoMaximo: 5,
  descritivosNoMinimo: 1,
  prosaDeSecaoNoMaximo: 240,
} as const

/**
 * As duas regras de ORDEM, que são o que o CEO perguntou em segundo lugar
 * ("está na ordem de mais importante em cima e menos importante embaixo?").
 *
 * A resposta medida era não, e a causa é banal — o que a torna corrigível:
 * `escada.ts` declara `NIVEIS` em ordem ascendente e a `REGUA` se lê como lista
 * de cima para baixo. Quem monta uma tela para satisfazer aquela lista monta na
 * ordem da lista. **Uma regra de COMPOSIÇÃO virou, em silêncio, uma regra de
 * SEQUÊNCIA.** Ninguém decidiu terminar toda tela com a ação; isso caiu da
 * ordem de um array.
 *
 * O que a régua garante não é uma ordem única — é que a ordem tenha sido
 * ESCOLHIDA. Daí a exceção declarada valer tanto quanto o cumprimento.
 */
export const REGRAS_DE_ORDEM = {
  /** A primeira seção da aba `Gráficos` não pode ser só descritiva. */
  primeiraSecaoNaoSoDescritiva: 'a primeira seção só descreve — abre pelo "quanto"',
  /** A última seção não pode ser a única que contém o prescritivo. */
  prescritivoNaoSoNoFim: 'o único prescritivo está na última seção — a ação fecha a tela',
} as const

export type RegraDeDensidade = keyof typeof REGUA_DE_DENSIDADE | keyof typeof REGRAS_DE_ORDEM

/** O que se mede numa tela. Tudo sai do fonte; nada aqui é julgamento. */
export type MedidaDeTela = {
  /** ChartCard + TabelaCard da página (os da `AbaDeDados` não contam: moram no kit) */
  cards: number
  /** cards de cada seção, em ordem de documento */
  cardsPorSecao: number[]
  /** caracteres de cada `descricao` de seção */
  prosaPorSecao: number[]
  /** maior nível declarado em cada seção (índice em `NIVEIS`), -1 se nenhuma declara */
  picoPorSecao: number[]
  descritivos: number
  /** `<TableHead>` da página inteira — o eixo de "números impressos" */
  colunas: number
}

/**
 * Exceção declarada, no padrão que o banco já usa em `comment on function`.
 *
 * Vive no fonte da PÁGINA, não aqui, para o motivo ficar onde está quem lê a
 * tela. O teste procura por `DENSIDADE_DECLARADA:` seguido dos nomes das regras
 * dispensadas e de um travessão com o porquê — **sem motivo escrito, a exceção
 * não vale**, senão ela vira um jeito silencioso de desligar a régua.
 */
export const MARCA_DE_EXCECAO = 'DENSIDADE_DECLARADA:'

export function excecoesDeclaradas(fonte: string): { regras: string[]; motivo: string }[] {
  const achados: { regras: string[]; motivo: string }[] = []
  for (const linha of fonte.split(MARCA_DE_EXCECAO).slice(1)) {
    // o bloco vai até o fecho do comentário; o motivo é o que vem após o travessão
    const bloco = linha.split('*/')[0] ?? ''
    const [antes, ...resto] = bloco.split('—')
    achados.push({
      regras: (antes ?? '')
        .split(/[,\s]+/)
        .map((r) => r.trim())
        .filter(Boolean),
      motivo: resto.join('—').replace(/\s*\*\s*/g, ' ').trim(),
    })
  }
  return achados
}

export function avaliarDensidade(m: MedidaDeTela, fonte = ''): string[] {
  const dispensadas = new Set(
    excecoesDeclaradas(fonte)
      .filter((e) => e.motivo.length > 0)
      .flatMap((e) => e.regras),
  )
  const falhas: string[] = []
  const cobra = (regra: RegraDeDensidade, condicao: boolean, texto: string) => {
    if (condicao && !dispensadas.has(regra)) falhas.push(`${regra}: ${texto}`)
  }

  cobra(
    'cardsDeConteudoNoMaximo',
    m.cards > REGUA_DE_DENSIDADE.cardsDeConteudoNoMaximo,
    `${m.cards} cards (teto ${REGUA_DE_DENSIDADE.cardsDeConteudoNoMaximo})`,
  )
  cobra(
    'secoesNoMaximo',
    m.cardsPorSecao.length > REGUA_DE_DENSIDADE.secoesNoMaximo,
    `${m.cardsPorSecao.length} seções (teto ${REGUA_DE_DENSIDADE.secoesNoMaximo})`,
  )
  const orfas = m.cardsPorSecao.filter((c) => c < REGUA_DE_DENSIDADE.cardsPorSecaoNoMinimo).length
  cobra('cardsPorSecaoNoMinimo', orfas > 0, `${orfas} seção(ões) com um card só`)
  cobra(
    'descritivosNoMinimo',
    m.descritivos < REGUA_DE_DENSIDADE.descritivosNoMinimo,
    `${m.descritivos} descritivos — nenhum denominador visível fora do KPI`,
  )
  const longas = m.prosaPorSecao.filter((p) => p > REGUA_DE_DENSIDADE.prosaDeSecaoNoMaximo)
  cobra(
    'prosaDeSecaoNoMaximo',
    longas.length > 0,
    `${longas.length} descrição(ões) acima de ${REGUA_DE_DENSIDADE.prosaDeSecaoNoMaximo} caracteres (maior: ${Math.max(0, ...longas)})`,
  )

  const descritivo = NIVEIS.indexOf('descritivo' as NivelDeAnalise)
  const prescritivo = NIVEIS.indexOf('prescritivo' as NivelDeAnalise)
  cobra(
    'primeiraSecaoNaoSoDescritiva',
    m.picoPorSecao[0] === descritivo,
    REGRAS_DE_ORDEM.primeiraSecaoNaoSoDescritiva,
  )
  const comPrescritivo = m.picoPorSecao.flatMap((p, i) => (p === prescritivo ? [i] : []))
  cobra(
    'prescritivoNaoSoNoFim',
    comPrescritivo.length === 1 && comPrescritivo[0] === m.picoPorSecao.length - 1,
    REGRAS_DE_ORDEM.prescritivoNaoSoNoFim,
  )

  return falhas
}

/**
 * A catraca ao contrário: o placar de hoje é teto para as dez telas.
 *
 * Não é a régua absoluta — é a garantia de que a lista PARA de crescer sozinha
 * enquanto cada tela espera a vez de ser refeita. Baixar um número aqui é de
 * graça e não precisa de justificativa. **Subir exige editar este arquivo e
 * escrever por quê**, que é exatamente a pergunta que nenhuma das fases
 * anteriores fez.
 *
 * `colunas` conta `<TableHead>` e existe porque os dois eixos apontam telas
 * OPOSTAS: por cards, CS (12) e clientes (10) são as piores e soluções (7) está
 * limpa; por números impressos, **soluções é a pior do produto com 30 colunas**
 * — quatro vezes a visão geral — e CS é a terceira melhor. Uma tela com poucos
 * cards e tabelas largas parece limpa em toda régua que conta blocos, e é
 * exatamente o tipo de tela que o leitor descreve como poluída.
 */
export const TETO_POR_TELA: Record<string, { cards: number; colunas: number }> = {
  'features/visao-geral/visao-geral-page.tsx': { cards: 7, colunas: 5 },
  'features/clientes/clientes-page.tsx': { cards: 10, colunas: 17 },
  'features/entrada/entrada-page.tsx': { cards: 8, colunas: 17 },
  'features/formacoes/formacoes-page.tsx': { cards: 8, colunas: 23 },
  'features/solucoes/solucoes-page.tsx': { cards: 7, colunas: 30 },
  'features/ia/ia-page.tsx': { cards: 8, colunas: 17 },
  'features/organizacoes/organizacoes-page.tsx': { cards: 7, colunas: 29 },
  'features/jornada/jornada-page.tsx': { cards: 8, colunas: 22 },
  'features/receita/receita-page.tsx': { cards: 5, colunas: 14 },
  'features/cs/cs-page.tsx': { cards: 12, colunas: 12 },
}

/**
 * Telas que já cumprem a régua absoluta.
 *
 * Curta de propósito, como a `TELAS_NA_REGUA` da escada: cada nome aqui é uma
 * tela que foi refeita, não uma promessa. As demais aparecem no relatório do
 * teste com o placar atual, para a dívida ficar visível em vez de esquecida.
 *
 * ⚠️ A proposta estimava que `organizacoes` já passaria hoje. **Não passava** —
 * a prosa dela é a maior do produto (460 caracteres) e as três seções excediam
 * o teto. Entrou depois de encurtar as três, com a régua que estava só na prosa
 * indo para o lugar certo: o corte de 25 linhas virou `limiteDaFonte` na
 * tabela. Estimativa contra medição, de novo.
 */
export const TELAS_NA_DENSIDADE = [
  'features/visao-geral/visao-geral-page.tsx',
  'features/organizacoes/organizacoes-page.tsx',
  'features/jornada/jornada-page.tsx',
  'features/formacoes/formacoes-page.tsx',
  'features/solucoes/solucoes-page.tsx',
  'features/ia/ia-page.tsx',
  'features/entrada/entrada-page.tsx',
]
