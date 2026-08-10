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
