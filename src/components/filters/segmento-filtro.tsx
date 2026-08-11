import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useSegmento } from '@/components/filters/use-segmento'
import { PAPEIS, PLANOS } from '@/lib/segmento'
import { cn } from '@/lib/utils'

/** valor-sentinela do item "Todos" — o Radix Select não aceita item vazio */
const TODOS = 'todos'

function Seletor<T extends string>({
  rotulo,
  valor,
  opcoes,
  onChange,
}: {
  rotulo: string
  valor: T | null
  opcoes: readonly { valor: T; rotulo: string }[]
  onChange: (valor: T | null) => void
}) {
  return (
    <Select
      value={valor ?? TODOS}
      onValueChange={(v) => onChange(v === TODOS ? null : (v as T))}
    >
      <SelectTrigger
        size="sm"
        aria-label={`Filtrar por ${rotulo.toLowerCase()}`}
        className={cn(
          'gap-1.5',
          // "Todos" é ausência de recorte: o valor fica mudo e o controle
          // recua; com recorte ativo o valor escurece e pede atenção
          valor == null && '*:data-[slot=select-value]:text-muted-foreground',
        )}
      >
        <span className="text-muted-foreground">{rotulo}</span>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={TODOS}>Todos</SelectItem>
        {opcoes.map((opcao) => (
          <SelectItem key={opcao.valor} value={opcao.valor}>
            {opcao.rotulo}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/**
 * Filtro global de persona/plano — anda ao lado do filtro de período nas telas
 * cujo grão é cliente da plataforma. Os valores vêm do contrato (lib/segmento):
 * 3 papéis + 4 planos, combináveis; quem protege célula pequena é a régua de
 * supressão nas RPCs, não o filtro.
 */
export function SegmentoFiltro() {
  const { papel, plano, definir } = useSegmento()

  return (
    <div role="group" aria-label="Recorte por papel e plano" className="flex flex-wrap gap-2">
      <Seletor
        rotulo="Papel"
        valor={papel}
        opcoes={PAPEIS}
        onChange={(v) => definir({ papel: v })}
      />
      <Seletor
        rotulo="Plano"
        valor={plano}
        opcoes={PLANOS}
        onChange={(v) => definir({ plano: v })}
      />
    </div>
  )
}
