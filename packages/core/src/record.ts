/**
 * Everything about the shape of a DomainProof verification record — the DNS
 * host a TXT record must be published at, the well-known HTTP path, and the
 * record value's prefix/parsing — lives here. This module is pure string
 * construction and parsing: it never decides which brand slug is valid or
 * what a builder's default brand is (that's account/project policy, owned
 * by the api's `modules/projects` layer). Every function below takes
 * `brandSlug` as a required parameter for exactly that reason — core has no
 * notion of a "default" brand to fall back to.
 */

/**
 * The TXT record host a domain owner must publish to prove control, e.g.
 * `_skylane-challenge.dashboard.api.acme.com` for the claimed hostname
 * `dashboard.api.acme.com` under the brand `skylane`.
 *
 * Rooted at the exact claimed hostname, not its registrable domain
 * (eTLD+1): a record at `_x.<domain>` is a child label of `domain`, never a
 * record placed AT `domain` itself, so there's no CNAME-conflict risk in
 * publishing one per subdomain. Doing it this way also keeps the claim
 * honest — a record published at the registrable domain only proves
 * control of that eTLD+1, not of the specific subdomain being claimed —
 * and keeps a builder's DNS zone legible, since each record's name visibly
 * belongs to the claim that asked for it instead of every subdomain claim
 * piling multiple TXT records onto one eTLD+1 name.
 *
 * Trust boundary: this function does not validate `brandSlug` beyond
 * trusting its type. Validation (format, reserved-word checks) happens at
 * the edge, before a slug is ever stored or reaches this function, so it
 * stays a pure string-formatting step.
 */
export function challengeHost(domain: string, brandSlug: string): string {
  return `_${brandSlug}-challenge.${domain}`
}

/**
 * Builds the TXT record value prefix for a given brand, e.g.
 * `skylane-verify=` for the brand slug `skylane`.
 */
export function recordValuePrefix(brandSlug: string): string {
  return `${brandSlug}-verify=`
}

/**
 * Builds the full TXT record value a domain owner is asked to publish.
 * `brandSlug` white-labels the value under a builder's brand — a branded
 * record is a distinct namespace, not decoration: it only matches
 * {@link parseRecordValue} calls made with the same brand slug.
 */
export function recordValue(token: string, brandSlug: string): string {
  return `${recordValuePrefix(brandSlug)}${token}`
}

export type ParsedRecordValue = { ok: true; token: string } | { ok: false }

/**
 * Parses a raw TXT (or well-known file line) record string back into a
 * token. DNS tooling and hand-edited files are messy about formatting —
 * `dig` output, hand-copied zone files, and some registrar UIs wrap TXT
 * values in double quotes or leave trailing whitespace/newlines — so this
 * trims surrounding whitespace and a single pair of enclosing quotes before
 * checking the prefix. The prefix check itself stays strict (no partial
 * matches, no case folding): the values this module generates are always
 * lowercase, so a case mismatch signals a hand-edited or corrupted record,
 * which should fail to parse rather than silently succeed.
 *
 * `brandSlug` selects which brand's prefix to parse against. A record
 * published under one brand does not parse under a different brand's
 * prefix — brands are namespaces.
 */
export function parseRecordValue(
  value: string,
  brandSlug: string,
): ParsedRecordValue {
  const prefix = recordValuePrefix(brandSlug)
  let trimmed = value.trim()

  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    trimmed = trimmed.slice(1, -1).trim()
  }

  if (!trimmed.startsWith(prefix)) {
    return { ok: false }
  }

  const token = trimmed.slice(prefix.length)

  if (token.length === 0) {
    return { ok: false }
  }

  return { ok: true, token }
}

/**
 * Builds the well-known URL a domain owner is asked to publish the
 * challenge file at. HTTPS only, never `http://`: an ownership proof
 * fetched over plaintext HTTP can be forged or substituted by anyone on the
 * network path between the checker and the domain (a coffee-shop Wi-Fi
 * operator, a compromised router, a transparent proxy) — they'd simply
 * inject the response they want us to see. HTTPS's certificate validation
 * is what ties the response back to a party who actually controls the
 * domain (or at least holds a CA-issued cert for it), which is the entire
 * point of the check.
 */
export function wellKnownUrl(domain: string, brandSlug: string): string {
  return `https://${domain}/.well-known/${brandSlug}-challenge`
}
