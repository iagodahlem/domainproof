import type { DnsResolverLike } from './dns-probe'
import { nodeDnsResolver } from './dns-probe'

/**
 * DKIM has no discoverable selector — the sender picks it, and it's never
 * published anywhere but the mail headers a receiving server sees. This
 * checks the handful of selectors real providers commonly default to
 * (Google Workspace, Microsoft 365, generic ESPs); a miss on all of them
 * means "not detected", never "absent" — email-posture.ts labels this
 * explicitly as best-effort for that reason.
 */
const COMMON_DKIM_SELECTORS = [
  'google',
  'selector1',
  'selector2',
  'k1',
  'default',
  'mail',
  'smtp',
]

export interface DkimProbeResult {
  detectedSelectors: string[]
}

export async function runDkimProbe(
  domain: string,
  resolver: DnsResolverLike = nodeDnsResolver,
): Promise<DkimProbeResult> {
  const results = await Promise.all(
    COMMON_DKIM_SELECTORS.map(async (selector) => {
      const records = await resolver
        .resolveTxt(`${selector}._domainkey.${domain}`)
        .catch(() => [])
      const looksLikeDkim = records.some((chunks) =>
        chunks.join('').toLowerCase().includes('v=dkim1'),
      )
      return looksLikeDkim ? selector : null
    }),
  )

  return { detectedSelectors: results.filter((s): s is string => s !== null) }
}
