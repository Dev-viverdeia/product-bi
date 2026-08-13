import { Suspense } from 'react'
import { Outlet } from 'react-router'

import { AbasCompactas, AppBarra } from '@/components/layout/app-barra'
import { AppRail } from '@/components/layout/app-rail'
import { PageFallback } from '@/components/layout/page-fallback'

/**
 * Shell autenticado: uma MOLDURA cinza sobre a página, com barra em cima e rail
 * à esquerda.
 *
 * A moldura não é enfeite — ela é o que dá superfície para a aba ativa da barra
 * se fundir. O canal cinza que atravessa o cromo branco só faz sentido se
 * existir um cinza contínuo abaixo dele; sem a moldura a aba desceria para o
 * nada. Rampa de superfícies e shell são a mesma decisão, não duas.
 *
 * A ordem também importa: a barra fica ACIMA do rail, atravessando a moldura
 * inteira. Invertida (rail de altura total, barra só sobre o conteúdo), a aba
 * ativa deixaria de tocar a borda esquerda e a marca sairia do lugar de âncora.
 */
export function AppLayout() {
  return (
    <div className="bg-background min-h-svh p-3 md:p-6">
      <div className="bg-moldura mx-auto max-w-[1560px] rounded-2xl p-3 shadow-lg md:p-5">
        <AppBarra />

        {/* Abaixo de `lg` o rail vira gaveta (no botão da barra) e as abas
            descem para cá — a curva da AbaCanal não cabe em tela estreita. */}
        <AbasCompactas className="mb-4 lg:hidden" />

        <div className="flex items-start gap-5">
          {/* `sticky` porque trocar de módulo nunca pode exigir rolar de volta
              ao topo; a altura mínima é a da área visível, para o rail parecer
              uma coluna e não um bloco solto numa página curta. */}
          <AppRail className="sticky top-6 hidden min-h-[calc(100svh-9.5rem)] lg:flex" />

          <main className="min-w-0 flex-1">
            {/* Módulos entram por import dinâmico — o shell não espera o chunk. */}
            <Suspense fallback={<PageFallback />}>
              <Outlet />
            </Suspense>
          </main>
        </div>
      </div>
    </div>
  )
}
