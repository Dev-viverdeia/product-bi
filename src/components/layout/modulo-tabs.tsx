import { useId } from 'react'
import type { ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import { useReducedMotion } from 'motion/react'
import * as motion from 'motion/react-client'

import { abasDaRota } from '@/components/layout/nav-items'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

const EASE = [0.16, 1, 0.3, 1] as const // --via-ease-out

/** nome do parâmetro na URL — usado aqui e pelos atalhos da barra do topo */
export const PARAM_ABA = 'aba'

/**
 * Abas de contexto dentro de um módulo.
 *
 * Um módulo de BI acumula muitos blocos, e empilhados num scroll único eles
 * competem: quem abre "Clientes" para agir sobre quem está saindo passa por
 * quatro gráficos de retenção antes de chegar na lista. As abas separam por
 * pergunta, não por tipo de visualização.
 *
 * KPIs, filtro de período e avisos de limitação do dado ficam FORA daqui,
 * acima: são contexto do módulo inteiro. Trocar de aba não pode custar o número
 * de referência, e ressalva escondida atrás de aba é ressalva que ninguém lê.
 *
 * A aba ativa vive na URL (`?aba=`), não em estado local. Sem isso ela não é
 * endereçável: não dá para mandar "olha a aba de risco" para alguém, nem para a
 * barra do topo oferecer atalho direto. A troca usa `replace` porque aba é
 * recorte de visão, não navegação — empilhar no histórico faria o botão voltar
 * desfazer cliques de aba em vez de sair do módulo.
 *
 * O indicador é um só elemento que desliza entre as abas (`layoutId`), em vez
 * de um fundo que apaga aqui e acende ali — é o movimento que deixa claro que
 * é a MESMA seleção mudando de lugar. Sob `prefers-reduced-motion` ele troca
 * instantaneamente, sem travessia.
 */
export function ModuloTabs({
  rota,
  conteudos,
  className,
}: {
  /** rota do módulo; as abas vêm de `nav-items.ts`, fonte única */
  rota: string
  /** conteúdo por valor de aba */
  conteudos: Record<string, ReactNode>
  className?: string
}) {
  const abas = abasDaRota(rota)
  const [params, setParams] = useSearchParams()
  const reduzido = useReducedMotion()
  // layoutId é global no motion: sem um id por instância, duas listas de abas
  // na mesma tela fariam o indicador voar de uma para a outra
  const idIndicador = useId()

  const daUrl = params.get(PARAM_ABA)
  const ativa = abas.some((a) => a.valor === daUrl) ? daUrl! : (abas[0]?.valor ?? '')

  function trocar(valor: string) {
    // preserva os outros parâmetros — o período do módulo pode viver aqui depois
    const proximos = new URLSearchParams(params)
    proximos.set(PARAM_ABA, valor)
    setParams(proximos, { replace: true })
  }

  if (abas.length === 0) return null

  return (
    <Tabs value={ativa} onValueChange={trocar} className={cn('gap-4', className)}>
      <TabsList
        variant="line"
        className="bg-foreground/5 h-auto w-full justify-start gap-1 overflow-x-auto rounded-lg p-1"
      >
        {abas.map((aba) => {
          const estaAtiva = aba.valor === ativa
          return (
            <TabsTrigger
              key={aba.valor}
              value={aba.valor}
              className={cn(
                'relative flex-none rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap',
                'data-[state=active]:bg-transparent data-[state=active]:shadow-none',
                'after:hidden', // o sublinhado do variant=line conflita com o indicador
                estaAtiva ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {estaAtiva ? (
                <motion.span
                  layoutId={idIndicador}
                  className="bg-card absolute inset-0 rounded-md shadow-sm"
                  transition={reduzido ? { duration: 0 } : { duration: 0.28, ease: EASE }}
                />
              ) : null}
              {/* acima do indicador: sem z-index o fundo deslizante cobre o rótulo */}
              <span className="relative z-10 flex items-center gap-1.5">
                <aba.icone className="size-4 shrink-0" />
                {aba.titulo}
              </span>
            </TabsTrigger>
          )
        })}
      </TabsList>

      {abas.map((aba) => (
        <TabsContent key={aba.valor} value={aba.valor} className="mt-0">
          {reduzido ? (
            conteudos[aba.valor]
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.24, ease: EASE }}
            >
              {conteudos[aba.valor]}
            </motion.div>
          )}
        </TabsContent>
      ))}
    </Tabs>
  )
}
