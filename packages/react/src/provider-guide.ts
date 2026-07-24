import type { Provider } from './types'

export interface ProviderGuide {
  /** Display name for copy like "how to add it on Cloudflare" — `null` for the generic any-provider guide, which names no provider. */
  name: string | null
  /** Slug of the matching guide under `apps/web/content/docs/guides/add-txt-record*.mdx`. */
  slug: string
}

const GENERIC_GUIDE: ProviderGuide = { name: null, slug: 'add-txt-record' }

/** One guide per detected provider — everything else, including `'unknown'`, falls back to `GENERIC_GUIDE`. Mirrors the hosted verification page's own `guideForProvider` (`apps/web/app/verify/[token]/_lib/provider-guide.ts`). */
const PROVIDER_GUIDES: Partial<Record<Provider, ProviderGuide>> = {
  cloudflare: { name: 'Cloudflare', slug: 'add-txt-record-cloudflare' },
  godaddy: { name: 'GoDaddy', slug: 'add-txt-record-godaddy' },
  vercel: { name: 'Vercel', slug: 'add-txt-record-vercel' },
  route53: { name: 'AWS Route 53', slug: 'add-txt-record-route53' },
}

/** The DNS setup guide matching a detected provider — the generic any-provider guide for `'unknown'`. */
export function guideForProvider(provider: Provider): ProviderGuide {
  return PROVIDER_GUIDES[provider] ?? GENERIC_GUIDE
}

/**
 * Absolute docs URL for a guide slug — this package is embedded on
 * arbitrary third-party sites with no `/docs` route of their own, unlike
 * the hosted verification page, so every guide link here is absolute.
 * Hardcoded production host, same pattern as the api's own
 * `VERIFICATION_BASE_URL` constants.
 */
export function absoluteGuideUrl(guide: ProviderGuide): string {
  return `https://domainproof.dev/docs/${guide.slug}`
}
