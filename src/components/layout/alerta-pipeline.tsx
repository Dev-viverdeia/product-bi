import { useQuery } from '@tanstack/react-query'
import { TriangleAlertIcon } from 'lucide-react'

import { supabase } from '@/lib/supabase'
import { formatDecimal } from '@/lib/format'

/**
 * Faixa de aviso quando o pipeline para de sincronizar.
 * Dado velho servido como se fosse atual é pior que dado ausente — o alerta
 * fica no shell, visível em qualquer tela.
 */
export function AlertaPipeline() {
  const { data } = useQuery({
    queryKey: ['pipeline', 'saude'],
    refetchInterval: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('bi_saude_pipeline')
      if (error) throw new Error(error.message)
      return data?.[0] ?? null
    },
  })

  if (!data?.esta_defasado) return null

  const horas = data.horas_desde_sync ?? 0

  return (
    <div
      role="status"
      className="border-destructive/40 bg-destructive/5 flex items-start gap-2.5 rounded-md border px-3 py-2.5 text-sm"
    >
      <TriangleAlertIcon className="text-destructive mt-0.5 size-4 shrink-0" />
      <div className="space-y-0.5">
        <p className="font-medium">
          Dados desatualizados há {formatDecimal(horas)}h
        </p>
        <p className="text-muted-foreground">
          A sincronização com a plataforma parou — os números abaixo são do último
          ciclo bem-sucedido, não de agora.
          {data.ultimo_erro ? ` Erro: ${data.ultimo_erro}` : ''}
        </p>
      </div>
    </div>
  )
}
