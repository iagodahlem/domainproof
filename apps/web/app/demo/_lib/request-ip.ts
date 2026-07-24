/**
 * Next.js 15 dropped `NextRequest.ip` — the platform in front of it is
 * expected to supply the connecting client's IP via a header instead.
 *
 * `x-vercel-forwarded-for` is set by Vercel's edge network itself, which
 * overwrites any value of the same name a client sends — this app deploys
 * to Vercel (see `apps/web`'s README), so that's the trustworthy source.
 * Plain `x-forwarded-for` is NOT trustworthy as a primary source: a client
 * can set it directly on its own request, and it's conventional for each
 * hop to *append* its observed peer to the end of the chain rather than
 * replace it, so blindly taking `.split(',')[0]` picks the client's own
 * (attacker-controlled) claim, not whatever a real proxy appended — which
 * is exactly how the per-IP rate limits on `/demo/api/scan` and
 * `/demo/api/claim` would collapse to "rotate the header". It's kept only
 * as a fallback for local dev, where there's no Vercel edge in front to
 * set the trusted header. Falls back further to a constant bucket key
 * when nothing is present, rather than throwing.
 */
export function clientIpFromHeaders(headers: Headers): string {
  const vercelForwardedFor = headers.get('x-vercel-forwarded-for')
  if (vercelForwardedFor) {
    return vercelForwardedFor.split(',')[0]?.trim() || 'unknown'
  }
  const forwardedFor = headers.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() || 'unknown'
  }
  return headers.get('x-real-ip') ?? 'unknown'
}
