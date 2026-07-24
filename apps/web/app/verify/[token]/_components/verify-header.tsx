import { Logo } from '@domainproof/ui'

export type VerifyHeaderVariant = 'active' | 'verified' | 'failed'

export interface VerifyHeaderProps {
  domain: string
  projectName: string
  /** 'active' (not started, pending, or needs attention but still checkable) shares one context sentence, since there's still a record to add. 'verified' and 'failed' are terminal — each gets its own sentence, since neither has a record left to add. */
  variant: VerifyHeaderVariant
}

export function VerifyHeader({
  domain,
  projectName,
  variant,
}: VerifyHeaderProps) {
  return (
    <header className="flex flex-col">
      <div className="py-6">
        <Logo />
      </div>

      <div className="flex flex-col gap-3">
        {variant === 'verified' ? (
          <h1 className="text-2xl leading-heading font-heading text-balance">
            <span className="break-all">{domain}</span> is verified
          </h1>
        ) : variant === 'failed' ? (
          <h1 className="text-2xl leading-heading font-heading text-balance">
            Verification of{' '}
            <span className="break-all text-accent">{domain}</span> didn&rsquo;t
            go through
          </h1>
        ) : (
          <h1 className="text-2xl leading-heading font-heading text-balance">
            Verify ownership of{' '}
            <span className="break-all text-accent">{domain}</span>
          </h1>
        )}

        <p className="max-w-[52ch] text-sm leading-body text-muted-foreground">
          {variant === 'verified'
            ? `You're done — you can close this tab. ${projectName}'s been notified and will take it from here.`
            : variant === 'failed'
              ? `Requested by ${projectName} — ask them for a new verification link to try again.`
              : `Requested by ${projectName} — add one DNS record and you're done.`}
        </p>
      </div>
    </header>
  )
}
