import { useCallback } from 'react'
import { useSearchParams } from 'react-router'

import {
  PARAM_PAPEL,
  PARAM_PLANO,
  papelDaUrl,
  planoDaUrl,
  type Papel,
  type Plano,
} from '@/lib/segmento'

/**
 * Recorte ativo, lido e escrito na URL (`?papel=` e `?plano=`). Na URL, e não
 * em estado local, pelo mesmo motivo da aba: recorte que não é endereçável não
 * vira link de "olha esse número". A navegação do shell propaga os parâmetros
 * (`comSegmento`), então o recorte sobrevive à troca de módulo.
 */
export function useSegmento() {
  const [params, setParams] = useSearchParams()
  const papel = papelDaUrl(params.get(PARAM_PAPEL))
  const plano = planoDaUrl(params.get(PARAM_PLANO))

  const definir = useCallback(
    (mudanca: { papel?: Papel | null; plano?: Plano | null }) => {
      setParams(
        (atuais) => {
          const proximos = new URLSearchParams(atuais)
          if (mudanca.papel !== undefined) {
            if (mudanca.papel) proximos.set(PARAM_PAPEL, mudanca.papel)
            else proximos.delete(PARAM_PAPEL)
          }
          if (mudanca.plano !== undefined) {
            if (mudanca.plano) proximos.set(PARAM_PLANO, mudanca.plano)
            else proximos.delete(PARAM_PLANO)
          }
          return proximos
        },
        // recorte é visão, não navegação: voltar deve sair do módulo,
        // não desfazer filtros um a um — mesma regra da aba
        { replace: true },
      )
    },
    [setParams],
  )

  return { papel, plano, definir }
}
