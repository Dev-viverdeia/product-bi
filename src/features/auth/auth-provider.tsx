import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'
import { AuthContext, type Profile } from '@/features/auth/auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [session, setSession] = useState<Session | null>(null)
  const [isSessionLoading, setIsSessionLoading] = useState(true)

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setIsSessionLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next)
      setIsSessionLoading(false)
      if (event === 'SIGNED_OUT') {
        queryClient.clear()
      }
    })

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [queryClient])

  const userId = session?.user.id ?? null

  const { data: profile } = useQuery({
    queryKey: ['profile', userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<Profile | null> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, avatar_url, role')
        .eq('id', userId!)
        .maybeSingle()

      if (error) throw error
      return data
    },
  })

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }, [])

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }, [])

  const value = useMemo(
    () => ({
      session,
      user: (session?.user ?? null) as User | null,
      profile: profile ?? null,
      isLoading: isSessionLoading,
      signIn,
      signOut,
    }),
    [session, profile, isSessionLoading, signIn, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
