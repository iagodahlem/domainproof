import Link from 'next/link'
import type { Provider } from '@domainproof/core'
import { Badge, CardRow, RecordCard, RecordField } from '@domainproof/ui'
import type { VerificationRecord } from '@/lib/api/frontend'
import { guideForProvider } from '../_lib/provider-guide'

export interface RecordCardSectionProps {
  domain: string
  records: VerificationRecord[]
  provider: Provider
}

export function RecordCardSection({
  domain,
  records,
  provider,
}: RecordCardSectionProps) {
  const guide = guideForProvider(provider)
  return (
    <RecordCard
      title="Add this DNS record"
      sub={
        <>
          {`Add this where you manage DNS for ${domain} — `}
          <Link
            href={`/docs/${guide.slug}`}
            className="text-accent underline-offset-4 hover:underline"
          >
            {`how to add it${guide.name ? ` on ${guide.name}` : ''} →`}
          </Link>
        </>
      }
      trailing={
        records[0] ? <Badge tone="accent">{records[0].type}</Badge> : null
      }
    >
      {records.map((record) => (
        <div key={record.label}>
          <RecordField
            label="Host"
            value={record.label}
            copyable
            truncateValue
          />
          <RecordField
            label="Value"
            value={record.value}
            copyable
            truncateValue
          />
        </div>
      ))}
      <CardRow>
        <p className="text-sm text-faint-foreground">
          Paste the value exactly as shown — some DNS providers add a trailing
          dot automatically. If verification keeps failing, check for one.
        </p>
      </CardRow>
    </RecordCard>
  )
}
