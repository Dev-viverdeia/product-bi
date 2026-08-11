import { Fragment, useDeferredValue, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { ChevronLeftIcon, ChevronRightIcon, SearchIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableHeader } from '@/components/ui/table'
import { formatInt } from '@/lib/format'
import { fatiar, POR_PAGINA, precisaControles } from '@/lib/paginacao'

/**
 * Lista nominal com busca e paginação.
 *
 * Filtra e pagina em memória, sobre as linhas que a RPC já devolveu — lista de
 * ação com centenas de nomes e sem filtro é lista que ninguém usa.
 *
 * **Busca e paginação aparecem só quando pagam o próprio espaço.** Caixa de
 * busca sobre uma tabela de 6 linhas é ruído: o olho acha mais rápido que a
 * mão digita. Abaixo de uma página, a tabela renderiza limpa.
 *
 * `limiteDaFonte` existe porque a honestidade aqui é parte do produto: quando a
 * RPC corta em N linhas, a busca alcança só essas N. Sem declarar isso, o
 * usuário conclui que "não achou = não existe", e o rodapé mentiria sobre o
 * tamanho real da base.
 */
export function TabelaLonga<T>({
  linhas,
  buscarEm,
  chave,
  cabecalho,
  renderLinha,
  rotuloBusca = 'Buscar por nome ou e-mail',
  limiteDaFonte,
  porPagina = POR_PAGINA,
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
  porPagina?: number
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

  const { totalPaginas, atual: paginaAtual, inicio, fim } = fatiar(
    filtradas.length,
    pagina,
    porPagina,
  )
  const visiveis = filtradas.slice(inicio, fim)

  const buscando = termoAplicado.trim().length > 0
  const cortada = limiteDaFonte != null && linhas.length >= limiteDaFonte
  // controles só quando a lista não cabe de uma vez
  const temControles = precisaControles(linhas.length, porPagina)
  const mostraRodape = temControles || buscando || cortada

  return (
    <div className="flex h-full flex-col gap-3">
      {temControles ? (
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
      ) : null}

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

      {mostraRodape ? (
        <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-2 text-xs">
          <span>
            {filtradas.length === 0
              ? 'Nenhum registro'
              : `Mostrando ${formatInt(inicio + 1)}–${formatInt(fim)} de ${formatInt(filtradas.length)}`}
            {cortada && limiteDaFonte != null
              ? ` · a consulta traz no máximo ${formatInt(limiteDaFonte)}, então a busca alcança só esses`
              : ''}
          </span>

          {totalPaginas > 1 ? (
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="size-8"
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
                className="size-8"
                onClick={() => setPagina((p) => Math.min(p + 1, totalPaginas - 1))}
                disabled={paginaAtual >= totalPaginas - 1}
                aria-label="Próxima página"
              >
                <ChevronRightIcon className="size-4" />
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
