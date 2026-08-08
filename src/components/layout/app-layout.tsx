import { Outlet } from 'react-router'

import { Separator } from '@/components/ui/separator'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { PageTitle } from '@/components/layout/page-title'
import { ThemeToggle } from '@/components/layout/theme-toggle'
import { AlertaPipeline } from '@/components/layout/alerta-pipeline'

export function AppLayout() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 !h-4" />
          <PageTitle />
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </header>
        <main className="page-atmosphere flex-1 space-y-4 overflow-x-hidden p-4 md:p-6">
          <AlertaPipeline />
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
