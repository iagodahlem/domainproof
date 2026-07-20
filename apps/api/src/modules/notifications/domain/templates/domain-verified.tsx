import { EmailLayout, emailBrand } from './layout'

export interface DomainVerifiedEmailProps {
  domain: string
}

export function DomainVerifiedEmail({ domain }: DomainVerifiedEmailProps) {
  return (
    <EmailLayout preview={`${domain} is verified`}>
      <h1
        style={{
          fontSize: '18px',
          margin: '0 0 16px',
          color: emailBrand.emeraldDark,
        }}
      >
        {domain} is verified
      </h1>
      <p style={{ fontSize: '14px', lineHeight: 1.6, margin: '0 0 16px' }}>
        We found the DNS record for <strong>{domain}</strong> and confirmed it
        matches. Ownership is verified — no further action needed.
      </p>
      <p
        style={{
          fontSize: '13px',
          lineHeight: 1.6,
          color: emailBrand.muted,
          margin: 0,
        }}
      >
        We'll keep rechecking periodically, and let you know if that ever
        changes.
      </p>
    </EmailLayout>
  )
}
