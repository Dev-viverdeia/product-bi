import { useState } from 'react'
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider, keepPreviousData } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'

import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider } from '@/features/auth/auth-provider'

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            /*
              5 minutos, e não 60 segundos: o pipeline escreve a cada 30 min
              (`bi_sync_plataforma`), então refetch de minuto em minuto trazia
              os mesmos bytes. Cinco é o mesmo passo do `FrescorDoDado` e do
              `AlertaPipeline`, que já sondam nesse ritmo — a tela inteira passa
              a envelhecer no mesmo relógio.
            */
            staleTime: 5 * 60_000,
            /*
              Segura o render anterior enquanto a chave nova carrega, em vez de
              derrubar tudo para esqueleto.

              Não é polimento: trocar 30 -> 90 dias derrubava os doze cards de
              Clientes ao mesmo tempo, e como o esqueleto é MENOR que o
              conteúdo a página saltava. "Poluído" tem um componente que não é
              tinta — é uma tela que se remonta seis vezes em cinco segundos.

              ⚠️ Quem segura dado velho tem de DIZER que é velho. O par
              obrigatório disto é o `isRefreshing` do ChartCard/TabelaCard, que
              esmaece o conteúdo enquanto a consulta corre. Card novo sem ele
              mostra o número da janela anterior com cara de número da janela
              atual.

              Duas exceções, as duas declaradas no próprio hook:
              `useAchados` (o texto afirma números) e `usePaginaBruta` (a chave
              carrega tabela E offset).
            */
            placeholderData: keepPreviousData,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  )

  return (
    <QueryClientProvider client={queryClient}>
      {/* Light-first: claro é o padrão da marca; dark é escolha do usuário */}
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
        <AuthProvider>
          <TooltipProvider delayDuration={200}>
            {children}
            <Toaster richColors position="top-right" />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
