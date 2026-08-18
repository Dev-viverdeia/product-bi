import { lazy } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router'

import { AppLayout } from '@/components/layout/app-layout'
import { LoginPage } from '@/features/auth/login-page'
import { ProtectedRoute } from '@/features/auth/protected-route'
import { PublicOnlyRoute } from '@/features/auth/public-only-route'
import { NotFoundPage } from '@/pages/not-found-page'

// Login e 404 ficam no bundle inicial: são as telas que podem ser o primeiro
// paint de quem chega sem sessão, e adiar um chunk aqui só atrasa.
// Os módulos de produto carregam sob demanda — cada um traz o próprio peso de
// Recharts, e ninguém abre os nove de uma vez.
const VisaoGeralPage = lazy(() =>
  import('@/features/visao-geral/visao-geral-page').then((m) => ({ default: m.VisaoGeralPage })),
)
const PlanoDeAcaoPage = lazy(() =>
  import('@/features/plano/plano-page').then((m) => ({ default: m.PlanoDeAcaoPage })),
)
const ExplorarPage = lazy(() =>
  import('@/features/explorar/explorar-page').then((m) => ({ default: m.ExplorarPage })),
)
const ClientesPage = lazy(() =>
  import('@/features/clientes/clientes-page').then((m) => ({ default: m.ClientesPage })),
)
const EntradaPage = lazy(() =>
  import('@/features/entrada/entrada-page').then((m) => ({ default: m.EntradaPage })),
)
const FormacoesPage = lazy(() =>
  import('@/features/formacoes/formacoes-page').then((m) => ({ default: m.FormacoesPage })),
)
const SolucoesPage = lazy(() =>
  import('@/features/solucoes/solucoes-page').then((m) => ({ default: m.SolucoesPage })),
)
const IaPage = lazy(() => import('@/features/ia/ia-page').then((m) => ({ default: m.IaPage })))
const OrganizacoesPage = lazy(() =>
  import('@/features/organizacoes/organizacoes-page').then((m) => ({
    default: m.OrganizacoesPage,
  })),
)
const JornadaPage = lazy(() =>
  import('@/features/jornada/jornada-page').then((m) => ({ default: m.JornadaPage })),
)
const ReceitaPage = lazy(() =>
  import('@/features/receita/receita-page').then((m) => ({ default: m.ReceitaPage })),
)
const CsPage = lazy(() => import('@/features/cs/cs-page').then((m) => ({ default: m.CsPage })))
const RegrasPage = lazy(() =>
  import('@/pages/regras/regras-page').then((m) => ({ default: m.RegrasPage })),
)
const DesignPage = lazy(() =>
  import('@/pages/design/design-page').then((m) => ({ default: m.DesignPage })),
)

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<PublicOnlyRoute />}>
          <Route path="/login" element={<LoginPage />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          {/* O Suspense que segura estes chunks vive no AppLayout, em volta do
              Outlet, para o shell não piscar a cada troca de rota. */}
          <Route element={<AppLayout />}>
            <Route index element={<VisaoGeralPage />} />
            <Route path="/plano" element={<PlanoDeAcaoPage />} />
            <Route path="/explorar" element={<ExplorarPage />} />
            <Route path="/clientes" element={<ClientesPage />} />
            <Route path="/entrada" element={<EntradaPage />} />
            <Route path="/formacoes" element={<FormacoesPage />} />
            <Route path="/solucoes" element={<SolucoesPage />} />
            <Route path="/ia" element={<IaPage />} />
            <Route path="/organizacoes" element={<OrganizacoesPage />} />
            <Route path="/jornada" element={<JornadaPage />} />
            <Route path="/receita" element={<ReceitaPage />} />
            <Route path="/cs" element={<CsPage />} />
            <Route path="/regras" element={<RegrasPage />} />
            <Route path="/design" element={<DesignPage />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}
