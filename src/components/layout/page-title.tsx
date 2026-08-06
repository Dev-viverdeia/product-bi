import { useLocation } from 'react-router'

import { navItems } from '@/components/layout/nav-items'

export function PageTitle() {
  const { pathname } = useLocation()

  const current =
    navItems.find((item) =>
      item.matchPrefix ? pathname.startsWith(item.to) : pathname === item.to,
    ) ?? null

  return (
    <h1 className="truncate text-sm font-medium">{current?.title ?? 'Product BI'}</h1>
  )
}
