import { Activity, Globe, LayoutDashboard, Settings, Zap } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface DashboardNavItem {
  /** Empty string for the project root (Overview) — every other item is a child segment. */
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
  { segment: '', label: 'Overview', icon: LayoutDashboard },
  { segment: 'domains', label: 'Domains', icon: Globe },
  { segment: 'webhooks', label: 'Webhooks', icon: Zap },
  { segment: 'events', label: 'Events', icon: Activity },
  { segment: 'settings', label: 'Settings', icon: Settings },
]

/**
 * Routes whose data the dashboard-wide test/live toggle actually changes —
 * `Topbar` shows the switch only here, never on settings or Overview.
 * `domains` also covers a domain's own detail page for free, since that
 * route's path starts with this same segment.
 */
export const MODE_TOGGLE_SEGMENTS = ['domains', 'webhooks', 'events']

/** A nav item's href — the empty Overview segment has no trailing slash. */
export function navItemHref(projectId: string, segment: string): string {
  return segment ? `/${projectId}/${segment}` : `/${projectId}`
}

/**
 * Whether `pathname` is "on" this nav item. Overview needs an exact match
 * (`/${projectId}`) since every other route's path is also, technically, a
 * path that continues past the project root — `startsWith` would leave it
 * permanently active.
 */
export function isNavItemActive(
  pathname: string,
  projectId: string,
  segment: string,
): boolean {
  return segment
    ? pathname.startsWith(`/${projectId}/${segment}`)
    : pathname === `/${projectId}`
}
