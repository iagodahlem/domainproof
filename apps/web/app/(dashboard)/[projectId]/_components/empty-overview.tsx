import Link from 'next/link'
import { Globe, Sparkles } from 'lucide-react'
import { Button } from '@domainproof/ui'

export interface EmptyOverviewProps {
  projectId: string
}

/** First-use state — same shape as the domains route's own empty state, minus the sandbox prefill: this CTA hands off to that page rather than duplicating its add-domain panel. */
export function EmptyOverview({ projectId }: EmptyOverviewProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border-strong px-6 py-16 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-2 text-faint-foreground">
        <Globe aria-hidden="true" size={20} />
      </span>
      <h3 className="text-lg font-heading text-foreground">No domains yet</h3>
      <p className="max-w-[46ch] text-sm leading-body text-muted-foreground">
        Claim your first domain to get a DNS record and a hosted verification
        link — or try it with a sandbox domain, no real DNS required.
      </p>
      <Button asChild variant="primary" size="sm">
        <Link href={`/${projectId}/domains`}>
          <Sparkles aria-hidden="true" size={13} />
          Add your first domain
        </Link>
      </Button>
    </div>
  )
}
