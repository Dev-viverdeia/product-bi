import { createContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'

import type { Tables } from '@/types/database.types'

export type Profile = Pick<
  Tables<'profiles'>,
  'id' | 'email' | 'full_name' | 'avatar_url' | 'role'
>

export type AuthContextValue = {
  session: Session | null
  user: User | null
  profile: Profile | null
  /** true até a sessão inicial ser resolvida — evite redirecionar antes disso */
  isLoading: boolean
  signIn: (email: string, password: string) => Promise<void>
  /**
   * Não existe signUp: a criação de conta é fechada no Supabase e o acesso é
   * concedido pelo time. Quem entra vê o BI inteiro — nomes e e-mails de
   * cliente inclusive —, então quem recebe a conta É o controle de acesso.
   */
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
