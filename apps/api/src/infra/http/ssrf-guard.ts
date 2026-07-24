import { promises as dnsPromises } from 'node:dns'
import type { LookupAddress } from 'node:dns'
import type { LookupFunction } from 'node:net'
import { isDisallowedIp } from '@domainproof/core'

/**
 * The IP-safety boundary for webhook delivery. `apis/dashboard/routes/webhooks.ts`
 * only validates a caller-supplied endpoint URL with `z.string().url()` —
 * that says nothing about where the URL's host actually resolves, so
 * without this, an authenticated user could point a webhook at
 * `http://169.254.169.254/...` or an internal service and have this api
 * fetch it and hand the response status back to them. This is the same
 * policy as the demo scanner's `apps/web/app/demo/_lib/ssrf-guard.ts` —
 * `isDisallowedIp` (from `@domainproof/core`) is the one shared
 * implementation; this module is just the DNS-IO glue around it, kept
 * local to this api the same way `infra/dns/node-dns.ts` and
 * `infra/http/node-fetch.ts` are.
 */

export type ResolveAllFn = (hostname: string) => Promise<LookupAddress[]>

const defaultResolveAll: ResolveAllFn = (hostname) =>
  dnsPromises.lookup(hostname, { all: true, verbatim: true })

function blockedError(hostname: string): NodeJS.ErrnoException {
  const err = new Error(
    `No public address found for "${hostname}"`,
  ) as NodeJS.ErrnoException
  err.code = 'ENOTFOUND'
  return err
}

/**
 * A `net.connect`-compatible `lookup` override for `webhook-sender.ts`'s
 * undici dispatcher. undici opens a fresh connection (and calls `lookup`
 * again) for every distinct origin it dials, including the origin a 3xx
 * response redirects to — so pinning every connection through this same
 * resolve-then-vet step closes the redirect gap too: an endpoint that
 * looks public but 302s to an internal address never gets a connection
 * opened to it, exactly as if that address had been given directly.
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
