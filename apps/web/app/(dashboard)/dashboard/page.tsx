import { redirect } from 'next/navigation'

/**
 * `/dashboard` alone has no project context to render — hand off to the
 * `[projectId]` shell with a placeholder segment; its layout resolves the
 * caller's actual active project (or `/new` if they have none yet) and
 * redirects to the canonical URL. Keeps project-list fetching and error
 * handling in that one place instead of duplicating it here.
 */
export default function DashboardPage() {
  redirect('/dashboard/active/domains')
}
