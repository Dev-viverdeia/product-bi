import { Suspense } from 'react'
import { Outlet } from 'react-router'

import { AbasCompactas, AppBarra } from '@/components/layout/app-barra'
import { AppRail } from '@/components/layout/app-rail'
import { PageFallback } from '@/components/layout/page-fallback'

/**
 * Shell autenticado: barra em cima, rail à esquerda, conteúdo no resto.
 *
 * **Sem moldura.** Houve uma — um retângulo cinza arredondado envolvendo barra e
 * conteúdo — e ela saiu em 13/ago porque cobrava dois paddings e um raio grande
 * para desenhar uma borda que não separava nada. O papel dela era dar uma
 * superfície contínua para a aba ativa da barra se fundir; esse papel passou
 * para a própria página, que assumiu o valor claro que era da moldura.
 *
 * O que sobrou é o mínimo: uma calha lateral, uma largura máxima e nada mais
 * entre o conteúdo e a borda da tela.
 *
 * **A calha é estreita de propósito** (12px a partir de `md`, era 20px). Ela não
 * separa nada — o rail e os cards já têm sombra e raio próprios — e cada pixel
 * dela sai da largura que os gráficos disputam. Encolher a calha (8px de cada
 * lado) e a folga do rail (4px) devolveu 20px de largura ao conteúdo sem mexer
 * em nenhum card.
 *
 * A ordem importa: a barra fica ACIMA do rail, atravessando a largura inteira.
 * Invertida (rail de altura total, barra só sobre o conteúdo), a aba ativa
 * deixaria de tocar a borda esquerda e a marca sairia do lugar de âncora.
 */
export function AppLayout() {
  return (
    <div className="bg-background mx-auto min-h-svh max-w-[1720px] px-2 py-2 md:px-3 md:py-3">
      <AppBarra />

      {/* Abaixo de `lg` o rail vira gaveta (no botão da barra) e as abas descem
          para cá — a curva da AbaCanal não cabe em tela estreita. */}
      <AbasCompactas className="mb-4 lg:hidden" />

      <div className="flex items-start gap-3 md:gap-4">
        {/* `sticky` porque trocar de módulo nunca pode exigir rolar de volta ao
            topo; a altura mínima é a da área visível, para o rail parecer uma
            coluna e não um bloco solto numa página curta.
            6,5rem = a calha de cima (12) + a barra (64) + a margem dela (16) +
            a calha de baixo (12). Muda junto com `--barra-altura`. */}
        <AppRail className="sticky top-3 hidden min-h-[calc(100svh-6.5rem)] lg:flex" />

        <main className="min-w-0 flex-1">
          {/* Módulos entram por import dinâmico — o shell não espera o chunk. */}
          <Suspense fallback={<PageFallback />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  )
}
