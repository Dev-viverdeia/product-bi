import { Fragment, useDeferredValue, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { ChevronLeftIcon, ChevronRightIcon, SearchIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableHeader } from '@/components/ui/table'
import { formatInt } from '@/lib/format'

const POR_PAGINA = 25

/**
 * Lista nominal com busca e paginação.
 *
 * Filtra e pagina em memória, sobre as linhas que a RPC já devolveu — lista de
 * ação com centenas de nomes e sem filtro é lista que ninguém usa.
 *
 * `limiteDaFonte` existe porque a honestidade aqui é parte do produto: quando a
 * RPC corta em N linhas, a busca alcança só essas N. Sem declarar isso, o
 * usuário conclui que "não achou = não existe", e o rodapé "312 de 312" mentiria
 * sobre uma base de milhares.
 */
export function TabelaLonga<T>({
  linhas,
  buscarEm,
  chave,
  cabecalho,
  renderLinha,
  rotuloBusca = 'Buscar por nome ou e-mail',
  limiteDaFonte,
  vazio = 'Nenhum registro para o período.',
}: {
  linhas: T[]
  /** campos varridos pela busca — devolva os textos pesquisáveis da linha */
  buscarEm: (linha: T) => (string | null | undefined)[]
  chave: (linha: T) => string
  /** o `<TableRow>` de cabeçalho */
  cabecalho: ReactNode
  /** o `<TableRow>` de uma linha */
  renderLinha: (linha: T) => ReactNode
  rotuloBusca?: string
  /** teto de linhas da RPC; se `linhas` bate nele, a tela avisa que há corte */
  limiteDaFonte?: number
  vazio?: string
}) {
  const [termo, setTermo] = useState('')
  const [pagina, setPagina] = useState(0)
  // digitar não deve travar a tabela: o filtro roda em prioridade menor
  const termoAplicado = useDeferredValue(termo)

  const filtradas = useMemo(() => {
    const t = termoAplicado.trim().toLowerCase()
    if (!t) return linhas
    return linhas.filter((linha) =>
      buscarEm(linha).some((campo) => campo?.toLowerCase().includes(t)),
    )
  }, [linhas, termoAplicado, buscarEm])

  const totalPaginas = Math.max(Math.ceil(filtradas.length / POR_PAGINA), 1)
  // uma busca nova pode encurtar a lista para menos páginas que a atual
  const paginaAtual = Math.min(pagina, totalPaginas - 1)
  const inicio = paginaAtual * POR_PAGINA
  const visiveis = filtradas.slice(inicio, inicio + POR_PAGINA)

  const buscando = termoAplicado.trim().length > 0
  const cortada = limiteDaFonte != null && linhas.length >= limiteDaFonte

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="relative">
        <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          value={termo}
          onChange={(e) => {
            setTermo(e.target.value)
            setPagina(0)
          }}
          placeholder={rotuloBusca}
          aria-label={rotuloBusca}
          className="pl-9"
        />
      </div>

      <div className="flex-1">
        {visiveis.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-sm">
            {buscando ? 'Nenhum resultado para esta busca.' : vazio}
          </p>
        ) : (
          <Table>
            <TableHeader>{cabecalho}</TableHeader>
            <TableBody>
              {visiveis.map((linha) => (
                <Fragment key={chave(linha)}>{renderLinha(linha)}</Fragment>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-2 text-xs">
        <span>
          {filtradas.length === 0
            ? 'Nenhum registro'
            : `Mostrando ${formatInt(inicio + 1)}–${formatInt(
                Math.min(inicio + POR_PAGINA, filtradas.length),
              )} de ${formatInt(filtradas.length)}`}
          {cortada && limiteDaFonte != null
            ? ` · a consulta traz no máximo ${formatInt(limiteDaFonte)}, então a busca alcança só esses`
            : ''}
        </span>

        {totalPaginas > 1 ? (
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="size-7"
              onClick={() => setPagina((p) => Math.max(p - 1, 0))}
              disabled={paginaAtual === 0}
              aria-label="Página anterior"
            >
              <ChevronLeftIcon className="size-4" />
            </Button>
            <span className="num px-1" aria-live="polite">
              {paginaAtual + 1}/{totalPaginas}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="size-7"
              onClick={() => setPagina((p) => Math.min(p + 1, totalPaginas - 1))}
              disabled={paginaAtual >= totalPaginas - 1}
              aria-label="Próxima página"
            >
              <ChevronRightIcon className="size-4" />
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
