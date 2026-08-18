import type { ReactNode } from 'react'
import { Accordion } from 'radix-ui'
import { ChevronDownIcon } from 'lucide-react'

import { StatusPill, type TomDeStatus } from '@/components/ui-marca/status-pill'
import { formatInt } from '@/lib/format'
import { cn } from '@/lib/utils'

export type AchadoNoAcordeao = {
  /** chave estável e alvo do `?achado=` no futuro */
  id: string
  titulo: string
  /** pílula de severidade, já traduzida */
  severidade: { tom: TomDeStatus; rotulo: string }
  /** de onde o achado veio — só o plano transversal precisa disso */
  origem?: string
  /**
   * A linha que fica sempre visível, mesmo fechada.
   *
   * É o que torna a lista legível sem abrir nada. Qual linha é essa depende da
   * aba: em `Análise` é o FATO (quem passa o olho leva o número embora), em
   * `Plano` é a AÇÃO (ali o que se procura é o que fazer). O resto é
   * profundidade, e fica a um clique.
   */
  resumo: ReactNode
  /** leitura, ação e âncora — só quando aberto */
  detalhe: ReactNode
}

/**
 * Lista de achados que revela em degraus.
 *
 * **O problema que ela resolve é de rolagem, não de estética.** Cada achado
 * carrega três parágrafos e uma caixa de ação; empilhados, dezesseis deles
 * viram quase cinquenta blocos de texto em coluna única, e ninguém chega ao
 * fim. Foi a reclamação do Mateus em 18/ago sobre as abas `Análise` e `Plano`
 * e sobre `/plano`.
 *
 * Três decisões que não são de gosto:
 *
 * - **O fato fica FORA do dobrável.** Esconder o número atrás de um clique
 *   transformaria a lista num índice de títulos, e título de achado sem número
 *   é manchete. Fechado, cada linha já entrega a afirmação com o dado.
 * - **O primeiro item abre sozinho** (`defaultValue`). Uma lista inteiramente
 *   fechada obriga um clique antes de qualquer leitura, e a primeira linha é
 *   justamente a mais grave — a ordem é por score.
 * - **`type="multiple"`**: comparar dois achados é uso normal aqui, e um
 *   acordeão que fecha o anterior ao abrir o seguinte impede exatamente isso.
 */
export function AcordeaoDeAchados({
  achados,
  className,
}: {
  achados: AchadoNoAcordeao[]
  className?: string
}) {
  if (achados.length === 0) return null

  return (
    <Accordion.Root
      type="multiple"
      defaultValue={[achados[0]!.id]}
      className={cn('divide-border/70 divide-y', className)}
    >
      {achados.map((achado, i) => (
        <Accordion.Item key={achado.id} value={achado.id} className="py-5 first:pt-0 last:pb-0">
          {/*
            Só o TÍTULO fica dentro do gatilho. O resumo mora fora por duas
            razões: `<button>` aceita conteúdo de frase, não de fluxo, e texto
            dentro de botão é penoso de selecionar — e o resumo é justamente a
            linha que alguém vai querer copiar, porque é onde está o número.

            O `<h3>` também saiu: `Accordion.Header` já É o heading, e um h3
            dentro dele daria cabeçalho aninhado.
          */}
          <Accordion.Header className="flex">
            <Accordion.Trigger
              className={cn(
                'group focus-visible:ring-ring -mx-1 flex w-full items-center gap-3',
                'rounded-md px-1 py-0.5 text-left',
                'focus-visible:ring-2 focus-visible:outline-none',
              )}
            >
              <span className="text-muted-foreground num text-xs tabular-nums">
                {formatInt(i + 1)}
              </span>
              <span className="min-w-0 flex-1 text-[17px] font-medium tracking-tight">
                {achado.titulo}
              </span>
              <StatusPill tom={achado.severidade.tom}>{achado.severidade.rotulo}</StatusPill>
              {achado.origem ? (
                <span className="text-muted-foreground hidden text-xs sm:inline">
                  {achado.origem}
                </span>
              ) : null}
              <ChevronDownIcon
                aria-hidden
                className="text-muted-foreground size-4 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180"
              />
            </Accordion.Trigger>
          </Accordion.Header>

          {/* visível fechado: é o que dá sentido ao título sem exigir clique */}
          <div className="text-muted-foreground mt-1.5 max-w-[68ch] pl-7 text-[15px] leading-relaxed">
            {achado.resumo}
          </div>

          <Accordion.Content
            className={cn(
              'overflow-hidden',
              'data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down',
            )}
          >
            <div className="max-w-[68ch] space-y-3 pt-4 pl-7">{achado.detalhe}</div>
          </Accordion.Content>
        </Accordion.Item>
      ))}
    </Accordion.Root>
  )
}
