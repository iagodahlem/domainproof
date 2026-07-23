import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

/**
 * Project routes live at the root (`/<projectId>/...`), so there's no
 * `/dashboard` prefix left to protect by — a project id is caller-generated
 * and unpredictable, so it can never be enumerated as an allowlist the way
 * the handful of public routes can. Protect by exception instead: the
 * marketing pages, the hosted verification portal (its own per-token
 * `frontendToken` auth, no Clerk session), and the sign-in callback are
 * public; everything else — `/new` and every `[projectId]` route —
 * requires a signed-in builder.
 */
const isPublicRoute = createRouteMatcher([
  '/',
  '/design-system',
  '/sso-callback',
  '/verify(.*)',
])

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
