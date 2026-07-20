import { EmailLayout, emailBrand } from './layout'

export function WelcomeEmail() {
  return (
    <EmailLayout preview="Welcome to DomainProof">
      <h1
        style={{
          fontSize: '18px',
          margin: '0 0 16px',
          color: emailBrand.emeraldDark,
        }}
      >
        Welcome to DomainProof
      </h1>
      <p style={{ fontSize: '14px', lineHeight: 1.6, margin: '0 0 16px' }}>
        Your account is ready. Claim a domain and we'll hand you a DNS record to
        publish — once it's live, we'll verify it and keep watching to make sure
        it stays that way.
      </p>
      <p
        style={{
          fontSize: '13px',
          lineHeight: 1.6,
          color: emailBrand.muted,
          margin: 0,
        }}
      >
        You'll hear from us again when a domain finishes verifying, or if one
        needs your attention.
      </p>
    </EmailLayout>
  )
}
