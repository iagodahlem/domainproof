import type { ReactNode } from 'react'
import { QueryProvider } from '@/lib/query/provider'

/**
 * Boundary for every auth'd route (`/new`, `/dashboard/*`) — the narrowest
 * scope that covers every client mutation in the app, so the QueryClient
 * lives here rather than the root layout. No data fetching or redirect
 * logic here: `/new` and `/dashboard/[projectId]` need different header
 * chrome and the empty-projects redirect can't safely run in a layout that
 * also wraps `/new` itself (it would loop), so those stay in the segments
 * that actually need them.
 */
export default function DashboardGroupLayout({
  children,
}: {
  children: ReactNode
}) {
  return <QueryProvider>{children}</QueryProvider>
}
