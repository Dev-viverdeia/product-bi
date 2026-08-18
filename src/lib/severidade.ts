import type { TomDeStatus } from '@/components/ui-marca/status-pill'

/**
 * Vocabulário de severidade de achado.
 *
 * Vive aqui, e não na tela, porque agora tem dois leitores: a análise de cada
 * módulo e o plano de ação transversal. Duas cópias que um dia discordam
 * fariam o MESMO achado aparecer como "risco alto" numa tela e "atenção" na
 * outra — e o plano existe justamente para ser a versão única da lista.
 *
 * ⚠️ A severidade é um gradiente sobre um corte fixo (`atenção` em 1,5) e
 * **oscila**: parte das regras fica a menos de 0,05 do corte, então variação
 * mínima de dado troca o rótulo. É a pendência E do roadmap. Enquanto ela não
 * for decidida, o rótulo vale menos que a ORDEM — que é contínua e não tem
 * degrau.
 */
const TONS: Record<string, { tom: TomDeStatus; rotulo: string }> = {
  critico: { tom: 'critico', rotulo: 'risco alto' },
  atencao: { tom: 'atencao', rotulo: 'atenção' },
  neutro: { tom: 'neutro', rotulo: 'observação' },
}

export function lerSeveridade(severidade: string | null | undefined) {
  return TONS[severidade ?? ''] ?? TONS.neutro!
}
