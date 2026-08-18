import type { TomDeStatus } from '@/components/ui-marca/status-pill'

/**
 * Vocabulário do veredito de rastreio.
 *
 * `marts.rastreio_por_tipo()` responde há quanto tempo um tipo de evento não
 * registra — e só isso NÃO separa cano entupido de torneira fechada. Medido em
 * 18/08: dos quatro tipos parados, um era rastreio quebrado de verdade
 * (`solution_started`: o mart de progresso registrou 24 mil inícios depois de o
 * evento calar) e três eram de módulo encerrado — Comunidade e Networking
 * saíram do ar. Tratar os quatro como o mesmo problema publicaria diagnóstico
 * falso em três deles, e pediria conserto para sempre sobre produto que não
 * existe.
 *
 * Quem separa é `etl.corroborar_rastreio()`, que fecha módulo encerrado em
 * `descontinuado` e compara o resto com uma fonte independente do mesmo fato.
 * Este módulo é só a leitura em pt-BR do resultado.
 */

export const VEREDITOS = [
  'quebrado',
  'sem_uso',
  'sem_corroboracao',
  'descontinuado',
] as const

export type VereditoDeRastreio = (typeof VEREDITOS)[number]

export type LeituraDoVeredito = {
  rotulo: string
  tom: TomDeStatus
  explicacao: string
}

const LEITURAS: Record<VereditoDeRastreio, LeituraDoVeredito> = {
  quebrado: {
    rotulo: 'rastreio quebrado',
    tom: 'critico',
    explicacao: 'o fato continua acontecendo na origem e o evento não sai',
  },
  sem_uso: {
    rotulo: 'sem uso',
    tom: 'neutro',
    explicacao: 'a instrumentação está sadia — ninguém faz mais isso',
  },
  sem_corroboracao: {
    rotulo: 'sem corroboração',
    tom: 'atencao',
    explicacao: 'não há fonte independente espelhada para conferir o silêncio',
  },
  descontinuado: {
    rotulo: 'descontinuado',
    tom: 'neutro',
    explicacao: 'o módulo foi encerrado — não há rastreio a consertar',
  },
}

/**
 * Devolve `null` para tipo ativo (que não tem veredito) e para valor que o
 * banco venha a criar e a tela ainda não conheça — melhor não dizer nada do que
 * carimbar um estado com o rótulo errado.
 */
export function lerVeredito(veredito: string | null | undefined): LeituraDoVeredito | null {
  if (!veredito) return null
  return LEITURAS[veredito as VereditoDeRastreio] ?? null
}

/**
 * O número do headline. Conta só o que é comprovadamente cano entupido: quem
 * está sem corroboração pode estar quebrado e não há prova, e prova é o que
 * este card cobra dos outros.
 */
export function contarQuebrados(linhas: readonly { veredito: string | null }[]) {
  return linhas.filter((l) => l.veredito === 'quebrado').length
}

/**
 * Uma pílula só por linha, e não duas.
 *
 * Antes a tabela pintava `parado` de crítico. Com o veredito ao lado, a
 * Comunidade apareceria em vermelho ("parado") e em cinza ("sem uso") na mesma
 * linha — dois sinais contraditórios sobre o mesmo fato. O crítico passa a ser
 * reservado ao veredito, que é onde mora o julgamento; a recência continua
 * legível na coluna de dias.
 */
export function pilulaDoRastreio(status: string, veredito: string | null | undefined) {
  const leitura = lerVeredito(veredito)
  if (leitura) return { rotulo: leitura.rotulo, tom: leitura.tom }
  if (status === 'ativo') return { rotulo: 'em dia', tom: 'bom' as const }
  // Calou agora e o cron diário ainda não passou. Não é um estado de erro.
  return { rotulo: 'a verificar', tom: 'neutro' as const }
}

/**
 * A prova por trás do veredito, em uma linha. Existe porque a régua da casa é
 * que o número que sustenta a afirmação apareça na tela — inclusive quando a
 * afirmação é sobre o próprio instrumento.
 */
export function evidenciaDoVeredito(linha: {
  veredito: string | null
  fonte: string | null
  registros_na_fonte: number | null
}) {
  const { veredito, fonte, registros_na_fonte: registros } = linha
  if (!fonte || registros == null) {
    return veredito === 'sem_corroboracao' ? 'nenhuma fonte independente espelhada' : null
  }
  return registros > 0
    ? `${registros} registro(s) em ${fonte} depois dessa data`
    : `${fonte} também parou aí`
}
