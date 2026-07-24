import { promises as dnsPromises } from 'node:dns'
import type { LookupAddress } from 'node:dns'
import type { LookupFunction } from 'node:net'
import { isDisallowedIp } from '@domainproof/core'

/**
 * The IP-safety boundary for every probe in this directory that connects to
 * a caller-supplied hostname (`fetch-probe.ts`, `tls-probe.ts`).
 * `hostname.ts`'s `validateHostname` only rejects a literal IP typed into
 * the scan form — it says nothing about where that hostname's DNS actually
 * points, so a name that resolves to a loopback/private/link-local/CGNAT
 * address (most notably a cloud metadata endpoint) would otherwise sail
 * through as a normal scan target. `isDisallowedIp` (from
 * `@domainproof/core`, not "server internals" for the verification product
 * — a generic address classifier shared with the webhook sender) is the
 * actual policy; this module is just the DNS-IO glue around it, kept local
 * to the demo since every other real IO in this directory (the fetch probe,
 * the TLS probe, the initial reachability lookup in `run-scan.ts`) is also
 * done directly here rather than through a workspace package.
 */

export type ResolveAllFn = (hostname: string) => Promise<LookupAddress[]>

const defaultResolveAll: ResolveAllFn = (hostname) =>
  dnsPromises.lookup(hostname, { all: true, verbatim: true })

export type VettedAddressResult =
  | { ok: true; address: string; family: number }
  | { ok: false; reason: 'no_address' | 'blocked' }

/**
 * Resolves every A/AAAA address for `hostname` and returns exactly one that
 * passes `isDisallowedIp`, or a failure if resolution errored or every
 * returned address is disallowed. Used by `tls-probe.ts`, which needs a
 * single vetted IP to hand to `tls.connect({ host, servername })` — one
 * resolution immediately before the one connection it makes, so there's no
 * window between "we checked" and "we connected" for DNS to change out from
 * under it.
 */
export async function resolveVettedAddress(
  hostname: string,
  resolveAll: ResolveAllFn = defaultResolveAll,
): Promise<VettedAddressResult> {
  let addresses: LookupAddress[]
  try {
    addresses = await resolveAll(hostname)
  } catch {
    return { ok: false, reason: 'no_address' }
  }

  const vetted = addresses.find((a) => !isDisallowedIp(a.address))
  if (!vetted) {
    return { ok: false, reason: 'blocked' }
  }
  return { ok: true, address: vetted.address, family: vetted.family }
}

function blockedError(hostname: string): NodeJS.ErrnoException {
  const err = new Error(
    `No public address found for "${hostname}"`,
  ) as NodeJS.ErrnoException
  err.code = 'ENOTFOUND'
  return err
}

/**
 * A `net.connect`-compatible `lookup` override for `fetch-probe.ts`'s
 * undici dispatcher. undici opens a fresh connection (and calls `lookup`
 * again) for every distinct origin it dials, including the origin a 3xx
 * response redirects to — so pinning every connection through this same
 * resolve-then-vet step is what lets the fetch probe keep `redirect:
 * 'follow'` without trusting wherever the first hop's `Location` header
 * points. A public host that 302s to `169.254.169.254` never gets a second
 * connection opened to it; this function refuses it exactly like it would
 * refuse that address as the very first hop.
 */
export function createVettedLookup(
  resolveAll: ResolveAllFn = defaultResolveAll,
): LookupFunction {
  return ((hostname, options, callback) => {
    resolveAll(hostname)
      .then((addresses) => {
        const safe = addresses.filter((a) => !isDisallowedIp(a.address))
        if (safe.length === 0) {
          callback(blockedError(hostname), '', 4)
          return
        }
        if (options && typeof options === 'object' && options.all) {
          callback(null, safe, undefined as unknown as number)
          return
        }
        const [chosen] = safe
        if (!chosen) {
          callback(blockedError(hostname), '', 4)
          return
        }
        callback(null, chosen.address, chosen.family)
      })
      .catch((err: unknown) => {
        callback(
          err instanceof Error
            ? (err as NodeJS.ErrnoException)
            : blockedError(hostname),
          '',
          4,
        )
      })
  }) as LookupFunction
}
