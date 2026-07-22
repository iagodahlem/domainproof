'use client'

import { usePathname } from 'next/navigation'
import { Header } from '@domainproof/ui'
import { DASHBOARD_NAV_ITEMS } from './nav-items'

export interface TopbarProps {
  projectId: string
}

/**
 * Page title is derived from the active nav route rather than passed in by
 * each page, so a page worker filling in domains/webhooks/events/settings
 * never has to touch this file to get its title right. The account menu
 * moved to the sidebar's bottom (board-conformant), so the right slot here
 * stays free for a page's own CTA (e.g. "Add domain").
 */
export function Topbar({ projectId }: TopbarProps) {
  const pathname = usePathname()
  const activeItem = DASHBOARD_NAV_ITEMS.find((item) =>
    pathname.startsWith(`/dashboard/${projectId}/${item.segment}`),
  )

  return (
    <Header
      variant="solid"
      left={
        <strong className="text-base font-heading text-foreground">
          {activeItem?.label ?? 'Dashboard'}
        </strong>
      }
    />
  )
}
