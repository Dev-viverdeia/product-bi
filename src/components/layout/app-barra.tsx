import { useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router'
import { BarChart3Icon, LogOutIcon, MenuIcon } from 'lucide-react'
import { toast } from 'sonner'

import { AbaCanal } from '@/components/layout/aba-canal'
import { useAbaAtiva } from '@/components/layout/aba-do-modulo'
import { AlertaPipeline } from '@/components/layout/alerta-pipeline'
import { moduloDaRota, navFerramentas, navItems } from '@/components/layout/nav-items'
import { ThemeToggle } from '@/components/layout/theme-toggle'
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
import { useAuth } from '@/features/auth/use-auth'
import { comSegmento } from '@/lib/segmento'
import { cn } from '@/lib/utils'

function iniciais(nome: string) {
  return nome
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase())
    .join('')
}

function MenuUsuario() {
  const { profile, user, signOut } = useAuth()
  const nome = profile?.full_name ?? user?.email ?? 'Usuário'
  const email = profile?.email ?? user?.email ?? ''

  async function sair() {
    try {
      await signOut()
    } catch (erro) {
      toast.error('Não foi possível sair', {
        description: erro instanceof Error ? erro.message : 'Tente novamente.',
      })
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="focus-visible:ring-ring rounded-full focus-visible:ring-2 focus-visible:outline-none"
        aria-label="Abrir menu da conta"
      >
        <Avatar className="size-11">
          <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">
            {iniciais(nome)}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="grid text-sm leading-tight">
            <span className="truncate font-medium">{nome}</span>
            <span className="text-muted-foreground truncate text-xs">{email}</span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={sair}>
          <LogOutIcon />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Abaixo de `lg` o rail não cabe ao lado do conteúdo: vira gaveta. */
function NavegacaoEmGaveta() {
  const [aberto, setAberto] = useState(false)
  const { pathname } = useLocation()
  const [params] = useSearchParams()

  return (
    <Sheet open={aberto} onOpenChange={setAberto}>
      <SheetTrigger
        className="hover:bg-controle focus-visible:ring-ring ml-1 rounded-full p-2.5 focus-visible:ring-2 focus-visible:outline-none lg:hidden"
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
            const ativo = item.matchPrefix ? pathname.startsWith(item.to) : pathname === item.to
            return (
              <Link
                key={item.to}
                to={comSegmento(item.to, params)}
                onClick={() => setAberto(false)}
                aria-current={ativo ? 'page' : undefined}
                className={cn(
                  'focus-visible:ring-ring flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none',
                  ativo
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
 * Abas do módulo dentro da barra.
 *
 * A ativa é a `AbaCanal`; as demais são pílulas recessivas. A diferença entre
 * elas não é só cor: **as duas são cinza**, e o que distingue a ativa é ela ser
 * contínua com a tela abaixo em vez de ser uma pílula fechada. Marcar a ativa
 * com cor de destaque desfaria justamente isso.
 *
 * Só a partir de `lg`. A curva custa 160px de abertura, que em 375px seriam 43%
 * da tela — abaixo disso as abas viram uma fileira compacta fora da barra.
 */
function AbasNaBarra({ rota }: { rota: string }) {
  const { abas, ativa, trocar } = useAbaAtiva(rota)
  if (abas.length === 0) return null

  return (
    <div role="tablist" aria-label="Seções do módulo" className="hidden items-stretch lg:flex">
      {abas.map((aba) => {
        const estaAtiva = aba.valor === ativa
        const rotulo = (
          <>
            <aba.icone className="size-4 shrink-0" strokeWidth={1.75} />
            {aba.titulo}
          </>
        )

        return estaAtiva ? (
          <AbaCanal key={aba.valor}>
            <span
              role="tab"
              aria-selected
              className="flex items-center gap-2.5 text-[15px] font-medium whitespace-nowrap"
            >
              {rotulo}
            </span>
          </AbaCanal>
        ) : (
          <button
            key={aba.valor}
            type="button"
            role="tab"
            aria-selected={false}
            onClick={() => trocar(aba.valor)}
            className="bg-controle text-muted-foreground hover:text-foreground focus-visible:ring-ring my-auto ml-2.5 flex h-12 shrink-0 items-center gap-2.5 rounded-full px-5 text-[15px] font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            {rotulo}
          </button>
        )
      })}
    </div>
  )
}

/**
 * As mesmas abas abaixo de `lg`, fora da barra.
 *
 * A `AbaCanal` é uma afordância de desktop: a curva custa 160px de abertura, e
 * num telefone de 375px isso é 43% da tela gasto em forma. Aqui elas viram um
 * trilho de pílulas que rola na horizontal — a informação é a mesma, a forma é
 * que cede. Degradar assim é o contrário de esconder: as abas continuam todas
 * visíveis e alcançáveis.
 */
export function AbasCompactas({ className }: { className?: string }) {
  const { pathname } = useLocation()
  const modulo = moduloDaRota(pathname)
  const { abas, ativa, trocar } = useAbaAtiva(modulo?.to ?? '')

  if (abas.length === 0) return null

  return (
    <div
      role="tablist"
      aria-label="Seções do módulo"
      className={cn('bg-controle flex gap-1 overflow-x-auto rounded-full p-1', className)}
    >
      {abas.map((aba) => {
        const estaAtiva = aba.valor === ativa
        return (
          <button
            key={aba.valor}
            type="button"
            role="tab"
            aria-selected={estaAtiva}
            onClick={() => trocar(aba.valor)}
            className={cn(
              'focus-visible:ring-ring flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:outline-none',
              estaAtiva
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <aba.icone className="size-4 shrink-0" strokeWidth={1.75} />
            {aba.titulo}
          </button>
        )
      })}
    </div>
  )
}

/**
 * Barra do módulo — a peça de cromo do shell.
 *
 * Branca nos dois temas (no escuro, o degrau do card). Era navy até 13/ago e
 * deixou de ser por uma razão estrutural, não estética: a aba ativa virou um
 * canal da cor da página atravessando o cromo, e com a barra navy o canal
 * precisaria ser navy também — aí ele não se funde com a tela clara abaixo.
 *
 * Carrega marca, abas do módulo e as ações do app. **A busca global ainda não
 * está aqui**: se ela for paleta de comando de verdade, entra uma dependência
 * (`cmdk`), e essa é decisão de produto pendente. Espaço vazio é mais honesto
 * que um campo que não busca.
 */
export function AppBarra() {
  const { pathname } = useLocation()
  const [params] = useSearchParams()
  const modulo = moduloDaRota(pathname)

  return (
    <header className="bg-nav-surface mb-5 flex h-[var(--barra-altura)] items-center gap-2 rounded-2xl pr-3.5 shadow-md">
      <NavegacaoEmGaveta />

      <Link
        to={comSegmento('/', params)}
        className="focus-visible:ring-ring flex shrink-0 items-center gap-3.5 rounded-full py-1 pr-4 pl-3.5 focus-visible:ring-2 focus-visible:outline-none"
      >
        <span className="bg-primary text-primary-foreground flex size-12 shrink-0 items-center justify-center rounded-full">
          <BarChart3Icon className="size-5" strokeWidth={1.75} />
        </span>
        <span className="hidden text-xl font-semibold tracking-tight sm:inline">Product BI</span>
      </Link>

      {modulo ? <AbasNaBarra rota={modulo.to} /> : null}

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <AlertaPipeline />
        <ThemeToggle className="border-border size-11 rounded-full border" />
        <MenuUsuario />
      </div>
    </header>
  )
}
