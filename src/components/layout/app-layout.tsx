import { Suspense } from 'react'
import { Outlet, useLocation } from 'react-router'

import { AbasCompactas, AppBarra } from '@/components/layout/app-barra'
import { AppRail } from '@/components/layout/app-rail'
import { FronteiraDeErro } from '@/components/layout/fronteira-de-erro'
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
  const { pathname } = useLocation()

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
            a calha de baixo (12). Muda junto com `--barra-altura`.

            ⚠️ `max-h` e `overflow-y-auto` entraram em 19/ago, com os nomes de
            grupo. Elemento `sticky` mais alto que a área visível tem o pé
            INALCANÇÁVEL — ele nunca sai do lugar, então rolar a página não
            revela o resto. Medido: o rail passou a 758px de conteúdo contra os
            664px de uma tela de 768px de altura (1366x768 é laptop comum), e
            "Design system" ficaria fora para sempre. Com o teto igual ao piso,
            o rail tem exatamente a altura da área visível e rola por dentro
            quando não cabe — em telas altas nada muda, porque não sobra o que
            rolar. Módulo novo passa a caber por construção. */}
        <AppRail className="sticky top-3 hidden max-h-[calc(100svh-6.5rem)] min-h-[calc(100svh-6.5rem)] overflow-y-auto lg:flex" />

        <main className="min-w-0 flex-1">
          {/*
            A fronteira envolve SÓ o Outlet: erro de módulo não pode custar a
            barra e o rail, senão a saída de uma tela quebrada vira recarregar a
            página inteira para conseguir ir a outro lugar.

            ⚠️ `key={pathname}` não é detalhe. Sem ela o estado de erro sobrevive
            à navegação seguinte, e a próxima tela nasce quebrada sem nunca ter
            sido renderizada — o defeito passa a parecer estar em toda parte. É
            `pathname` e não a location inteira de propósito: trocar `?aba=` ou
            `?periodo=` não remonta nada.

            Módulos entram por import dinâmico — o shell não espera o chunk.
          */}
          <FronteiraDeErro key={pathname} escopo="modulo">
            <Suspense fallback={<PageFallback />}>
              <Outlet />
            </Suspense>
          </FronteiraDeErro>
        </main>
      </div>
    </div>
  )
}
