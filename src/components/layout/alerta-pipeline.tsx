import { useQuery } from '@tanstack/react-query'
import { TriangleAlertIcon } from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { supabase } from '@/lib/supabase'
import { formatDataHora, formatDuracao } from '@/lib/format'

/** Recorte de `bi_saude_pipeline` que o indicador consome. */
type Saude = {
  ultima_sync: string | null
  horas_desde_sync: number | null
  esta_defasado: boolean | null
  ultimo_erro: string | null
}

/**
 * Indicador de pipeline defasado, na barra do topo.
 *
 * Saiu de faixa larga acima do conteúdo para um botão na barra: ocupando uma
 * linha inteira, o aviso empurrava o mosaico para baixo em toda tela e competia
 * com o primeiro bloco. Na barra ele fica permanentemente visível — que é o
 * requisito real — sem custar altura de conteúdo.
 *
 * O resumo cabe no botão (quantos dias) e o detalhe abre no clique. A faixa
 * antiga liderava com "há 46,9h", que obriga o leitor a dividir por 24 para
 * saber se o dado é de ontem ou da semana passada; agora o carimbo do dado vem
 * primeiro, em horário de Brasília fixo — o resto da tela usa colunas `*_brt`,
 * e um fuso diferente aqui contradiria todos os números.
 */
export function AlertaPipelineView({
  saude,
  falhouAoVerificar = false,
  carregando = false,
}: {
  saude: Saude | null
  falhouAoVerificar?: boolean
  carregando?: boolean
}) {
  /*
    O silêncio deste indicador é uma afirmação: "conferi, os dados estão em dia".
    Por isso ele não pode calar em nenhum caso onde a frescura NÃO foi
    confirmada — e não basta olhar `isError`. Consulta que assenta sem erro e
    sem linha (permissão negada tratada como vazio, RPC devolvendo zero linhas)
    caía justamente nesse buraco: sumia da tela e passava por saudável.

    Enquanto carrega, silêncio é correto — ainda não há afirmação a fazer.
  */
  const semConfirmacao = !carregando && (falhouAoVerificar || saude == null)
  const defasado = !!saude?.esta_defasado
  if (!semConfirmacao && !defasado) return null
  const emFalha = semConfirmacao

  const horas = saude?.horas_desde_sync ?? 0
  const carimbo = saude?.ultima_sync ? formatDataHora(saude.ultima_sync) : null
  const conexaoRecusada = /could not connect/i.test(saude?.ultimo_erro ?? '')
  const resumo = emFalha ? 'sem verificação' : formatDuracao(horas)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        /* Preenchimento em token e não em `bg-white/10`: aquele alfa existia
           para funcionar sobre a barra navy e é invisível sobre cromo branco. */
        className="bg-controle text-foreground focus-visible:ring-ring hover:bg-secondary flex h-11 items-center gap-1.5 rounded-full px-3.5 text-xs font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:outline-none"
        aria-label={
          emFalha
            ? 'Não foi possível verificar se os dados estão atualizados'
            : `Dados desatualizados há ${resumo}`
        }
      >
        <TriangleAlertIcon className="size-3.5 shrink-0" />
        <span className="hidden sm:inline">{resumo}</span>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="max-w-[min(24rem,calc(100vw-2rem))] p-3">
        {emFalha ? (
          <div className="space-y-1">
            <p className="text-sm font-medium">
              Não foi possível verificar se os dados estão atualizados
            </p>
            <p className="text-muted-foreground text-xs">
              A checagem de saúde do pipeline não respondeu. Trate os números como
              possivelmente desatualizados até este aviso sumir.
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            <p className="text-sm font-medium">
              {carimbo
                ? `Você está vendo dados de ${carimbo}`
                : `Dados desatualizados há ${resumo}`}
            </p>
            <p className="text-muted-foreground text-xs">
              Todo número das telas é desse momento, não de agora.{' '}
              {conexaoRecusada
                ? 'A conexão com o banco da plataforma está sendo recusada — é falha de infraestrutura, não do BI. Assim que o acesso voltar, o ciclo se recupera sozinho em até 30 minutos.'
                : 'A sincronização com a plataforma parou.'}
            </p>
            {saude?.ultimo_erro ? (
              <p className="text-muted-foreground border-t pt-1.5 text-xs">
                Último erro: <code className="font-mono break-all">{saude.ultimo_erro}</code>
              </p>
            ) : null}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Container: consulta a saúde do pipeline e entrega para a parte visual. */
export function AlertaPipeline() {
  const { data, isError, isPending } = useQuery({
    queryKey: ['pipeline', 'saude'],
    refetchInterval: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('bi_saude_pipeline')
      if (error) throw new Error(error.message)
      return data?.[0] ?? null
    },
  })

  return (
    <AlertaPipelineView saude={data ?? null} falhouAoVerificar={isError} carregando={isPending} />
  )
}
