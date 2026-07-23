'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { Header } from '@domainproof/ui'
import {
  DASHBOARD_NAV_ITEMS,
  isNavItemActive,
  MODE_TOGGLE_SEGMENTS,
} from './nav-items'
import { ModeSwitch } from './mode-switch'
import { useTopbarSlotContent } from './topbar-slot'

export interface TopbarProps {
  projectId: string
}

/**
 * The dashboard's single header system — every page's title, back link
 * (domain detail), mode toggle, and primary action button render here
 * instead of in the page body, so the chrome is consistent across
 * domains/webhooks/events/settings. Title/back/action come from whichever
 * page has registered a `useTopbarSlot` override (see `./topbar-slot`);
 * absent that, the title falls back to the active nav route's label. The
 * mode toggle's visibility is route-derived rather than opt-in per page —
 * `MODE_TOGGLE_SEGMENTS` names the routes whose data the toggle actually
 * changes (`nav-items.ts`), which also covers a domain's own detail page for
 * free since its path starts with the `domains` segment.
 */
export function Topbar({ projectId }: TopbarProps) {
  const pathname = usePathname()
  const slot = useTopbarSlotContent()
  const activeItem = DASHBOARD_NAV_ITEMS.find((item) =>
    isNavItemActive(pathname, projectId, item.segment),
  )
  const showModeToggle = MODE_TOGGLE_SEGMENTS.some((segment) =>
    pathname.startsWith(`/${projectId}/${segment}`),
  )

  return (
    <Header
      variant="solid"
      left={
        <div className="flex items-center gap-3">
          {slot?.back ? (
            <Link
              href={slot.back.href}
              aria-label={slot.back.label}
              className="text-faint-foreground transition-colors duration-150 hover:text-foreground"
            >
              <ChevronLeft aria-hidden="true" size={16} />
            </Link>
          ) : null}
          {slot?.title ?? (
            <h1 className="text-base font-heading text-foreground">
              {activeItem?.label ?? 'Dashboard'}
            </h1>
          )}
        </div>
      }
      right={
        showModeToggle || slot?.action ? (
          <div className="flex items-center gap-3">
            {showModeToggle ? <ModeSwitch /> : null}
            {slot?.action}
          </div>
        ) : undefined
      }
    />
  )
}
