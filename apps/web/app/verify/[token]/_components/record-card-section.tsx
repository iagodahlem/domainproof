import type { DomainStatus, Provider } from '@domainproof/core'
import {
  Badge,
  Callout,
  CardRow,
  RecordCard,
  RecordField,
} from '@domainproof/ui'
import { Check } from 'lucide-react'
import type { VerificationRecord } from '@/lib/api/frontend'
// This route mounts no QueryProvider (D-029: no auth/session context on the
// anonymous verification page) — converting to a lib/query hook would mean
// adding one, a real behavior change rather than a structural move (see
// apps/web/ARCHITECTURE.md).
// eslint-disable-next-line no-restricted-imports -- see note above
import { cloudflareAuthorizeUrl } from '@/lib/api/frontend'
import { CloudflareButton } from './cloudflare-button'
import {
  describeCloudflareOutcome,
  isCloudflareOutcomeStale,
} from '../_lib/cloudflare-outcome'

export interface RecordCardSectionProps {
  token: string
  records: VerificationRecord[]
  provider: Provider
  status: DomainStatus
  cloudflareOutcome: string | null
}

/** Provider-aware hint (D-028 L1) — only Cloudflare is detected today; every other provider (or an undetected one) gets no hint beyond the generic record instructions. */
const PROVIDER_HINT_BY_PROVIDER: Partial<Record<Provider, string>> = {
  cloudflare:
    "We detected Cloudflare manages this domain's DNS — add the record below under DNS → Records in the Cloudflare dashboard, or use the one-click setup instead.",
}

export function RecordCardSection({
  token,
  records,
  provider,
  status,
  cloudflareOutcome,
}: RecordCardSectionProps) {
  const outcomeView =
    cloudflareOutcome && !isCloudflareOutcomeStale(status)
      ? describeCloudflareOutcome(cloudflareOutcome)
      : null
  const showCloudflareButton =
    provider === 'cloudflare' && status !== 'verified'
  const providerHint = PROVIDER_HINT_BY_PROVIDER[provider]
  const firstRecordType = records[0]?.type
  const isVerified = status === 'verified'

  return (
    <RecordCard
      step={isVerified ? <Check aria-hidden="true" size={12} /> : 1}
      stepTone={isVerified ? 'success' : 'accent'}
      title="Add this DNS record"
      sub="At whoever manages this domain's DNS"
      trailing={
        firstRecordType ? <Badge tone="accent">{firstRecordType}</Badge> : null
      }
    >
      {records.map((record) => (
        <div key={record.label}>
          <RecordField
            label="Host"
            value={record.label}
            copyable
            explain="This subdomain is unique to this request. It doesn't touch your existing DNS, mail, or website — it only exists to answer one question."
          />
          <RecordField
            label="Value"
            value={record.value}
            copyable
            explain="A one-time token, generated for this request only. Paste it exactly as shown."
          />
        </div>
      ))}

      <CardRow>
        <Callout tone="warning" className="text-sm">
          Paste the value exactly as shown — some DNS providers add a trailing
          dot automatically. If verification keeps failing, check for one.
        </Callout>
      </CardRow>

      {showCloudflareButton && providerHint ? (
        <CardRow>
          <Callout
            tone="accent"
            className="flex flex-col items-start gap-3 text-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <span>{providerHint}</span>
            <CloudflareButton authorizeUrl={cloudflareAuthorizeUrl(token)} />
          </Callout>
        </CardRow>
      ) : null}

      {outcomeView ? (
        <CardRow>
          <Callout tone={outcomeView.tone} className="text-sm">
            {outcomeView.message}
          </Callout>
        </CardRow>
      ) : null}
    </RecordCard>
  )
}
