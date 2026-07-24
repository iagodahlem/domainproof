/**
 * Builds the hosted verification page's absolute URL for a claim's
 * `frontendToken`, resolved against this app's own origin rather than a
 * hardcoded domain — the api can't know which origin (local/preview/prod)
 * the browser is actually on (see `DomainDetail.frontendToken`). Falls back
 * to the origin-relative path during server rendering, before `window`
 * exists; the client render right after hydration recomputes the absolute
 * form.
 */
export function hostedVerificationUrl(frontendToken: string): string {
  const path = `/verify/${frontendToken}`
  if (typeof window === 'undefined') return path
  return new URL(path, window.location.origin).toString()
}
