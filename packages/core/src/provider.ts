/**
 * DNS providers this package can recognize from a domain's nameservers.
 * `'unknown'` covers every provider we don't have a detector for yet, not
 * just "detection failed" — the two are indistinguishable to a caller and
 * both mean the same thing: don't offer a provider-specific one-click
 * integration for this domain.
 */
export type Provider = 'cloudflare' | 'unknown'

/**
 * Cloudflare's authoritative nameservers always end in this suffix (e.g.
 * `aida.ns.cloudflare.com`) — stable across every Cloudflare zone,
 * regardless of the pair of nameserver names a given zone was assigned.
 */
const CLOUDFLARE_NAMESERVER_SUFFIX = '.ns.cloudflare.com'

/**
 * Detects the DNS provider hosting a zone from its nameserver hostnames
 * (see `discoverAuthoritativeNameservers` in the api's `infra/dns/node-dns.ts`
 * for where those hostnames come from). Pure and zero-IO by design — this
 * package only ever reasons about nameservers it's handed, never resolves
 * them itself.
 *
 * An empty `nameservers` array (e.g. a `.test` sandbox domain, which has no
 * real DNS at all) is `'unknown'` by the same fallthrough as any other
 * unrecognized provider — there's nothing sandbox-specific in this
 * function itself.
 */
export function detectProvider(nameservers: readonly string[]): Provider {
  const isCloudflare = nameservers.some((nameserver) =>
    nameserver.toLowerCase().endsWith(CLOUDFLARE_NAMESERVER_SUFFIX),
  )
  return isCloudflare ? 'cloudflare' : 'unknown'
}
