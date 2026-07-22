import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

/**
 * `/new` (locked create-project) and `/dashboard` both require a signed-in
 * builder — everything else (landing, docs, the sso callback) is public.
 */
const isProtectedRoute = createRouteMatcher(['/dashboard(.*)', '/new(.*)'])

export default clerkMiddleware(async (auth, req) => {
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
