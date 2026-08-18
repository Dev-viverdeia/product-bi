import lockup from '@/assets/marca/via-lockup.png'
import monograma from '@/assets/marca/via-monograma.png'
import { cn } from '@/lib/utils'

const PECAS = {
  /** o monograma VIA sozinho — para o disco da barra e espaços apertados */
  monograma: { fonte: monograma, proporcao: 108 / 58, rotulo: 'Viver de IA' },
  /** monograma + "VIVER DE IA" — para o login e qualquer assinatura */
  lockup: { fonte: lockup, proporcao: 494 / 58, rotulo: 'Viver de IA' },
} as const

/**
 * A marca da Viver de IA, pintada com `currentColor`.
 *
 * **Ela é uma MÁSCARA, não uma imagem**, e isso não é firula: a marca herda a
 * cor do texto do container, exatamente como fazia o ícone Lucide que ela
 * substituiu. Sem isso o disco da barra quebraria no escuro — `--primary`
 * INVERTE entre os temas (navy no claro, quase branco no escuro), então um PNG
 * branco fixo sumiria, e um navy fixo sumiria no claro. Com máscara, os dois
 * temas acertam sozinhos e não há arquivo duplicado para manter em sincronia.
 *
 * A altura vem de fora (`className`); a largura sai da proporção do arquivo, e
 * por isso ela nunca deforma.
 *
 * ⚠️ **Os arquivos são PNG, não SVG** — foi o que a marca entregou. Funciona,
 * porque a máscara usa só o canal alfa e os originais têm folga de resolução
 * (o monograma é 108×58 para render de ~15px). Se um dia vier o SVG, é troca
 * de arquivo: nada aqui muda.
 */
export function MarcaVia({
  peca = 'monograma',
  className,
}: {
  peca?: keyof typeof PECAS
  className?: string
}) {
  const { fonte, proporcao, rotulo } = PECAS[peca]

  return (
    <span
      role="img"
      aria-label={rotulo}
      className={cn('inline-block bg-current', className)}
      style={{
        aspectRatio: proporcao,
        maskImage: `url(${fonte})`,
        WebkitMaskImage: `url(${fonte})`,
        maskSize: 'contain',
        WebkitMaskSize: 'contain',
        maskRepeat: 'no-repeat',
        WebkitMaskRepeat: 'no-repeat',
        maskPosition: 'center',
        WebkitMaskPosition: 'center',
      }}
    />
  )
}
