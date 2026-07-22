import { NextResponse } from 'next/server'
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

/**
 * `/new` (locked create-project) and `/dashboard` both require a signed-in
 * builder — everything else (landing, docs, the sso callback) is public.
 */
const isProtectedRoute = createRouteMatcher(['/dashboard(.*)', '/new(.*)'])

const APP_HOST = new URL(
  process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
).host
const MARKETING_HOST = new URL(
  process.env.NEXT_PUBLIC_MARKETING_URL ?? 'http://localhost:3000',
).host

/**
 * The one place every host rule lives — same approach the monorepo map
 * documents for routing docs./demo. to the web app, applied here for the
 * dashboard world. `/dashboard`, `/new`, and `/sso-callback` (Clerk's OAuth
 * callback — mounted only on this host) belong to app.domainproof.dev;
 * everything else (landing, `/design-system`, the hosted `/verify/:token`
 * page) belongs to the apex. Disabled outright when the two hosts coincide
 * — local dev's shared default — so nothing needs `/etc/hosts` tricks to
 * reach every route.
 */
const APP_PATH_PREFIXES = ['/dashboard', '/new', '/sso-callback']
const isAppPath = (pathname: string) =>
  APP_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )

export default clerkMiddleware(async (auth, req) => {
  if (APP_HOST !== MARKETING_HOST) {
    // `req.nextUrl.host` reflects the server's own bind address under a
    // self-hosted `next start`, not the domain a visitor actually
    // requested — the incoming `Host` header (what Vercel's edge sets to
    // the real custom domain, `x-forwarded-host` behind any further
    // proxy) is the one that's actually host-aware.
    const host =
      req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? ''
    const { pathname, search, protocol } = req.nextUrl
    let targetHost: string | undefined
    if (host === APP_HOST && !isAppPath(pathname)) {
      targetHost = MARKETING_HOST
    } else if (host === MARKETING_HOST && isAppPath(pathname)) {
      targetHost = APP_HOST
    }

    if (targetHost) {
      return NextResponse.redirect(
        new URL(`${pathname}${search}`, `${protocol}//${targetHost}`),
      )
    }
  }

  if (isProtectedRoute(req)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
