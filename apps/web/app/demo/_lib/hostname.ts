import { isIP } from 'node:net'

const MAX_HOSTNAME_LENGTH = 253
const HOSTNAME_RE =
  /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/

export type HostnameValidationFailureReason =
  'empty' | 'too_long' | 'is_ip' | 'invalid_format'

export type HostnameValidation =
  | { ok: true; domain: string }
  | { ok: false; reason: HostnameValidationFailureReason }

/**
 * Accepts a bare hostname or a full URL and normalizes to a lowercase
 * hostname with no scheme/path/port — the shape every probe below expects.
 * Deliberately hand-rolled instead of importing `@domainproof/core`'s
 * `normalizeDomain`: the demo only ever talks to DomainProof through
 * `@domainproof/sdk`, never a workspace package that's really "server
 * internals" for the ownership-verification product.
 */
export function validateHostname(input: string): HostnameValidation {
  const trimmed = input.trim()
  if (!trimmed) {
    return { ok: false, reason: 'empty' }
  }

  const withoutScheme = trimmed.replace(/^[a-z]+:\/\//i, '')
  const withoutPath = (withoutScheme.split(/[/?#]/)[0] ?? '')
    .toLowerCase()
    .trim()

  // A single colon means "host:port" (strip it); two or more means this is
  // very likely an unbracketed IPv6 literal (`::1`, `2001:db8::1`) — split
  // on it and every IPv6 address would incorrectly resolve to `''` or its
  // first hextet before ever reaching the isIP check below.
  const colonCount = (withoutPath.match(/:/g) ?? []).length
  const hostname =
    colonCount === 1 ? (withoutPath.split(':')[0] ?? '') : withoutPath

  if (!hostname) {
    return { ok: false, reason: 'empty' }
  }
  if (hostname.length > MAX_HOSTNAME_LENGTH) {
    return { ok: false, reason: 'too_long' }
  }
  if (isIP(hostname) !== 0) {
    return { ok: false, reason: 'is_ip' }
  }
  if (!HOSTNAME_RE.test(hostname)) {
    return { ok: false, reason: 'invalid_format' }
  }

  return { ok: true, domain: hostname }
}
