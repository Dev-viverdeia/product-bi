import { NavLink, useMatch, useSearchParams } from 'react-router'

import {
  GRUPOS_DE_NAV,
  ROTULO_DE_FERRAMENTAS,
  ROTULOS_DE_GRUPO,
  navFerramentas,
  navItems,
} from '@/components/layout/nav-items'
import type { NavItem } from '@/components/layout/nav-items'
import { comSegmento } from '@/lib/segmento'
import { cn } from '@/lib/utils'

/**
 * O nome do bloco.
 *
 * É `h2` de propósito, e não um `span` estilizado: quem usa leitor de tela
 * navega por cabeçalho, e isso dá aos quatro grupos a mesma estrutura que quem
 * enxerga recebe do espaço em branco. Enquanto o rail era só de ícone, esse
 * canal não existia em lado nenhum.
 *
 * Caixa alta é o que separa o rótulo do bloco do rótulo do item sem gastar cor
 * nem peso — os dois usam `text-muted-foreground`, e o que os distingue é
 * tamanho e caixa. ⚠️ O `tracking-wide` não é enfeite: o base do projeto aplica
 * `letter-spacing: -0.011em` no corpo, e caixa alta a 11px com tracking
 * negativo fecha as letras umas nas outras.
 *
 * (A regra "sem uppercase" do DS é da PÍLULA/chip, que é um controle. Aqui o
 * elemento é um cabeçalho de seção, e ele precisa não competir com os itens.)
 */
function RotuloDeGrupo({ children }: { children: string }) {
  return (
    <h2 className="text-muted-foreground px-3 pb-1.5 text-[11px] font-medium tracking-wide uppercase">
      {children}
    </h2>
  )
}

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
          <div key={grupo} className="mt-4 first:mt-0">
            <RotuloDeGrupo>{ROTULOS_DE_GRUPO[grupo]}</RotuloDeGrupo>
            {/* `ul` para o leitor de tela anunciar quantos itens o bloco tem —
                o preflight do Tailwind já tira marcador e recuo. */}
            <ul className="flex flex-col gap-1">
              {doGrupo.map((item) => (
                <li key={item.to}>
                  <ItemDoRail item={item} />
                </li>
              ))}
            </ul>
          </div>
        )
      })}

      {/* As ferramentas caem no rodapé: são do app, não do produto, e
          misturá-las aos módulos daria a elas o mesmo peso das análises. */}
      <div className="mt-auto pt-6">
        <RotuloDeGrupo>{ROTULO_DE_FERRAMENTAS}</RotuloDeGrupo>
        <ul className="flex flex-col gap-1">
          {navFerramentas.map((item) => (
            <li key={item.to}>
              <ItemDoRail item={item} />
            </li>
          ))}
        </ul>
      </div>
    </nav>
  )
}
