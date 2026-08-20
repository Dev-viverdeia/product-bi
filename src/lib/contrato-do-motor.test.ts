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
 * Corpo de cada função do motor — do cabeçalho até o fecho do próprio corpo.
 *
 * ⚠️ **O corpo termina na tag de cifrão que o ABRIU**, e isto foi descoberto do
 * jeito caro. A primeira versão procurava a string `'$$;'` a partir do
 * cabeçalho; as migrations do motor abrem com `$function$`, não com `$$`. Esse
 * `indexOf` nunca casava com o fecho certo: ou devolvia -1, e o "corpo" virava
 * todo o SQL dali até o fim do arquivo concatenado, ou parava num `$$;` de uma
 * migration bem posterior.
 *
 * Enquanto o texto engolido não citasse `marts.` nem `etl.`, o teste passava
 * por acidente — verde por sorte, não por acerto. Quebrou no dia em que uma
 * migration ganhou um `comment on function` explicando de qual mart a régua
 * saiu, ou seja, reprovando de novo a migration mais bem documentada. É a mesma
 * armadilha que o bloco de limpeza de comentário abaixo já existia para evitar,
 * entrando por outra porta.
 *
 * Agora a tag é lida do próprio texto (`$function$`, `$$`, o que vier) e o
 * fecho é a próxima ocorrência DELA.
 */
function corposDoMotor(): { nome: string; corpo: string }[] {
  const encontrados: { nome: string; corpo: string }[] = []
  const abertura = /create (?:or replace )?function ([a-z_]+\.[a-z_]*achados[a-z_]*)\(/g
  let m: RegExpExecArray | null
  while ((m = abertura.exec(sqlCompleto)) !== null) {
    const tag = /\$[a-z_]*\$/.exec(sqlCompleto.slice(m.index))
    const inicioDoCorpo = tag ? m.index + tag.index + tag[0].length : m.index
    const fim = tag ? sqlCompleto.indexOf(tag[0], inicioDoCorpo) : -1
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
 *
 * Pega os gabaritos que entram por `insert`, onde os valores são posicionais e
 * não há nome de coluna para ancorar o casamento.
 */
function porMarcador(): string[] {
  return (sqlSemComentario.match(/'[^']*\{[a-z_]+(?::[a-z]+)?\}[^']*'/g) ?? []).map((s) =>
    s.slice(1, -1),
  )
}

/**
 * Gabaritos atribuídos por nome de coluna — `gabarito_acao = '…'`.
 *
 * ⚠️ **Esta metade existe porque a de cima tem um cego, e ele deixou passar um
 * dígito em 20/ago.** `porMarcador` casa literal que CARREGA MARCADOR; frase
 * sem nenhum marcador é invisível para ela. E é justo onde o número escrito na
 * mão tem mais chance de estar: quem não usou marcador é porque escreveu o
 * valor. O caso real foi uma leitura nova que citava o card "Usar IA na 1ª
 * semana muda a retenção?" pelo título — o `1` entrou, o teste passou verde, e
 * quem viu foi uma conferência à parte contra o banco.
 *
 * O cego era grande na prática: **correção de texto vira `update`, não
 * `insert`**, então toda frase corrigida sem marcador escapava da régua — que é
 * a metade do catálogo que mais muda.
 */
function porColuna(): string[] {
  const achados: string[] = []
  const atribuicao = /\b(?:gabarito|gabarito_leitura|gabarito_acao)\s*=\s*'((?:[^']|'')*)'/g
  let m: RegExpExecArray | null
  while ((m = atribuicao.exec(sqlSemComentario)) !== null) achados.push(m[1].replaceAll("''", "'"))
  return achados
}

function gabaritos(): string[] {
  return [...new Set([...porMarcador(), ...porColuna()])]
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
