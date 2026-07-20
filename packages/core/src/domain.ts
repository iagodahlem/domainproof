import { parse } from 'tldts'

/**
 * Failure reasons returned by {@link normalizeDomain}. Kept as a closed set
 * of string codes so callers (API error taxonomy, UI copy) can switch on them
 * without parsing free-text messages.
 */
export type NormalizeDomainFailureReason =
  'empty' | 'invalid_format' | 'is_ip' | 'no_public_suffix'

export type NormalizeDomainResult =
  | { ok: true; domain: string }
  | { ok: false; reason: NormalizeDomainFailureReason }

// RFC 6761 permanently reserves `.test` (alongside `.example`, `.invalid`,
// `.localhost`) for documentation and testing: it is guaranteed to never be
// delegated in the real DNS root or added to the Public Suffix List. That
// makes it a safe, stable sandbox namespace — `<label>.test` domains are
// accepted and treated as their own registrable domain without ever being
// looked up against real DNS or the PSL.
const SANDBOX_SUFFIX = '.test'

// Sandbox labels allow "+" (in addition to the usual letters/digits/hyphen/
// underscore) so scenario fixtures can compose variants without colliding,
// e.g. `pending-then-verified+run1.test`.
const SANDBOX_LABEL_PATTERN = /^[a-z0-9](?:[a-z0-9_+-]*[a-z0-9])?$/

function isSandboxHostname(hostname: string): boolean {
  return hostname.endsWith(SANDBOX_SUFFIX)
}

function isValidSandboxHostname(hostname: string): boolean {
  const labels = hostname.split('.')
  return (
    labels.length >= 2 &&
    labels.every((label) => SANDBOX_LABEL_PATTERN.test(label))
  )
}

/**
 * Normalizes a user-supplied domain (or a pasted URL) into a canonical
 * lowercase hostname with no trailing dot, scheme, path, port, or userinfo.
 *
 * Never throws — malformed input comes back as `{ ok: false, reason }`.
 */
export function normalizeDomain(input: string): NormalizeDomainResult {
  if (typeof input !== 'string' || input.trim().length === 0) {
    return { ok: false, reason: 'empty' }
  }

  // Loose pass: let tldts strip scheme/userinfo/port/path and lowercase the
  // hostname, without its stricter per-label character validation (sandbox
  // labels use "+", which that validation rejects).
  const loose = parse(input, { validateHostname: false })

  if (loose.hostname === null) {
    return { ok: false, reason: 'invalid_format' }
  }
  if (loose.isIp) {
    return { ok: false, reason: 'is_ip' }
  }

  if (isSandboxHostname(loose.hostname)) {
    return isValidSandboxHostname(loose.hostname)
      ? { ok: true, domain: loose.hostname }
      : { ok: false, reason: 'invalid_format' }
  }

  // Strict pass for everything else: real-world hostnames must satisfy
  // RFC 1035 label rules (no empty labels, no leading/trailing hyphen, no
  // stray characters) and resolve to a recognized public suffix.
  const strict = parse(input, { validateHostname: true })
  if (strict.hostname === null) {
    return { ok: false, reason: 'invalid_format' }
  }
  if (strict.domain === null) {
    return { ok: false, reason: 'no_public_suffix' }
  }
  return { ok: true, domain: strict.hostname }
}

/**
 * Returns the registrable domain (eTLD+1) for an already-normalized domain,
 * e.g. `sub.acme.co.uk` -> `acme.co.uk`. Sandbox `.test` hostnames are
 * reduced to their last real label plus `.test` rather than looked up
 * against the Public Suffix List (see {@link normalizeDomain}).
 *
 * Expects input that already passed {@link normalizeDomain}.
 */
export function registrableDomain(domain: string): string {
  if (isSandboxHostname(domain)) {
    const labels = domain.split('.')
    return labels.slice(-2).join('.')
  }
  const parsed = parse(domain)
  return parsed.domain ?? domain
}
