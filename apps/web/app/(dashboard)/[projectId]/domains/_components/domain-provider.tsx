import type { ReactNode } from 'react'
import { Cloud } from 'lucide-react'
import { ProviderBadge } from '@domainproof/ui'
import type { Provider } from '@/lib/api/dashboard'

/**
 * `.test` sandbox domains never touch real DNS (see the repo's own
 * `.test` sandbox convention), so there's no nameserver-based provider to
 * detect for them — told apart from a real domain purely by this suffix,
 * without a network round trip.
 */
function isSandboxDomain(domain: string): boolean {
  return domain.endsWith('.test')
}

/**
 * The domains table's Provider column: a muted iconless "Sandbox" label for
 * `.test` domains, a Cloudflare icon+name when detected, or `null` (letting
 * `DomainTableRow`'s own em-dash fallback render) for everything else — this
 * badge only has an icon+name pairing for Cloudflare today (see
 * `ProviderForDomain`/`Provider` in `lib/api/dashboard.ts` for the full set
 * the backend can detect), so a real domain on GoDaddy/Vercel/Route 53/etc.
 * still falls through to the em-dash until this component grows a badge
 * for it too.
 */
export function domainProviderBadge(
  domain: string,
  provider: Provider,
): ReactNode {
  if (isSandboxDomain(domain)) {
    return (
      <ProviderBadge className="text-faint-foreground">Sandbox</ProviderBadge>
    )
  }
  if (provider === 'cloudflare') {
    return (
      <ProviderBadge icon={<Cloud aria-hidden="true" size={13} />}>
        Cloudflare
      </ProviderBadge>
    )
  }
  return null
}
