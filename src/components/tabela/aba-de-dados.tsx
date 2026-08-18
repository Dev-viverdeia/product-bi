import { DatabaseIcon } from 'lucide-react'

import { TabelaCard } from '@/components/tabela/tabela-card'
import { TabelaLonga } from '@/components/tabela/tabela-longa'
import { TableCell, TableHead, TableRow } from '@/components/ui/table'
import { formatDecimal, formatInt } from '@/lib/format'

/** Uma linha qualquer devolvida por uma RPC `bi_*`. */
export type LinhaBruta = Record<string, unknown>

export type FonteDeDados = {
  /** nome exato da RPC — é a régua de "de onde veio este número" */
  rpc: string
  /** a pergunta que ela responde, em pt-BR */
  titulo: string
  /** o que a tela desenha com isso, e a armadilha de leitura se houver */
  descricao?: string
  /** o resultado que a página JÁ carregou — nenhuma consulta nova é feita aqui */
  linhas: LinhaBruta[] | undefined
  isLoading?: boolean
  isError?: boolean
  onRetry?: () => void
  /** teto de linhas da RPC, quando ela corta */
  limite?: number
}

/** Célula: o tipo do valor decide o alinhamento, não o nome da coluna. */
function Celula({ valor }: { valor: unknown }) {
  if (valor === null || valor === undefined) {
    // Travessão e não vazio: célula em branco é indistinguível de erro de
    // renderização, e nulo aqui costuma ser supressão declarada pelo banco.
    return <TableCell className="text-muted-foreground">—</TableCell>
  }
  if (typeof valor === 'number') {
    return (
      <TableCell className="num text-right">
        {Number.isInteger(valor) ? formatInt(valor) : formatDecimal(valor)}
      </TableCell>
    )
  }
  if (typeof valor === 'boolean') {
    return <TableCell>{valor ? 'sim' : 'não'}</TableCell>
  }
  if (typeof valor === 'object') {
    return (
      <TableCell className="text-muted-foreground max-w-[28ch] truncate font-mono text-xs">
        {JSON.stringify(valor)}
      </TableCell>
    )
  }
  return <TableCell className="max-w-[40ch] truncate">{String(valor)}</TableCell>
}

/**
 * A camada de dados de um módulo: as linhas que os cards da tela já leram.
 *
 * Quatro decisões que não são de gosto:
 *
 * - **Nenhuma consulta nova.** As linhas chegam prontas, das mesmas queries que
 *   desenham os gráficos. A aba não é uma segunda leitura do banco — se fosse,
 *   ela poderia divergir do card ao lado, que é o defeito que este projeto
 *   passou meses fechando em outras camadas. Aqui a garantia é estrutural: é o
 *   mesmo objeto em memória.
 * - **O nome da coluna aparece cru, e o nome da RPC também.** Nas outras
 *   camadas o rótulo em pt-BR é a regra; aqui ele atrapalharia. O que esta aba
 *   entrega é auditabilidade — quem abre quer saber exatamente qual função
 *   devolveu exatamente qual campo, para conferir no banco.
 * - **O tipo decide o formato, não o nome.** Número vai à direita em mono,
 *   nulo vira travessão, jsonb vira o JSON. Adivinhar semântica pelo nome da
 *   coluna ("pct_" é percentual?) erraria em silêncio.
 * - **O corte é declarado** quando a RPC tem teto, pela `limiteDaFonte` da
 *   TabelaLonga: sem isso "não achei na busca" lê como "não existe".
 */
export function AbaDeDados({ fontes }: { fontes: FonteDeDados[] }) {
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground max-w-[68ch] text-sm leading-relaxed">
        As linhas que esta tela leu, como o banco as devolveu. Cada bloco é uma função{' '}
        <code className="font-mono text-xs">bi_*</code> — o mesmo resultado que os gráficos da
        aba ao lado desenham, sem nova consulta e sem reformatação. Números seguem a régua de
        cada função, inclusive a supressão por amostra, que aparece como travessão.
      </p>

      {fontes.map((fonte) => {
        const linhas = fonte.linhas ?? []
        const colunas = linhas[0] ? Object.keys(linhas[0]) : []

        return (
          <TabelaCard
            key={fonte.rpc}
            nivel="descritivo"
            icon={DatabaseIcon}
            title={fonte.titulo}
            headline={formatInt(linhas.length)}
            headlineLabel={linhas.length === 1 ? 'linha' : 'linhas'}
            description={`${fonte.rpc}${fonte.descricao ? ` · ${fonte.descricao}` : ''}`}
            isLoading={fonte.isLoading}
            isError={fonte.isError}
            onRetry={fonte.onRetry}
            linhasEsqueleto={4}
          >
            {colunas.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Nenhuma linha devolvida para o recorte atual.
              </p>
            ) : (
              <TabelaLonga
                linhas={linhas}
                chave={(l) => colunas.map((c) => String(l[c])).join('|')}
                buscarEm={(l) => colunas.map((c) => (l[c] == null ? null : String(l[c])))}
                rotuloBusca="Buscar em qualquer coluna"
                limiteDaFonte={fonte.limite}
                cabecalho={
                  <TableRow>
                    {colunas.map((c) => (
                      <TableHead key={c} className="font-mono text-xs">
                        {c}
                      </TableHead>
                    ))}
                  </TableRow>
                }
                renderLinha={(l) => (
                  <TableRow>
                    {colunas.map((c) => (
                      <Celula key={c} valor={l[c]} />
                    ))}
                  </TableRow>
                )}
              />
            )}
          </TabelaCard>
        )
      })}
    </div>
  )
}
