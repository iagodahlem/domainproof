/**
 * Next.js 15 dropped `NextRequest.ip` — the platform in front of it
 * (Vercel, or our own reverse proxy) is expected to set `x-forwarded-for`
 * instead. Falls back to a constant bucket key when neither header is
 * present (local dev without a proxy in front) rather than throwing.
 */
export function clientIpFromHeaders(headers: Headers): string {
  const forwardedFor = headers.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() || 'unknown'
  }
  return headers.get('x-real-ip') ?? 'unknown'
}
