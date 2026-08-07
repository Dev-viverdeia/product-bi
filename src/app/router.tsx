import { BrowserRouter, Route, Routes } from 'react-router'

import { AppLayout } from '@/components/layout/app-layout'
import { LoginPage } from '@/features/auth/login-page'
import { ProtectedRoute } from '@/features/auth/protected-route'
import { PublicOnlyRoute } from '@/features/auth/public-only-route'
import { DesignPage } from '@/pages/design/design-page'
import { VisaoGeralPage } from '@/features/visao-geral/visao-geral-page'
import { ClientesPage } from '@/features/clientes/clientes-page'
import { EntradaPage } from '@/features/entrada/entrada-page'
import { FormacoesPage } from '@/features/formacoes/formacoes-page'
import { SolucoesPage } from '@/features/solucoes/solucoes-page'
import { IaPage } from '@/features/ia/ia-page'
import { OrganizacoesPage } from '@/features/organizacoes/organizacoes-page'
import { JornadaPage } from '@/features/jornada/jornada-page'
import { ReceitaPage } from '@/features/receita/receita-page'
import { NotFoundPage } from '@/pages/not-found-page'

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<PublicOnlyRoute />}>
          <Route path="/login" element={<LoginPage />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route index element={<VisaoGeralPage />} />
            <Route path="/clientes" element={<ClientesPage />} />
            <Route path="/entrada" element={<EntradaPage />} />
            <Route path="/formacoes" element={<FormacoesPage />} />
            <Route path="/solucoes" element={<SolucoesPage />} />
            <Route path="/ia" element={<IaPage />} />
            <Route path="/organizacoes" element={<OrganizacoesPage />} />
            <Route path="/jornada" element={<JornadaPage />} />
            <Route path="/receita" element={<ReceitaPage />} />
            <Route path="/design" element={<DesignPage />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}
