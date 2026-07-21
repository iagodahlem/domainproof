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
