import { useRef, useState } from 'react'
import type { RefObject } from 'react'
import { Link, NavLink, useLocation, useSearchParams } from 'react-router'
import { BarChart3Icon, ChevronDownIcon, LogOutIcon, MenuIcon } from 'lucide-react'
import { toast } from 'sonner'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { AlertaPipeline } from '@/components/layout/alerta-pipeline'
import { PARAM_ABA } from '@/components/layout/modulo-tabs'
import { navFerramentas, navItems } from '@/components/layout/nav-items'
import type { NavItem } from '@/components/layout/nav-items'
import { ThemeToggle } from '@/components/layout/theme-toggle'
import { useAuth } from '@/features/auth/use-auth'
import { comSegmento } from '@/lib/segmento'
import { cn } from '@/lib/utils'

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

/**
 * Estados do item sobre a barra escura.
 *
 * A barra tem superfície própria (`--nav-surface`), então os estados são
 * escritos em alfa do próprio texto em vez de tokens de página: `accent` e
 * `muted` são calibrados para fundo claro e sumiriam aqui.
 */
const itemBase =
  'relative flex items-center gap-1.5 text-sm font-medium whitespace-nowrap transition-colors ' +
  'focus-visible:ring-2 focus-visible:ring-nav-foreground/60 focus-visible:outline-none'

/**
 * Fundo do pill, idêntico nas duas metades.
 *
 * O item é DOIS elementos (link + seta) que precisam parecer um. Antes cada um
 * tinha o próprio hover, então passar o mouse acendia só a metade sob o cursor,
 * e abrir o menu deixava a seta destacada e o nome apagado. Aqui o estado é
 * decidido no pai e aplicado igual nos dois — o hover é do grupo.
 */
function fundoDoPill(destacado: boolean) {
  return destacado
    ? 'bg-nav-foreground/12 text-nav-foreground'
    : 'text-nav-foreground/65 group-hover/nav:bg-nav-foreground/8 group-hover/nav:text-nav-foreground'
}

/**
 * Atalho para as abas do módulo.
 *
 * Alvo de clique SEPARADO do link: clicar no nome vai para o módulo (caso comum,
 * não pode custar dois cliques) e a seta abre a lista. As abas vêm de
 * `nav-items.ts` — a mesma lista que a página renderiza.
 */
function AtalhoDeAbas({
  item,
  ancora,
  aberto,
  onAbrir,
  destacado,
}: {
  item: NavItem
  ancora: RefObject<HTMLDivElement | null>
  aberto: boolean
  onAbrir: (aberto: boolean) => void
  /** estado do pill inteiro, decidido no pai — as duas metades andam juntas */
  destacado: boolean
}) {
  const gatilho = useRef<HTMLButtonElement>(null)
  const [deslocamento, setDeslocamento] = useState(0)
  const [params] = useSearchParams()

  /*
    O menu abre ancorado na SETA, mas precisa parecer ancorado no item inteiro —
    alinhado à seta ele nasce torto em relação ao nome, que é o que a pessoa
    está olhando. Como a seta fica na ponta direita do pill, centralizar no item
    é deslocar meio pill para a esquerda. Medido ao abrir, porque a largura muda
    com o rótulo de cada módulo.
  */
  function aoAbrir(proximo: boolean) {
    onAbrir(proximo)
    if (!proximo) return
    const pill = ancora.current?.getBoundingClientRect()
    const seta = gatilho.current?.getBoundingClientRect()
    if (pill && seta) setDeslocamento(-((pill.width - seta.width) / 2))
  }

  return (
    <DropdownMenu open={aberto} onOpenChange={aoAbrir}>
      <DropdownMenuTrigger
        ref={gatilho}
        aria-label={`Abas de ${item.title}`}
        className={cn(
          // sem altura fixa: estica junto com o link pelo items-stretch do pai
          'focus-visible:ring-nav-foreground/60 flex items-center rounded-md rounded-l-none pr-2.5 pl-0.5 transition-colors focus-visible:ring-2 focus-visible:outline-none',
          '[&>svg]:transition-transform [&>svg]:duration-200 data-[state=open]:[&>svg]:rotate-180',
          fundoDoPill(destacado),
        )}
      >
        <ChevronDownIcon className="size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="center"
        alignOffset={deslocamento}
        sideOffset={10}
        // largura fixa: com min-w cada módulo abria um menu de tamanho diferente,
        // e percorrer a barra parecia desalinhado
        className="w-64 rounded-xl p-2"
      >
        <DropdownMenuLabel className="text-muted-foreground px-3 pt-1 pb-2 text-[11px] font-medium">
          {item.title}
        </DropdownMenuLabel>
        {item.abas?.map((aba, i) => (
          <DropdownMenuItem
            key={aba.valor}
            asChild
            className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-1 rounded-lg px-3 py-2.5 fill-mode-both"
            // cascata curta: dá direção ao movimento sem atrasar quem já sabe
            // onde vai clicar
            style={{ animationDelay: `${40 + i * 35}ms`, animationDuration: '180ms' }}
          >
            <Link to={comSegmento(`${item.to}?${PARAM_ABA}=${aba.valor}`, params)}>
              <aba.icone />
              {aba.titulo}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Par nome + seta: o `<div>` é a âncora que o menu usa para se centralizar. */
function ItemDeNavegacao({ item }: { item: NavItem }) {
  const ancora = useRef<HTMLDivElement>(null)
  const [aberto, setAberto] = useState(false)
  const { pathname } = useLocation()
  const [params] = useSearchParams()

  const naRota = item.matchPrefix ? pathname.startsWith(item.to) : pathname === item.to
  const destacado = naRota || aberto
  const temAbas = !!item.abas?.length

  return (
    // `items-stretch` alinha as duas metades: antes o link tinha 32px e a seta
    // 30px, com 1px de deslocamento — o pill fechava em degrau assim que
    // qualquer fundo acendia.
    <div ref={ancora} className="group/nav flex items-stretch">
      <NavLink
        to={comSegmento(item.to, params)}
        end={!item.matchPrefix && item.to === '/'}
        className={cn(
          itemBase,
          'rounded-md py-1.5 pl-3',
          temAbas ? 'rounded-r-none pr-1.5' : 'pr-3',
          fundoDoPill(destacado),
        )}
      >
        <item.icon className="hidden size-4 shrink-0 2xl:block" />
        {item.shortTitle}
      </NavLink>
      {temAbas ? (
        <AtalhoDeAbas
          item={item}
          ancora={ancora}
          aberto={aberto}
          onAbrir={setAberto}
          destacado={destacado}
        />
      ) : null}
    </div>
  )
}

function MenuUsuario() {
  const { profile, user, signOut } = useAuth()
  const displayName = profile?.full_name ?? user?.email ?? 'Usuário'
  const email = profile?.email ?? user?.email ?? ''

  async function handleSignOut() {
    try {
      await signOut()
    } catch (error) {
      toast.error('Não foi possível sair', {
        description: error instanceof Error ? error.message : 'Tente novamente.',
      })
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="focus-visible:ring-nav-foreground/60 rounded-full focus-visible:ring-2 focus-visible:outline-none"
        aria-label="Abrir menu da conta"
      >
        <Avatar className="ring-nav-foreground/20 size-9 ring-1">
          <AvatarFallback className="bg-nav-foreground/12 text-nav-foreground text-xs">
            {initials(displayName)}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="grid text-sm leading-tight">
            <span className="truncate font-medium">{displayName}</span>
            <span className="text-muted-foreground truncate text-xs">{email}</span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {navFerramentas.map((item) => (
          <DropdownMenuItem key={item.to} asChild>
            <Link to={item.to}>
              <item.icon />
              {item.title}
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={handleSignOut}>
          <LogOutIcon />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function NavMobile() {
  const [aberto, setAberto] = useState(false)
  const { pathname } = useLocation()
  const [params] = useSearchParams()

  return (
    <Sheet open={aberto} onOpenChange={setAberto}>
      <SheetTrigger
        className="text-nav-foreground/80 hover:bg-nav-foreground/10 hover:text-nav-foreground focus-visible:ring-nav-foreground/60 -ml-1 rounded-md p-2 focus-visible:ring-2 focus-visible:outline-none xl:hidden"
        aria-label="Abrir navegação"
      >
        <MenuIcon className="size-5" />
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0">
        <SheetHeader className="border-b">
          <SheetTitle>Navegação</SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col gap-0.5 p-2">
          {[...navItems, ...navFerramentas].map((item) => {
            const isActive = item.matchPrefix
              ? pathname.startsWith(item.to)
              : pathname === item.to

            return (
              <Link
                key={item.to}
                to={comSegmento(item.to, params)}
                onClick={() => setAberto(false)}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'focus-visible:ring-ring flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none',
                  isActive
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )}
              >
                <item.icon className="size-4 shrink-0" />
                {item.title}
              </Link>
            )
          })}
        </nav>
      </SheetContent>
    </Sheet>
  )
}

/**
 * Barra de navegação flutuante no topo.
 *
 * Escura sobre página clara — é a âncora de marca, e o contraste é o que faz o
 * mosaico abaixo respirar. Navy é componente aqui, não fundo de página.
 *
 * Abaixo de xl os dez itens não cabem lado a lado (medido: 1.189px só de
 * rótulos, com o alerta de pipeline no ar), então a lista vira um Sheet —
 * rolagem horizontal escondida em barra escura é armadilha de descoberta.
 */
export function AppHeader() {
  const [params] = useSearchParams()

  return (
    // O respiro acima da barra precisa de fundo próprio: sendo sticky, sem ele
    // o conteúdo rola visível por trás dessa faixa. Translúcido com blur, e não
    // sólido, porque .page-atmosphere é gradiente — um retângulo opaco criaria
    // uma emenda visível contra o radial.
    <header className="bg-background/70 supports-[backdrop-filter]:bg-background/50 sticky top-0 z-40 px-4 pt-4 backdrop-blur-md md:px-6 md:pt-6">
      <div className="bg-nav-surface text-nav-foreground flex h-14 items-center gap-2 rounded-lg px-3 shadow-lg md:px-4">
        <NavMobile />

        <Link
          to={comSegmento('/', params)}
          className="focus-visible:ring-nav-foreground/60 flex items-center gap-2 rounded-md pr-2 focus-visible:ring-2 focus-visible:outline-none"
        >
          <span className="bg-nav-foreground/12 flex size-8 shrink-0 items-center justify-center rounded-md">
            <BarChart3Icon className="size-4" />
          </span>
          <span className="hidden text-sm font-semibold tracking-tight sm:inline">
            Product BI
          </span>
        </Link>

        {/* Ícone + rótulo: o ícone dá alvo de reconhecimento rápido e o rótulo
            desambigua — dez seções só com ícone viraria adivinhação. O ícone
            some antes do rótulo quando aperta (entra só em 2xl), porque entre
            os dois é o texto que carrega o significado. Régua MEDIDA com o
            alerta de pipeline no ar: rótulos = 1.189px (cabe a partir de xl),
            rótulos + ícones = 1.409px (cabe a partir de 2xl) — abaixo disso a
            barra estourava a página com scroll horizontal. */}
        <nav className="mx-auto hidden items-center gap-1 xl:flex" aria-label="Seções">
          {navItems.map((item) => (
            <ItemDeNavegacao key={item.to} item={item} />
          ))}
        </nav>

        {/* Ações circulares. O aviso de sync ocupa o lugar do sino e só existe
            quando há o que avisar. */}
        <div className="ml-auto flex items-center gap-1.5 xl:ml-0">
          <AlertaPipeline />
          <ThemeToggle className="text-nav-foreground/80 hover:bg-nav-foreground/10 hover:text-nav-foreground focus-visible:ring-nav-foreground/60 size-9 rounded-full bg-white/10 hover:bg-white/16" />
          <MenuUsuario />
        </div>
      </div>
    </header>
  )
}
