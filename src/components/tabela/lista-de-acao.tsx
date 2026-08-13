import type { ReactNode } from 'react'
import { Link } from 'react-router'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export type ItemDeAcao = {
  /** chave estável — id da entidade, nunca o índice */
  id: string
  /** quem: nome da pessoa, organização, formação */
  titulo: string
  /** contexto curto que desambigua o nome — org · plano, categoria · safra */
  subtitulo?: string
  /** o número que ordena a lista, já formatado com unidade */
  valor: string
}

function iniciais(nome: string) {
  return nome
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase())
    .join('')
}

/**
 * Lista curta de "sobre quem agir" — o degrau prescritivo da escada.
 *
 * Não é uma tabela encolhida. Tabela responde "como está distribuído"; esta
 * lista responde "com quem falar primeiro", e as diferenças de forma seguem
 * disso: sem cabeçalho de coluna (três campos não precisam de legenda), sem
 * paginação (uma lista de ação que passa de dez itens deixou de ser uma lista de
 * ação) e com um caminho explícito para o conjunto inteiro.
 *
 * ⚠️ **O `valor` chega FORMATADO, com a unidade escrita.** É o mesmo motivo da
 * `nota` do CategoryBarChart: sem a unidade no texto, "47" ao lado de um nome
 * pode ser dias, reais ou aulas, e quem lê completa com o palpite mais
 * conveniente. Formatar aqui dentro exigiria a lista saber a métrica, que é
 * exatamente o que ela não sabe.
 *
 * Lista nominal é o caso em que o contrato de PII admite valor no lugar de
 * chave — a análise exige identificar a pessoa para agir. O controle é de
 * ACESSO: quando o time entrar no BI, quem serve estes dados fica atrás de
 * `private.is_admin()`.
 */
export function ListaDeAcao({
  itens,
  verTodos,
  rodape,
  isLoading = false,
  vazio = 'Nada a listar no período.',
  className,
}: {
  itens: ItemDeAcao[]
  /** rota da lista completa, quando existe uma */
  verTodos?: { para: string; rotulo?: string }
  /** régua da lista: o critério que colocou alguém aqui */
  rodape?: ReactNode
  isLoading?: boolean
  vazio?: string
  className?: string
}) {
  if (isLoading) {
    return (
      <div className={cn('space-y-3', className)}>
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="size-9 shrink-0 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-32 rounded-md" />
              <Skeleton className="h-3 w-24 rounded-md" />
            </div>
            <Skeleton className="h-3.5 w-10 rounded-md" />
          </div>
        ))}
      </div>
    )
  }

  if (itens.length === 0) {
    return <p className={cn('text-muted-foreground text-sm', className)}>{vazio}</p>
  }

  return (
    <div className={cn('flex h-full flex-col', className)}>
      <ul className="divide-border -my-1 divide-y">
        {itens.map((item) => (
          <li key={item.id} className="flex items-center gap-3 py-3">
            <Avatar className="size-9 shrink-0">
              <AvatarFallback className="bg-controle text-muted-foreground text-[11px] font-medium">
                {iniciais(item.titulo)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{item.titulo}</p>
              {item.subtitulo ? (
                <p className="text-muted-foreground truncate text-xs">{item.subtitulo}</p>
              ) : null}
            </div>
            <span className="num text-sm font-medium whitespace-nowrap">{item.valor}</span>
          </li>
        ))}
      </ul>

      {rodape ? (
        <p className="text-muted-foreground mt-4 text-xs leading-snug">{rodape}</p>
      ) : null}

      {verTodos ? (
        <Link
          to={verTodos.para}
          className="text-foreground hover:text-muted-foreground focus-visible:ring-ring mt-auto pt-4 text-sm font-medium focus-visible:ring-2 focus-visible:outline-none"
        >
          {verTodos.rotulo ?? 'Ver todos'} →
        </Link>
      ) : null}
    </div>
  )
}
