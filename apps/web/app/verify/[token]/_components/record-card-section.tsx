import {
  Badge,
  Callout,
  CardRow,
  RecordCard,
  RecordField,
} from '@domainproof/ui'
import type { VerificationRecord } from '@/lib/api/frontend'

export interface RecordCardSectionProps {
  domain: string
  records: VerificationRecord[]
}

export function RecordCardSection({ domain, records }: RecordCardSectionProps) {
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
    </RecordCard>
  )
}
