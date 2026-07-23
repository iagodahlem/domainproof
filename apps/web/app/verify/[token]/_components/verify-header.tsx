import { Logo } from '@domainproof/ui'

export interface VerifyHeaderProps {
  domain: string
  projectName: string
  /** Swaps to the completed statement once the domain is verified — every other state (instructions, pending, needs attention) shares this same "asks you to verify" sentence, so a visitor who reloads mid-flow never loses track of who's asking or for what. */
  verified: boolean
}

export function VerifyHeader({
  domain,
  projectName,
  verified,
}: VerifyHeaderProps) {
  return (
    <header className=" flex flex-col">
      <div className="py-6">
        <Logo />
      </div>

      <div className="flex flex-col gap-3">
        {verified ? (
          <h1 className="text-2xl leading-heading font-heading text-balance">
            <span className="break-all">{domain}</span> is verified
          </h1>
        ) : (
          <h1 className="text-2xl leading-heading font-heading text-balance">
            {projectName} asks you to verify ownership of{' '}
            <span className="break-all text-accent">{domain}</span>
          </h1>
        )}

        <p className="max-w-[52ch] text-sm leading-body text-muted-foreground">
          {verified
            ? `You're done — you can close this tab. ${projectName}'s been notified and will take it from here.`
            : `This confirms ${domain} is under your control before ${projectName} turns on domain-based features for it — takes about two minutes.`}
        </p>
      </div>
    </header>
  )
}
