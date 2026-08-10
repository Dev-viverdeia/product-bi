import { Suspense } from 'react'
import { Outlet } from 'react-router'

import { AppHeader } from '@/components/layout/app-header'
import { PageFallback } from '@/components/layout/page-fallback'

/**
 * Shell autenticado: barra flutuante escura no topo, mosaico claro embaixo.
 *
 * O aviso de sync vive na barra, não aqui: como faixa acima do conteúdo ele
 * empurrava o mosaico para baixo em toda tela.
 *
 * O padding lateral é o mesmo do header (px-4 / md:px-6) para a barra e os
 * blocos alinharem na mesma calha — desalinhamento de 2px entre a barra e a
 * primeira coluna do mosaico é o tipo de coisa que faz a tela parecer torta
 * sem que se saiba por quê.
 */
export function AppLayout() {
  return (
    <div className="page-atmosphere min-h-svh">
      <AppHeader />
      <main className="space-y-4 overflow-x-hidden px-4 py-4 md:px-6 md:py-6">
        {/* Módulos entram por import dinâmico — a barra não espera o chunk. */}
        <Suspense fallback={<PageFallback />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  )
}
