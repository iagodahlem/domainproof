import { Globe, Sparkles } from 'lucide-react'
import { Button } from '@domainproof/ui'

export interface DomainEmptyStateProps {
  onVerifyFirstDomain: () => void
}

/** First-use empty state — matches the board's copy and CTA, minus the guided walkthrough (out of scope for this route; the CTA opens the same add-domain panel, pre-filled with a sandbox domain). */
export function DomainEmptyState({
  onVerifyFirstDomain,
}: DomainEmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border-strong px-6 py-16 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-2 text-text-faint">
        <Globe aria-hidden="true" size={20} />
      </span>
      <h3 className="text-lg font-heading text-text">No domains yet</h3>
      <p className="max-w-[46ch] text-sm leading-body text-text-muted">
        Claim your first domain to get a DNS record and a hosted verification
        link — or try it with a sandbox domain, no real DNS required.
      </p>
      <Button variant="primary" size="sm" onClick={onVerifyFirstDomain}>
        <Sparkles aria-hidden="true" size={13} />
        Verify your first domain
      </Button>
    </div>
  )
}
