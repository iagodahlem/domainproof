export interface SecurityHeaderSpec {
  key: string
  label: string
}

/** Canonical header list shared by security-headers.ts (teaser count) and header-breakdown.ts (full per-header list) — one probe, two views of the same data. */
export const SECURITY_HEADERS: SecurityHeaderSpec[] = [
  { key: 'strict-transport-security', label: 'Strict-Transport-Security' },
  { key: 'content-security-policy', label: 'Content-Security-Policy' },
  { key: 'x-content-type-options', label: 'X-Content-Type-Options' },
  { key: 'x-frame-options', label: 'X-Frame-Options' },
  { key: 'referrer-policy', label: 'Referrer-Policy' },
  { key: 'permissions-policy', label: 'Permissions-Policy' },
  { key: 'cross-origin-opener-policy', label: 'Cross-Origin-Opener-Policy' },
  {
    key: 'cross-origin-resource-policy',
    label: 'Cross-Origin-Resource-Policy',
  },
  {
    key: 'cross-origin-embedder-policy',
    label: 'Cross-Origin-Embedder-Policy',
  },
  { key: 'x-xss-protection', label: 'X-XSS-Protection' },
  { key: 'x-dns-prefetch-control', label: 'X-DNS-Prefetch-Control' },
  {
    key: 'x-permitted-cross-domain-policies',
    label: 'X-Permitted-Cross-Domain-Policies',
  },
]

export interface HeaderEvaluation {
  present: SecurityHeaderSpec[]
  missing: SecurityHeaderSpec[]
}

export function evaluateSecurityHeaders(headers: Headers): HeaderEvaluation {
  const present: SecurityHeaderSpec[] = []
  const missing: SecurityHeaderSpec[] = []

  for (const spec of SECURITY_HEADERS) {
    if (headers.has(spec.key)) {
      present.push(spec)
    } else {
      missing.push(spec)
    }
  }

  return { present, missing }
}
