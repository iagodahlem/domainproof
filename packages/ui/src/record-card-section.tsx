import { Badge } from './badge'
import { CardRow } from './card'
import { RecordCard } from './record-card'
import { RecordField } from './record-field'

export interface RecordCardSectionRecord {
  label: string
  type: string
  value: string
}

export interface RecordCardSectionProps {
  domain: string
  records: RecordCardSectionRecord[]
  /** Where "How to add it" links — a relative `/docs/...` path on the hosted app, an absolute `https://domainproof.dev/docs/...` URL for an embedded widget with no doc routes of its own. */
  guideUrl: string
  /** Display name for "How to add it on {guideLabel}" — omit for the generic any-provider guide, which names no provider. */
  guideLabel?: string | null
}

export function RecordCardSection({
  domain,
  records,
  guideUrl,
  guideLabel = null,
}: RecordCardSectionProps) {
  return (
    <RecordCard
      title="Add this DNS record"
      sub={`Add this where you manage DNS for ${domain}`}
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
      <CardRow className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-sm text-faint-foreground">
          Paste the value exactly as shown — some DNS providers add a trailing
          dot automatically. If verification keeps failing, check for one.
        </p>
        <a
          href={guideUrl}
          className="whitespace-nowrap text-sm text-accent underline-offset-4 hover:underline"
        >
          {`How to add it${guideLabel ? ` on ${guideLabel}` : ''} →`}
        </a>
      </CardRow>
    </RecordCard>
  )
}
