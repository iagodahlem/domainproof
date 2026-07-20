import { EmailLayout, emailBrand } from './layout'

export interface GraceWindowEmailProps {
  domain: string
}

export function GraceWindowEmail({ domain }: GraceWindowEmailProps) {
  return (
    <EmailLayout preview={`${domain}: we're rechecking your DNS record`}>
      <h1
        style={{
          fontSize: '18px',
          margin: '0 0 16px',
          color: emailBrand.emeraldDark,
        }}
      >
        We couldn't find {domain}'s record just now
      </h1>
      <p style={{ fontSize: '14px', lineHeight: 1.6, margin: '0 0 16px' }}>
        <strong>{domain}</strong> was verified, but on our latest recheck the
        DNS record was missing or didn't match. This is often temporary — DNS
        changes, TTL expiry, a registrar migration — so we're not marking it
        failed yet.
      </p>
      <p style={{ fontSize: '14px', lineHeight: 1.6, margin: '0 0 16px' }}>
        We'll keep rechecking for the next 72 hours. If the record is back
        before then, verification recovers automatically and you won't hear from
        us again about this. If it's still missing after 72 hours, we'll let you
        know it needs a fresh claim.
      </p>
      <p
        style={{
          fontSize: '13px',
          lineHeight: 1.6,
          color: emailBrand.muted,
          margin: 0,
        }}
      >
        If you removed the record on purpose, there's nothing to do.
      </p>
    </EmailLayout>
  )
}
