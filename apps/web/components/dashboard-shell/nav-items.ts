import { Activity, Globe, Settings, Zap } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface DashboardNavItem {
  segment: string
  label: string
  icon: LucideIcon
}

/**
 * Single source of truth for the sidebar's nav links and the topbar's
 * route-derived page title — so a page worker filling in one of these
 * routes never has to touch the sidebar or topbar to get its title right.
 */
export const DASHBOARD_NAV_ITEMS: DashboardNavItem[] = [
  { segment: 'domains', label: 'Domains', icon: Globe },
  { segment: 'webhooks', label: 'Webhooks', icon: Zap },
  { segment: 'events', label: 'Events', icon: Activity },
  { segment: 'settings', label: 'Settings', icon: Settings },
]

/**
 * Routes whose data the dashboard-wide test/live toggle actually changes —
 * `Topbar` shows the switch only here, never on settings. `domains` also
 * covers a domain's own detail page for free, since that route's path
 * starts with this same segment.
 */
export const MODE_TOGGLE_SEGMENTS = ['domains', 'webhooks', 'events']
