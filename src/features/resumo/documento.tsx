import type { ReactNode } from 'react'

import { formatInt } from '@/lib/format'

/**
 * Placar da apuração: quantas perguntas foram feitas e o que aconteceu com elas.
 *
 * Abre a coluna de apoio porque é a informação mais barata de ler da página
 * inteira — quatro números — e porque ela responde, antes de qualquer texto, a
 * pergunta que dá ou tira crédito ao resto: **isto aqui é uma seleção de quê?**
 *
 * Estava em prosa, no fim do aparato ("Nesta carga, 6 regras foram avaliadas: 3
 * em tela, 0 sem lastro, 3 abaixo do corte"). Número dentro de frase corrida
 * não é escaneável, e este é o número que o leitor cético procura primeiro.
 */
function PlacarDaApuracao({
  avaliadas,
  emTela,
  semLastro,
  abaixoDoCorte,
}: {
  avaliadas: number
  emTela: number
  semLastro: number
  abaixoDoCorte: number
}) {
  const linhas = [
    { rotulo: 'em tela', valor: emTela },
    { rotulo: 'sem lastro', valor: semLastro },
    { rotulo: 'abaixo do corte', valor: abaixoDoCorte },
  ].filter((l) => l.valor > 0)

  return (
    <section className="border-border/70 space-y-3 border-b pb-6">
      <p className="flex items-baseline gap-2">
        <span className="num text-2xl leading-none font-semibold tracking-tight">
          {formatInt(avaliadas)}
        </span>
        <span className="text-muted-foreground text-sm">
          {avaliadas === 1 ? 'pergunta avaliada' : 'perguntas avaliadas'}
        </span>
      </p>

      {linhas.length > 0 ? (
        <dl className="space-y-1">
          {linhas.map((l) => (
            <div key={l.rotulo} className="flex items-baseline justify-between gap-3">
              <dt className="text-muted-foreground text-sm">{l.rotulo}</dt>
              <dd className="num text-sm tabular-nums">{formatInt(l.valor)}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </section>
  )
}

/**
 * O documento de duas colunas das abas `Análise` e `Plano`.
 *
 * **Existe como peça porque as duas abas SÃO o mesmo documento com o peso
 * trocado**, e até 20/ago cada uma reescrevia o grid, o cabeçalho e o aparato
 * por conta própria. O comentário do `PlanoDaTela` já dizia "a MESMA gramática
 * da aba Análise" — e gramática repetida à mão é gramática que deriva. Foi
 * exatamente assim que a seleção de achados divergiu entre as duas, publicando
 * 3 de um lado e 6 do outro.
 *
 * **Sem card.** A leitura escrita é o DOCUMENTO da tela, não um bloco dentro
 * dela: envolvê-la numa moldura branca a rebaixa ao nível de um gráfico e cobra
 * dois paddings de uma coluna que só precisa de texto.
 *
 * ⚠️ **A grade tem uma faixa de largura que já produziu o oposto do que ela
 * quer, e a conta está aqui para não se repetir.** A regra é: *o apoio nunca
 * pode ficar mais largo que a leitura.*
 *
 * A receita antiga era `minmax(0,68ch) minmax(16rem,26rem)` a partir de `xl`. O
 * problema é que o grid distribui a folga IGUALMENTE entre trilhas que podem
 * crescer, a partir das bases (0 e 16rem) — então, quando a folga não dá para
 * as duas, o apoio (que parte de 256px) chega ao teto antes de a leitura sair
 * do zero. Com o rail de 208px, na faixa de 1024–1135px isso dava 304px de
 * leitura contra 416px de apoio: 37% mais largo, quebrando em ~40 caracteres
 * por linha. Por isso a versão anterior tinha empurrado as duas colunas para
 * `xl`, desistindo da faixa inteira do `lg`.
 *
 * A saída não é adiar: é a trilha do apoio **não competir**. Em `lg` ela é
 * fixa em `16rem`, e a leitura leva todo o resto:
 *
 * | viewport | `main` | folga do grid | leitura | apoio |
 * | --- | --- | --- | --- | --- |
 * | 1024 (`lg`) | 776px | 736px | **480px** | 256px |
 * | 1280 (`xl`) | 1032px | 976px | **~544px** (teto de 68ch) | ~416px |
 *
 * `main` = viewport − calha (2×12) − rail (208) − folga do rail (16). Mexer na
 * largura do rail obriga a refazer esta conta; o modo de falha é invisível nos
 * dois checkpoints do projeto (375px empilha, 1280px está certo) e só aparece
 * no meio.
 */
export function DocumentoDeAchados({
  titulo,
  escopo,
  children,
  aparato,
  placar,
}: {
  titulo: string
  /** período, recorte e data do dado — só o que a tela de fato oferece */
  escopo?: string
  /** a coluna de leitura: os achados */
  children: ReactNode
  /** a coluna de apoio: o que não dá para afirmar, como foi apurado */
  aparato?: ReactNode
  /** o placar da apuração; omitir enquanto carrega ou quando falhou */
  placar?: { avaliadas: number; emTela: number; semLastro: number; abaixoDoCorte: number }
}) {
  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_16rem] lg:gap-12 xl:grid-cols-[minmax(0,68ch)_minmax(16rem,26rem)] xl:gap-14">
      <div className="space-y-8">
        <header className="space-y-1">
          <h2 className="text-xl font-medium tracking-tight">{titulo}</h2>
          {escopo ? <p className="text-muted-foreground text-sm">{escopo}</p> : null}
        </header>

        {children}
      </div>

      {/* Sem `pt` para alinhar com o conteúdo: o placar É a âncora visual do
          topo desta coluna, e o espaço que a versão anterior reservava para
          alinhar com o primeiro achado ficava vazio quando nada era suprimido —
          que é a maioria das telas. */}
      <aside className="space-y-6">
        {placar ? <PlacarDaApuracao {...placar} /> : null}
        {aparato}
      </aside>
    </div>
  )
}
