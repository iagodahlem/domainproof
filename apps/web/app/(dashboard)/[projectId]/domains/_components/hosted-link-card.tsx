import { Link2 } from 'lucide-react'
import { Card, CardBody, CopyButton } from '@domainproof/ui'

export interface HostedLinkCardProps {
  verificationUrl: string
  verified: boolean
}

/**
 * "Send this to whoever manages DNS" — a calm, permanent card for the
 * hosted verification portal's own link, rather than a one-time reveal
 * during onboarding. The link is this product's actual differentiator (no
 * dashboard access, no sign-in, nothing else about the project) — it
 * deserves real estate on the domain's own page, not just a footnote.
 */
export function HostedLinkCard({
  verificationUrl,
  verified,
}: HostedLinkCardProps) {
  return (
    <Card className="mb-6">
      <CardBody className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent">
            <Link2 aria-hidden="true" size={16} />
          </span>
          <div>
            <div className="mb-0.5 font-heading text-base text-foreground">
              Send this to whoever manages DNS
            </div>
            <p className="text-sm text-muted-foreground">
              {verified
                ? 'Already verified, but the link still resolves — handy if the record ever needs to be re-added by someone else.'
                : 'A hosted page with just this record to add — no dashboard access, no sign-in, nothing else about this project. They add it, you get notified here.'}
            </p>
          </div>
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <div className="min-w-0 flex-1 truncate rounded-md border border-border bg-background px-3 py-1 font-mono text-xs text-muted-foreground">
            {verificationUrl}
          </div>
          <CopyButton value={verificationUrl}>Copy link</CopyButton>
        </div>
      </CardBody>
    </Card>
  )
}
