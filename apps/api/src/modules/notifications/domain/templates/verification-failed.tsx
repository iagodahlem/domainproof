import { EmailLayout, emailBrand } from './layout'

export interface VerificationFailedEmailProps {
  domain: string
}

export function VerificationFailedEmail({
  domain,
}: VerificationFailedEmailProps) {
  return (
    <EmailLayout preview={`${domain} verification failed`}>
      <h1
        style={{
          fontSize: '18px',
          margin: '0 0 16px',
          color: emailBrand.emeraldDark,
        }}
      >
        {domain} verification failed
      </h1>
      <p style={{ fontSize: '14px', lineHeight: 1.6, margin: '0 0 16px' }}>
        We were unable to confirm <strong>{domain}</strong>'s DNS record in
        time, so verification has failed.
      </p>
      <p
        style={{
          fontSize: '13px',
          lineHeight: 1.6,
          color: emailBrand.muted,
          margin: 0,
        }}
      >
        Claim the domain again from your dashboard to get a fresh verification
        record, then publish it and verify once more.
      </p>
    </EmailLayout>
  )
}
