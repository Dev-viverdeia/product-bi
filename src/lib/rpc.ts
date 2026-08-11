/**
 * Desembrulha a resposta de uma RPC do Supabase: erro vira exceção (para o
 * TanStack Query tratar como erro e o ChartCard mostrar o estado de falha),
 * sucesso devolve só o dado.
 *
 * Erro silencioso num BI é pior que tela vazia — quem lê o número não tem como
 * saber que ele está errado. Por isso todo acesso a RPC passa por aqui.
 */
export async function rpc<T>(
  promise: PromiseLike<{ data: T | null; error: { message: string } | null }>,
) {
  const { data, error } = await promise
  if (error) throw new Error(error.message)
  return data
}

/**
 * Teto das listas nominais (as que existem para agir sobre alguém).
 *
 * Os valores anteriores eram 12–30 contra bases de centenas a milhares:
 * "Clientes em risco" pedia 30 de 3.828, "Power users" 15 de 3.347, "Masters ×
 * convites" 12 de 1.120, "Erros por tela" 12 de 437. Uma tela chamada "lista
 * para ação" mostrava menos de 1% da lista sem dizer — quem lê conclui que
 * aquilo É a lista.
 *
 * O conjunto inteiro cabe no cliente, então a busca alcança a base toda. O teto
 * fica alto só como trava contra crescimento inesperado, e a TabelaLonga
 * declara na tela se algum dia for atingido.
 */
export const LIMITE_LISTA = 5000
