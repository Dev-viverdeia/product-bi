import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useAuth } from '@/features/auth/use-auth'

export function DashboardPage() {
  const { profile, user } = useAuth()
  const name = profile?.full_name ?? user?.email ?? ''

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground text-sm">
          {name ? `Bem-vindo, ${name}.` : 'Bem-vindo.'}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Base pronta</CardTitle>
          <CardDescription>
            Vite + React + TypeScript, Tailwind, shadcn/ui, React Router,
            TanStack Query e Supabase (auth por e-mail/senha com RLS).
          </CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          Os módulos do produto entram a partir daqui. Registre novas seções em{' '}
          <code className="bg-muted rounded px-1 py-0.5 text-xs">
            src/components/layout/nav-items.ts
          </code>{' '}
          e as rotas em{' '}
          <code className="bg-muted rounded px-1 py-0.5 text-xs">
            src/app/router.tsx
          </code>
          .
        </CardContent>
      </Card>
    </div>
  )
}
