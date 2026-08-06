import { Navigate, Outlet } from 'react-router'
import { Loader2Icon } from 'lucide-react'

import { useAuth } from '@/features/auth/use-auth'

/** Impede que um usuário já logado veja a tela de login. */
export function PublicOnlyRoute() {
  const { session, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Loader2Icon className="text-muted-foreground size-6 animate-spin" />
      </div>
    )
  }

  if (session) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
