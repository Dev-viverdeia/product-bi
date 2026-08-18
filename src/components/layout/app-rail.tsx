import { NavLink, useMatch, useSearchParams } from 'react-router'

import { GRUPOS_DE_NAV, navFerramentas, navItems } from '@/components/layout/nav-items'
import type { NavItem } from '@/components/layout/nav-items'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { comSegmento } from '@/lib/segmento'
import { cn } from '@/lib/utils'

function ItemDoRail({ item }: { item: NavItem }) {
  const [params] = useSearchParams()
  /*
    ⚠️ O estado ativo é calculado AQUI, não pelo `className` de função do
    NavLink. Sob `TooltipTrigger asChild` o Slot do Radix concatena o className
    do gatilho com o do filho — e concatenar string com função produz a FONTE da
    função, que vai para o atributo `class` como texto. O NavLink nunca chega a
    chamá-la, e o item ativo fica indistinguível dos outros sem erro nenhum.
    Foi assim que este rail nasceu quebrado; só apareceu na medição.
  */
  const ativo = !!useMatch({ path: item.to, end: item.to === '/' })

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <NavLink
          to={comSegmento(item.to, params)}
          end={item.to === '/'}
          className={cn(
            'flex size-11 items-center justify-center rounded-full transition-colors',
            'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
            ativo
              ? 'bg-primary text-primary-foreground'
              : 'bg-controle text-muted-foreground hover:text-foreground',
          )}
        >
          <item.icon className="size-[18px]" strokeWidth={1.75} />
        </NavLink>
      </TooltipTrigger>
      {/* O tooltip É o rótulo, não um enfeite: sem ele o rail vira adivinhação.
          Por isso sem delay — atrasar aqui é atrasar a leitura do menu. */}
      <TooltipContent side="right" sideOffset={10}>
        {item.title}
      </TooltipContent>
    </Tooltip>
  )
}

/**
 * Rail de navegação: só ícone, coluna à esquerda do conteúdo.
 *
 * A navegação voltou para o lado, revertendo a decisão de 06/ago — e o que
 * estava errado ali era a *sidebar*, não o *lado*. Aquela era ícone **mais
 * rótulo**; a barra horizontal que a substituiu somava 1.189px de rótulo em dez
 * módulos e só cabia a partir de `xl`, o que obrigou `shortTitle`, esconder
 * ícone abaixo de `2xl` e um Sheet para o resto. Navegação horizontal custa
 * LARGURA, e largura é o que os gráficos disputam. Este rail é só ícone: custa
 * altura, que sobra, e escala para quantos módulos existirem.
 *
 * **O agrupamento é a única pista de arquitetura que o rail dá.** Sem rótulo, o
 * espaço entre blocos é o que diz "estes respondem o mesmo tipo de pergunta" —
 * por isso os grupos vêm de `nav-items.ts` e não de ordem casual.
 *
 * O item ativo é um disco preenchido, não um fundo mais claro: sobre o cromo
 * branco a diferença de alfa que funcionava na barra navy é quase invisível.
 */
export function AppRail({ className }: { className?: string }) {
  return (
    <nav
      aria-label="Seções"
      className={cn(
        'bg-nav-surface flex w-[68px] shrink-0 flex-col items-center gap-1.5 rounded-2xl py-4 shadow-md',
        className,
      )}
    >
      {GRUPOS_DE_NAV.map((grupo) => {
        const doGrupo = navItems.filter((item) => item.grupo === grupo && !item.oculto)
        if (doGrupo.length === 0) return null
        return (
          <div key={grupo} className="flex flex-col items-center gap-1.5">
            {/* Separador entre blocos: espaço, não linha. Uma régua a cada
                bloco competiria com os discos e o rail viraria uma lista. */}
            <span aria-hidden className="h-3 first:hidden" />
            {doGrupo.map((item) => (
              <ItemDoRail key={item.to} item={item} />
            ))}
          </div>
        )
      })}

      {/* As ferramentas caem no rodapé: são do app, não do produto, e
          misturá-las aos módulos daria a elas o mesmo peso das análises. */}
      <div className="mt-auto flex flex-col items-center gap-1.5 pt-6">
        {navFerramentas.map((item) => (
          <ItemDoRail key={item.to} item={item} />
        ))}
      </div>
    </nav>
  )
}
