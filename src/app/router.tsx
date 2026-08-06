import { BrowserRouter, Route, Routes } from 'react-router'

import { AppLayout } from '@/components/layout/app-layout'
import { LoginPage } from '@/features/auth/login-page'
import { ProtectedRoute } from '@/features/auth/protected-route'
import { PublicOnlyRoute } from '@/features/auth/public-only-route'
import { DesignPage } from '@/pages/design/design-page'
import { VisaoGeralPage } from '@/features/visao-geral/visao-geral-page'
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
            <Route path="/design" element={<DesignPage />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}
