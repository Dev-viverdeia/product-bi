import { describe, expect, it } from 'vitest'

/**
 * Contratos do motor de achados, verificados na migration.
 *
 * A migration é a fonte: o catálogo e as funções nascem dela, e é editando ela
 * que alguém quebraria as duas regras abaixo. Verificar aqui, e não no banco,
 * mantém o teste determinístico e sem credencial no CI.
 */

const migrations = Object.entries(
  import.meta.glob('../../supabase/migrations/*.sql', {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>,
).map(([caminho, sql]) => ({ caminho: caminho.split('/').pop()!, sql }))

const sqlCompleto = migrations.map((m) => m.sql).join('\n')

/**
 * Corpo de cada função do motor — tanto o calculador quanto o invólucro de
 * cache, do cabeçalho até o `$$;`.
 */
function corposDoMotor(): { nome: string; corpo: string }[] {
  const encontrados: { nome: string; corpo: string }[] = []
  const abertura = /create (?:or replace )?function ([a-z_]+\.[a-z_]*achados[a-z_]*)\(/g
  let m: RegExpExecArray | null
  while ((m = abertura.exec(sqlCompleto)) !== null) {
    const fim = sqlCompleto.indexOf('$$;', m.index)
    encontrados.push({
      nome: m[1]!,
      // Sem comentário: o que se verifica aqui é o que a função LÊ. As
      // migrations comentam de propósito de onde vem cada régua — "trinta
      // minutos é o interval de etl.sync_fact_navegacao" é documentação, não
      // uma segunda conta. Contar o comentário como leitura reprovaria
      // justamente a migration mais bem explicada.
      corpo: sqlCompleto
        .slice(m.index, fim === -1 ? undefined : fim)
        .replace(/--[^\n]*/g, ''),
    })
  }
  return encontrados
}

/**
 * SQL sem comentário de linha.
 *
 * Comentário precisa sair ANTES de procurar gabarito. A migration comenta as
 * próprias armadilhas e escreve marcadores no meio da prosa — `{mult:mult}` é
 * um deles. Com o comentário no bolo, a aspa de fechamento de um gabarito
 * emparelha com a aspa de abertura do seguinte e o "gabarito" extraído vira um
 * trecho de SQL com o comentário no meio. Foi exatamente o que quebrou aqui.
 */
const sqlSemComentario = sqlCompleto.replace(/--[^\n]*/g, '')

/**
 * Gabaritos do catálogo: literais entre aspas simples que carregam marcador.
 *
 * `''` é o escape de aspas do SQL e não aparece nos gabaritos atuais; se um dia
 * aparecer, o casamento quebra em vez de passar despercebido.
 */
function gabaritos(): string[] {
  return (sqlSemComentario.match(/'[^']*\{[a-z_]+(?::[a-z]+)?\}[^']*'/g) ?? []).map((s) =>
    s.slice(1, -1),
  )
}

describe('motor de achados só lê as funções que a tela lê', () => {
  /*
    O motor existe para que a frase do resumo carregue O MESMO número do card.
    No instante em que ele fosse buscar em `marts.` por conta própria, passariam
    a existir duas contas para o mesmo fato — e a que aparece em texto, com
    autoridade de conclusão, seria a que ninguém confere.
  */
  it('há função de motor para verificar', () => {
    expect(corposDoMotor().length).toBeGreaterThan(0)
  })

  it.each(corposDoMotor())('$nome', ({ corpo }) => {
    // `marts.data_referencia()` é a única exceção, e não é métrica: é a data
    // que compõe a chave do cache. Toda outra leitura de mart seria uma
    // segunda conta para um número que já existe numa função bi_*.
    const semExcecao = corpo.replaceAll('marts.data_referencia()', '')
    expect(semExcecao).not.toMatch(/\bmarts\./)
    expect(semExcecao).not.toMatch(/\betl\./)
  })
})

describe('gabarito não carrega número', () => {
  /*
    A régua viaja como parâmetro emitido pela mesma função que calcula o
    achado. Se a janela de churn virar 90 dias no banco, a frase acompanha
    sozinha — em vez de continuar dizendo "60 dias" para sempre, com cara de
    verdade.
  */
  it('há gabarito para verificar', () => {
    expect(gabaritos().length).toBeGreaterThan(5)
  })

  it.each(gabaritos())('%s', (gabarito) => {
    const semMarcadores = gabarito.replace(/\{[a-z_]+(?::[a-z]+)?\}/g, '')
    expect(semMarcadores).not.toMatch(/\d/)
  })
})

describe('a extração de gabarito não pegou SQL por engano', () => {
  /*
    O teste acima só vale se o que ele leu forem mesmo as frases do catálogo.
    Uma aspa perdida faz o casamento atravessar código e devolver um pedaço de
    consulta — que passa no teste do dígito por acidente e dá a impressão de
    cobertura onde não há nenhuma. Aqui a falsa extração falha alto.
  */
  it.each(gabaritos())('%s', (gabarito) => {
    expect(gabarito).not.toMatch(/\b(select|from|where|jsonb_build_object)\b/)
  })
})
