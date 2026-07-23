import { redirect } from 'next/navigation'

/**
 * Legacy entry point, kept as a thin redirect so bookmarks and the
 * post-signin redirect (`sso-callback/page.tsx`'s `signIn/signUpFallbackRedirectUrl`)
 * keep working now that projects live at the root (`/<projectId>/...`)
 * rather than under `/dashboard`. Has no project context of its own — hand
 * off to the `[projectId]` shell with a placeholder segment; its layout
 * resolves the caller's actual active project (or `/new` if they have none
 * yet) and redirects to the canonical URL. Keeps project-list fetching and
 * error handling in that one place instead of duplicating it here.
 */
export default function DashboardPage() {
  redirect('/active')
}
