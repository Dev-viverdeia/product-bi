import { Component, type ErrorInfo, type ReactNode } from 'react'
import { RotateCcwIcon, TriangleAlertIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'

type FronteiraProps = {
  children: ReactNode
  /**
   * `modulo`: o erro é de uma tela e o shell continua de pé — dá para navegar
   * para outro módulo sem recarregar nada.
   * `app`: o erro é do próprio shell, e a única saída é recarregar.
   */
  escopo: 'modulo' | 'app'
}

type FronteiraState = { erro: Error | null }

/**
 * Fronteira de erro de renderização.
 *
 * **Por que existe:** não havia nenhuma. Um `throw` em qualquer uma das
 * quatorze rotas derrubava o app inteiro para tela branca — sem mensagem, sem
 * recuperação e sem pista. O produto trata com esmero o erro de CARD
 * (`isError`, `onRetry`, esqueleto, vazio) e não tratava o erro de TELA.
 *
 * **Duas, aninhadas, e o aninhamento é o ponto.** A de dentro vive no
 * `AppLayout` e envolve só o `Outlet`: erro de módulo não pode custar a barra e
 * o rail, senão a saída de uma tela quebrada vira recarregar a página para
 * conseguir ir a outro lugar. A de fora envolve as rotas inteiras e cobre o que
 * a de dentro não alcança — o login, o 404 e o próprio shell.
 *
 * **Precisa ser classe.** React 19 continua sem hook para capturar erro de
 * renderização, e o projeto não tem `react-error-boundary` — nem vale uma
 * dependência para trinta linhas.
 *
 * ⚠️ **Quem monta esta peça reseta pela chave, não por dentro.** Sem
 * `key={pathname}` no ponto de uso, o estado de erro sobrevive à navegação
 * seguinte e a próxima tela nasce quebrada sem nunca ter sido renderizada — o
 * defeito passa a parecer estar em toda parte.
 *
 * O erro vai para o console em vez de sumir: não há coletor de telemetria no
 * projeto, e engolir a exceção trocaria uma tela branca por uma tela bonita e
 * igualmente muda para quem for investigar.
 */
export class FronteiraDeErro extends Component<FronteiraProps, FronteiraState> {
  state: FronteiraState = { erro: null }

  static getDerivedStateFromError(erro: Error): FronteiraState {
    return { erro }
  }

  componentDidCatch(erro: Error, info: ErrorInfo) {
    console.error(`[fronteira-de-erro:${this.props.escopo}]`, erro, info.componentStack)
  }

  render() {
    const { erro } = this.state
    if (!erro) return this.props.children

    const daTela = this.props.escopo === 'modulo'

    return (
      <div
        role="alert"
        className="glass-card flex flex-col items-center justify-center gap-4 rounded-lg px-6 py-16 text-center"
      >
        <span className="bg-controle text-muted-foreground grid size-11 place-items-center rounded-md">
          <TriangleAlertIcon aria-hidden className="size-5" strokeWidth={1.75} />
        </span>

        <div className="max-w-[52ch] space-y-1.5">
          <p className="text-base font-medium tracking-tight">
            {daTela ? 'Esta tela não conseguiu ser desenhada.' : 'O aplicativo parou de responder.'}
          </p>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {daTela
              ? 'O erro é desta tela — as outras continuam funcionando, e o menu ao lado segue valendo. Nenhum dado foi alterado: o BI só lê.'
              : 'Nenhum dado foi alterado: o BI só lê. Recarregar costuma resolver; se voltar a acontecer, o detalhe técnico está no console do navegador.'}
          </p>
          {/* A mensagem crua fica visível de propósito. Quem abre este BI é o
              time que também consegue agir sobre o erro, e "algo deu errado"
              sem o quê obriga a pessoa a abrir o console para conseguir dizer o
              que aconteceu. */}
          <p className="text-muted-foreground/80 font-mono text-xs break-words">{erro.message}</p>
        </div>

        {daTela ? (
          <Button variant="outline" size="sm" onClick={() => this.setState({ erro: null })}>
            <RotateCcwIcon aria-hidden />
            Tentar desenhar de novo
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
            <RotateCcwIcon aria-hidden />
            Recarregar a página
          </Button>
        )}
      </div>
    )
  }
}
