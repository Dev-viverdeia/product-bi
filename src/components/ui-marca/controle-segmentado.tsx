import { ToggleGroup } from 'radix-ui'

import { cn } from '@/lib/utils'

/**
 * Escolha única entre 2–4 opções curtas, sempre visíveis.
 *
 * **Um trilho só, e o contorno é do trilho — não de cada opção.** Sem isso as
 * opções viram botões independentes competindo entre si, e o controle deixa de
 * comunicar que são faces da MESMA escolha. A selecionada sobe para o cromo
 * branco com sombra; as outras não têm fundo próprio.
 *
 * Preferido a `<select>` quando as opções cabem: com três alternativas, esconder
 * duas atrás de um menu troca uma leitura por um clique. Acima de quatro a conta
 * se inverte e o lugar passa a ser um `Select` — é o caso de papel e plano, que
 * têm 3 e 4 valores mais "Todos".
 */
export function ControleSegmentado<T extends string>({
  rotulo,
  valor,
  opcoes,
  onChange,
  className,
}: {
  /** rótulo acessível do grupo — não aparece na tela */
  rotulo: string
  valor: T
  opcoes: readonly { valor: T; rotulo: string }[]
  onChange: (valor: T) => void
  className?: string
}) {
  return (
    <ToggleGroup.Root
      type="single"
      value={valor}
      aria-label={rotulo}
      // `|| valor` porque o Radix emite '' quando se clica no item já ativo, e
      // um segmentado não tem estado "nada escolhido" — desmarcar deixaria a
      // tela sem janela e as consultas sem argumento
      onValueChange={(proximo) => onChange((proximo || valor) as T)}
      className={cn('bg-controle inline-flex items-center gap-0.5 rounded-full p-1', className)}
    >
      {opcoes.map((opcao) => (
        <ToggleGroup.Item
          key={opcao.valor}
          value={opcao.valor}
          className={cn(
            'focus-visible:ring-ring rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors',
            'focus-visible:ring-2 focus-visible:outline-none',
            'text-muted-foreground hover:text-foreground',
            'data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-xs',
          )}
        >
          {opcao.rotulo}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  )
}
