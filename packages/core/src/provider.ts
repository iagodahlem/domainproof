/**
 * DNS providers this package can recognize from a domain's nameservers.
 * `'unknown'` covers every provider we don't have a detector for yet, not
 * just "detection failed" — the two are indistinguishable to a caller and
 * both mean the same thing: don't offer a provider-specific one-click
 * integration for this domain.
 */
export type Provider =
  'cloudflare' | 'godaddy' | 'vercel' | 'route53' | 'unknown'

/**
 * Cloudflare's authoritative nameservers always end in this suffix (e.g.
 * `aida.ns.cloudflare.com`) — stable across every Cloudflare zone,
 * regardless of the pair of nameserver names a given zone was assigned.
 */
const CLOUDFLARE_NAMESERVER_SUFFIX = '.ns.cloudflare.com'

/**
 * GoDaddy's authoritative nameservers always end in this suffix (e.g.
 * `ns71.domaincontrol.com`) — the numbered prefix varies per zone, the
 * suffix doesn't.
 */
const GODADDY_NAMESERVER_SUFFIX = '.domaincontrol.com'

/**
 * Vercel's authoritative nameservers, for a zone that's delegated its DNS to
 * Vercel (e.g. `ns1.vercel-dns.com`) — see Vercel's "Add Vercel's
 * nameservers" docs. Distinct from `vercel-dns-XXX.com`, the per-record
 * target hostname Vercel hands out for individual A/CNAME records on
 * domains it doesn't manage DNS for; only the fixed `ns{1,2}.vercel-dns.com`
 * pair is ever used as a zone's actual nameservers.
 */
const VERCEL_NAMESERVER_SUFFIX = '.vercel-dns.com'

/**
 * Route 53's authoritative nameservers always look like
 * `ns-1234.awsdns-56.{com,net,org,co.uk}` — the numeric ids and TLD vary per
 * zone, but every one carries an `awsdns-<digits>.` segment right before a
 * closed set of TLDs. Anchored to the end of the hostname (like the other
 * suffix checks here) so a lookalike domain that merely contains
 * `awsdns-` earlier in its name doesn't match.
 */
const ROUTE53_NAMESERVER_PATTERN = /\.awsdns-\d+\.(?:com|net|org|co\.uk)$/

function matchesSuffix(nameserver: string, suffix: string): boolean {
  return nameserver.toLowerCase().endsWith(suffix)
}

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
  if (
    nameservers.some((ns) => matchesSuffix(ns, CLOUDFLARE_NAMESERVER_SUFFIX))
  ) {
    return 'cloudflare'
  }
  if (nameservers.some((ns) => matchesSuffix(ns, GODADDY_NAMESERVER_SUFFIX))) {
    return 'godaddy'
  }
  if (nameservers.some((ns) => matchesSuffix(ns, VERCEL_NAMESERVER_SUFFIX))) {
    return 'vercel'
  }
  if (
    nameservers.some((ns) => ROUTE53_NAMESERVER_PATTERN.test(ns.toLowerCase()))
  ) {
    return 'route53'
  }
  return 'unknown'
}
