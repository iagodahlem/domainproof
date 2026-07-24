import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import type { NextRequest } from 'next/server'

/**
 * Project routes live at the root (`/<projectId>/...`), so there's no
 * `/dashboard` prefix left to protect by — a project id is caller-generated
 * and unpredictable, so it can never be enumerated as an allowlist the way
 * the handful of public routes can. Protect by exception instead: the
 * marketing pages, the docs site, the hosted verification portal (its own
 * per-token `frontendToken` auth, no Clerk session), the anonymous demo
 * consumer app, and the sign-in callback are public; everything else —
 * `/app`, `/new`, and every `[projectId]` route — requires a signed-in
 * builder.
 */
const isPublicRoute = createRouteMatcher([
  '/',
  '/design-system',
  '/sso-callback',
  '/verify(.*)',
  '/docs(.*)',
  '/demo(.*)',
])

/**
 * Every single-segment path is a project route match (`/<projectId>/...`
 * above), so a logged-out hit on an unpredictable or mistyped path would
 * otherwise bounce straight to hosted Clerk sign-in with no sign-in button
 * ever clicked. Send it to the landing page instead — it carries the
 * sign-in CTA — and keep the original path as `redirect_url` so a future
 * landing-side handler can round-trip it.
 */
function loggedOutRedirectUrl(req: NextRequest) {
  const url = new URL('/', req.url)
  url.searchParams.set(
    'redirect_url',
    req.nextUrl.pathname + req.nextUrl.search,
  )
  return url.toString()
}

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect({ unauthenticatedUrl: loggedOutRedirectUrl(req) })
  }
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
