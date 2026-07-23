import { ThemeToggle } from '@domainproof/ui'
import { AuthCta } from './auth-cta'

export interface MarketingActionsProps {
  /** Forwarded to `AuthCta`'s `initialIsSignedIn` — the caller resolves this server-side via `auth()` so the CTA's first paint is correct. */
  isSignedIn: boolean
}

/**
 * The marketing Header's right-slot cluster — shared by every chromed
 * public page (landing, design system) so the toggle and CTA line up the
 * same way everywhere they appear. The toggle is icon-only at every width
 * (its label lives in a hover/focus tooltip instead), and the CTA drops to
 * icon-only below `sm`, so the pair stays on one row down to the smallest
 * screens with the CTA as the loudest element in the cluster.
 */
export function MarketingActions({ isSignedIn }: MarketingActionsProps) {
  return (
    <div className="flex items-center gap-3">
      <ThemeToggle variant="icon" className="shrink-0" />
      <AuthCta
        size="sm"
        iconSize={13}
        compact
        initialIsSignedIn={isSignedIn}
        className="shrink-0 whitespace-nowrap"
      />
    </div>
  )
}
