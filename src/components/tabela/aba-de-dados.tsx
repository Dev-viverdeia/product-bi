import { ChevronDownIcon, DatabaseIcon } from 'lucide-react'
import { Collapsible } from 'radix-ui'

import { TabelaCard } from '@/components/tabela/tabela-card'
import { TabelaLonga } from '@/components/tabela/tabela-longa'
import { CelulaBruta, type LinhaBruta } from '@/components/tabela/celula-bruta'
import { TableHead, TableRow } from '@/components/ui/table'
import { formatInt } from '@/lib/format'
import { cn } from '@/lib/utils'

export type { LinhaBruta }

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

/**
 * A camada de dados de um módulo: as linhas que os cards da tela já leram.
 *
 * Cinco decisões que não são de gosto:
 *
 * - **Nenhuma consulta nova.** As linhas chegam prontas, das mesmas queries que
 *   desenham os gráficos. A aba não é uma segunda leitura do banco — se fosse,
 *   ela poderia divergir do card ao lado, que é o defeito que este projeto
 *   passou meses fechando em outras camadas. Aqui a garantia é estrutural: é o
 *   mesmo objeto em memória.
 * - **Nasce FECHADA, num só dobrável.** Ela desenha um `TabelaCard` completo
 *   por fonte — ícone, headline, descrição, busca, paginação — e são de 5 a 12
 *   por tela, sempre abertos no fim da aba `Gráficos`. Somadas as dez telas são
 *   **88 blocos**, contra 80 de cards de conteúdo: a camada de auditoria pesa
 *   mais que a análise inteira em Clientes e em CS. Dobrar devolve esse peso
 *   sem apagar um dígito — auditoria é para quando se duvida, não para o
 *   caminho de leitura.
 * - **A contagem fica FORA do dobrável.** Quantas funções e quantas linhas se
 *   lê sem clicar; é a mesma régua do `AcordeaoDeAchados` — o que fica atrás do
 *   clique é a profundidade, nunca o número que dá sentido ao título.
 * - **O nome da coluna aparece cru, e o nome da RPC também.** Nas outras
 *   camadas o rótulo em pt-BR é a regra; aqui ele atrapalharia. O que esta aba
 *   entrega é auditabilidade — quem abre quer saber exatamente qual função
 *   devolveu exatamente qual campo, para conferir no banco.
 * - **O tipo decide o formato, não o nome** — a régua está em `CelulaBruta`,
 *   compartilhada com a tela `Explorar`.
 * - **O corte é declarado** quando a RPC tem teto, pela `limiteDaFonte` da
 *   TabelaLonga: sem isso "não achei na busca" lê como "não existe".
 *
 * ⚠️ **Os cards daqui NÃO declaram `nivel`.** Eles não são degraus da escada de
 * profundidade — são a prova dos degraus. Enquanto declaravam `descritivo`
 * fixo, as páginas somavam 19 descritivos e o DOM entregava **107**, com teto
 * de 3 por tela: as oito telas aprovadas violavam a própria régua de 2,7× a
 * 4,7× naquilo que o navegador desenha. A régua não estava errada, estava
 * medindo o arquivo errado.
 */
export function AbaDeDados({ fontes }: { fontes: FonteDeDados[] }) {
  const linhasNoTotal = fontes.reduce((soma, f) => soma + (f.linhas?.length ?? 0), 0)

  return (
    <Collapsible.Root className="glass-card rounded-lg px-5 py-4">
      <Collapsible.Trigger
        className={cn(
          'group text-foreground flex w-full items-center gap-3 rounded-md text-left',
          'hover:text-primary active:text-primary/80',
          'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
        )}
      >
        <span className="bg-controle text-muted-foreground grid size-8 shrink-0 place-items-center rounded-md">
          <DatabaseIcon aria-hidden className="size-4" strokeWidth={1.75} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-medium tracking-tight">
            As linhas que esta tela leu
          </span>
          {/* Fora do dobrável de propósito: fechada, a linha já diz o tamanho do
              que está guardado. Sem isso o dobrável vira porta sem placa. */}
          <span className="text-muted-foreground num block text-xs tabular-nums">
            {formatInt(fontes.length)} {fontes.length === 1 ? 'função' : 'funções'} ·{' '}
            {formatInt(linhasNoTotal)} {linhasNoTotal === 1 ? 'linha' : 'linhas'}
          </span>
        </span>
        <ChevronDownIcon
          aria-hidden
          className="text-muted-foreground size-4 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180"
        />
      </Collapsible.Trigger>

      <Collapsible.Content
        className={cn(
          'overflow-hidden',
          'data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down',
        )}
      >
        <div className="space-y-4 pt-4">
          <p className="text-muted-foreground max-w-[68ch] text-sm leading-relaxed">
            Como o banco as devolveu. Cada bloco é uma função{' '}
            <code className="font-mono text-xs">bi_*</code> — o mesmo resultado que os gráficos
            acima desenham, sem nova consulta e sem reformatação. Números seguem a régua de cada
            função, inclusive a supressão por amostra, que aparece como travessão.
          </p>

          {fontes.map((fonte) => {
            const linhas = fonte.linhas ?? []
            const colunas = linhas[0] ? Object.keys(linhas[0]) : []

            return (
              <TabelaCard
                key={fonte.rpc}
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
                          <CelulaBruta key={c} valor={l[c]} />
                        ))}
                      </TableRow>
                    )}
                  />
                )}
              </TabelaCard>
            )
          })}
        </div>
      </Collapsible.Content>
    </Collapsible.Root>
  )
}
