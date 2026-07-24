import { isIPv4, isIPv6 } from 'node:net'

/**
 * Why a resolved IP address is refused as a connection target. Kept as a
 * closed set of string codes (same convention as {@link
 * TxtResolutionFailureReason} in resolver.ts) rather than a bare boolean, so
 * callers that want to explain a refusal can, without inventing their own
 * vocabulary — though today every caller of {@link isDisallowedIp} just
 * treats any reason as "refuse and report a generic connection failure",
 * never surfacing the specific bucket to an end user.
 *
 * - `unspecified` — `0.0.0.0` / `::`, "no particular address".
 * - `loopback` — `127.0.0.0/8` / `::1`.
 * - `private` — RFC 1918 (`10/8`, `172.16/12`, `192.168/16`) or IPv6 unique
 *   local (`fc00::/7`).
 * - `link_local` — `169.254.0.0/16` (this is the range that includes the
 *   `169.254.169.254` cloud-metadata address every major provider uses) or
 *   IPv6 link-local (`fe80::/10`).
 * - `cgnat` — `100.64.0.0/10`, the carrier-grade-NAT range providers use for
 *   internal routing between customers.
 * - `multicast` — `224.0.0.0/4` / IPv6 `ff00::/8`.
 * - `reserved` — everything else IANA has set aside and never routes on the
 *   public Internet (the `0.0.0.0/8` "this network" block, the
 *   documentation/benchmarking `TEST-NET-*` and `198.18.0.0/15` ranges,
 *   `240.0.0.0/4`, the broadcast address) plus anything that isn't a
 *   recognized IPv4/IPv6 literal at all — an unparseable address is refused
 *   rather than assumed safe.
 */
export type DisallowedIpReason =
  | 'unspecified'
  | 'loopback'
  | 'private'
  | 'link_local'
  | 'cgnat'
  | 'multicast'
  | 'reserved'

function classifyIpv4(ip: string): DisallowedIpReason | undefined {
  const octets = ip.split('.').map(Number)
  const a = octets[0] ?? 0
  const b = octets[1] ?? 0
  const c = octets[2] ?? 0

  if (a === 0) return ip === '0.0.0.0' ? 'unspecified' : 'reserved'
  if (a === 127) return 'loopback'
  if (a === 10) return 'private'
  if (a === 172 && b >= 16 && b <= 31) return 'private'
  if (a === 192 && b === 168) return 'private'
  if (a === 169 && b === 254) return 'link_local'
  if (a === 100 && b >= 64 && b <= 127) return 'cgnat'
  if (a >= 224 && a <= 239) return 'multicast'
  if (a === 192 && b === 0 && c === 0) return 'reserved' // IETF protocol assignments
  if (a === 192 && b === 0 && c === 2) return 'reserved' // TEST-NET-1
  if (a === 198 && (b === 18 || b === 19)) return 'reserved' // benchmarking
  if (a === 198 && b === 51 && c === 100) return 'reserved' // TEST-NET-2
  if (a === 203 && b === 0 && c === 113) return 'reserved' // TEST-NET-3
  if (a >= 240) return 'reserved' // future use + 255.255.255.255 broadcast

  return undefined
}

/** The value of an IPv6 address's first hextet, treating a leading `::` (an elided run of zero groups) as `0` rather than `NaN`. */
function firstHextetValue(normalized: string): number {
  const firstSegment = normalized.split(':')[0] ?? ''
  return firstSegment === '' ? 0 : parseInt(firstSegment, 16)
}

function classifyIpv6(ip: string): DisallowedIpReason | undefined {
  const normalized = ip.toLowerCase()

  if (normalized === '::') return 'unspecified'
  if (normalized === '::1') return 'loopback'

  // IPv4-mapped (`::ffff:a.b.c.d`) — an IPv6 literal that's really just an
  // IPv4 address in disguise, so it must be judged by the IPv4 rules above
  // rather than falling through as an unrecognized (and therefore
  // "allowed") IPv6 form.
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(normalized)
  if (mapped?.[1]) return classifyIpv4(mapped[1])

  const hextet = firstHextetValue(normalized)
  if (hextet >= 0xfc00 && hextet <= 0xfdff) return 'private' // unique local, fc00::/7
  if (hextet >= 0xfe80 && hextet <= 0xfebf) return 'link_local' // fe80::/10
  if (hextet >= 0xff00 && hextet <= 0xffff) return 'multicast' // ff00::/8

  return undefined
}

/**
 * Classifies a single resolved IP address (already known to be a literal —
 * this never does a DNS lookup itself) as loopback/private/link-local/CGNAT/
 * multicast/reserved, or `undefined` if it's an ordinary public address safe
 * to connect to.
 *
 * This is the one place that policy lives, imported by every caller that
 * needs to vet a DNS answer before opening a connection to it — the demo
 * scanner's HTTP/TLS probes and the webhook sender both resolve a
 * caller-supplied hostname and must refuse to connect if it resolves to an
 * internal address, since a hostname passing string-shape validation (see
 * `apps/web`'s `hostname.ts`) says nothing about where it actually points.
 */
export function disallowedIpReason(ip: string): DisallowedIpReason | undefined {
  if (isIPv4(ip)) return classifyIpv4(ip)
  if (isIPv6(ip)) return classifyIpv6(ip)
  return 'reserved' // not a recognized IP literal — fail closed
}

export function isDisallowedIp(ip: string): boolean {
  return disallowedIpReason(ip) !== undefined
}
