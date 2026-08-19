import { NavLink, useMatch, useSearchParams } from 'react-router'

import { GRUPOS_DE_NAV, navFerramentas, navItems } from '@/components/layout/nav-items'
import type { NavItem } from '@/components/layout/nav-items'
import { comSegmento } from '@/lib/segmento'
import { cn } from '@/lib/utils'

function ItemDoRail({ item }: { item: NavItem }) {
  const [params] = useSearchParams()
  /*
    ⚠️ O estado ativo é calculado AQUI, não pelo `className` de função do
    NavLink. A armadilha original era o `Slot` do Radix sob `TooltipTrigger
    asChild`, que concatena o className do gatilho com o do filho — e concatenar
    string com função produz a FONTE da função, que vai para o atributo `class`
    como texto. O tooltip saiu junto com o rail de ícone, mas o `useMatch` fica:
    o estado ativo é lido em dois lugares (o fundo da linha e o peso do rótulo),
    e ter o booleano à mão é o que evita repetir a regra de rota.
  */
  const ativo = !!useMatch({ path: item.to, end: item.to === '/' })

  return (
    <NavLink
      to={comSegmento(item.to, params)}
      end={item.to === '/'}
      className={cn(
        'flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm transition-colors',
        'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
        ativo
          ? 'bg-primary text-primary-foreground font-medium'
          : 'text-muted-foreground hover:bg-controle hover:text-foreground font-normal',
      )}
    >
      <item.icon className="size-[18px] shrink-0" strokeWidth={1.75} />
      {/* `truncate` é rede, não plano: a largura do rail foi dimensionada pelo
          rótulo mais longo, medido na fonte real (Outfit 14px + o tracking
          -0.011em do base) — "Consultor & Builder" ocupa ~118px numa caixa de
          140px. Módulo novo com nome maior corta com reticências em vez de
          empurrar o layout: o defeito fica visível na tela, que é onde alguém
          o conserta. */}
      <span className="truncate">{item.title}</span>
    </NavLink>
  )
}

/**
 * Rail de navegação: ícone **e rótulo**, coluna à esquerda do conteúdo.
 *
 * ⚠️ **O rótulo voltou em 19/ago, por decisão do CEO**, e isto reverte a linha
 * "não reintroduzir sidebar com rótulo" que valia desde 13/ago. O motivo é o que
 * o próprio código admitia: o comentário antigo dizia "o tooltip É o rótulo, sem
 * ele o rail vira adivinhação". Um menu que só se lê passando o mouse cobra uma
 * interação para responder "onde eu estou e para onde posso ir" — e quem abre o
 * BI uma vez por semana paga esse pedágio toda vez.
 *
 * **O custo é real e foi medido, não estimado.** O rail passou de 68px para
 * 208px, e a largura sai do conteúdo: a 1720px do shell, os gráficos caem de
 * 1612px para 1472px (−140px, −8,7%). Isso contraria uma prioridade que o
 * projeto já defendeu no detalhe — a calha foi encolhida de 20px para 12px
 * justamente para devolver largura aos gráficos. A decisão do CEO tem
 * precedência sobre essa otimização; o registro fica para que a troca seja
 * conhecida, não para ser refeita.
 *
 * **O agrupamento é a arquitetura da navegação, e ele NÃO estava sendo
 * desenhado.** O separador era `<span className="h-3 first:hidden" />` colocado
 * como primeiro filho da div de cada grupo — e `first:` casa com
 * `:first-child`, então ele se escondia sempre, em todos os grupos. Os quatro
 * blocos apareciam como uma lista uniforme desde 13/ago. Agora a margem vive na
 * div do grupo (`mt-3 first:mt-0`), onde `first:` de fato aponta para o
 * primeiro grupo.
 *
 * O item ativo é uma pílula preenchida, não um fundo mais claro: sobre o cromo
 * branco a diferença de alfa que funcionava na barra navy é quase invisível.
 */
export function AppRail({ className }: { className?: string }) {
  return (
    <nav
      aria-label="Navegação principal"
      className={cn(
        'bg-nav-surface flex w-52 shrink-0 flex-col gap-1 rounded-2xl px-2 py-3 shadow-md',
        className,
      )}
    >
      {GRUPOS_DE_NAV.map((grupo) => {
        const doGrupo = navItems.filter((item) => item.grupo === grupo && !item.oculto)
        if (doGrupo.length === 0) return null
        return (
          /* Separador entre blocos: espaço, não linha. Uma régua a cada bloco
             competiria com a pílula do item ativo e o rail viraria formulário. */
          <div key={grupo} className="mt-3 flex flex-col gap-1 first:mt-0">
            {doGrupo.map((item) => (
              <ItemDoRail key={item.to} item={item} />
            ))}
          </div>
        )
      })}

      {/* As ferramentas caem no rodapé: são do app, não do produto, e
          misturá-las aos módulos daria a elas o mesmo peso das análises. */}
      <div className="mt-auto flex flex-col gap-1 pt-6">
        {navFerramentas.map((item) => (
          <ItemDoRail key={item.to} item={item} />
        ))}
      </div>
    </nav>
  )
}
