import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { resolveActiveProjectPath } from '@/lib/project-resolution'

/**
 * The single resolver every "Dashboard" link and the post sign-in/sign-up
 * flow point to. Middleware already requires a session to reach here (see
 * middleware.ts) — the explicit signed-out redirect below is a
 * defense-in-depth fallback, not the primary guard. Renders nothing:
 * resolves the caller's active project (the same first-project rule
 * `[projectId]/layout.tsx` falls back to for a stale URL) and redirects
 * server-side, so no placeholder segment is ever visible.
 */
export default async function AppResolverPage() {
  const { userId, getToken } = await auth()
  if (!userId) {
    redirect('/')
  }

  redirect(await resolveActiveProjectPath(await getToken()))
}
