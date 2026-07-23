import { Zap } from 'lucide-react'
import { Callout, cn, type CalloutTone } from '@domainproof/ui'
// This route mounts no QueryProvider (D-029: no auth/session context on the
// anonymous verification page) — converting to a lib/query hook would mean
// adding one, a real behavior change rather than a structural move (see
// apps/web/ARCHITECTURE.md).
// eslint-disable-next-line no-restricted-imports -- see note above
import { cloudflareAuthorizeUrl } from '@/lib/api/frontend'
import { CloudflareButton } from './cloudflare-button'
import { describeCloudflareOutcome } from '../_lib/cloudflare-outcome'

export interface CloudflareFastpathCardProps {
  token: string
  domain: string
  /** The `?cloudflare=` outcome from the one-click callback redirect, if this load is one. Only ever meaningful here — callers gate rendering of this whole card on the provider actually being Cloudflare and the domain not yet resolved. */
  cloudflareOutcome: string | null
}

/** `describeCloudflareOutcome` only ever returns one of these three tones. */
const OUTCOME_TEXT_CLASS_BY_TONE: Record<CalloutTone, string> = {
  accent: 'text-accent',
  warning: 'text-warning-strong',
  neutral: 'text-muted-foreground',
  danger: 'text-danger',
  success: 'text-success',
}

export function CloudflareFastpathCard({
  token,
  domain,
  cloudflareOutcome,
}: CloudflareFastpathCardProps) {
  const outcomeView = cloudflareOutcome
    ? describeCloudflareOutcome(cloudflareOutcome)
    : null

  return (
    <Callout tone="accent" className="flex flex-col items-start gap-3">
      <div className="flex items-center gap-2 font-mono text-2xs tracking-label text-accent uppercase">
        <Zap aria-hidden="true" size={14} />
        Detected: Cloudflare manages DNS for {domain}
      </div>
      <div>
        <h3 className="mb-2 text-base font-heading text-foreground">
          Add this record for me
        </h3>
        <p className="max-w-[48ch] text-sm text-muted-foreground">
          Skip the copy-paste — connect your Cloudflare account once and
          DomainProof writes the record directly.
        </p>
      </div>
      <CloudflareButton authorizeUrl={cloudflareAuthorizeUrl(token)} />
      {outcomeView ? (
        <p
          className={cn(
            'text-xs',
            OUTCOME_TEXT_CLASS_BY_TONE[outcomeView.tone],
          )}
        >
          {outcomeView.message}
        </p>
      ) : null}
    </Callout>
  )
}
