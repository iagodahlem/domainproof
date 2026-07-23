import { ThemeToggle } from '@domainproof/ui'
import { AuthCta } from './auth-cta'
import { DocsLink } from './docs-link'

export interface MarketingActionsProps {
  /** Forwarded to `AuthCta`'s `initialIsSignedIn` — the caller resolves this server-side via `auth()` so the CTA's first paint is correct. */
  isSignedIn: boolean
}

/**
 * The marketing Header's right-slot cluster — shared by every chromed
 * public page (landing, design system) so the toggle, docs link, and CTA
 * line up the same way everywhere they appear. Same pill-beside-button
 * rhythm as the dashboard topbar's mode toggle + action button: fixed
 * `gap-3`, every control the same height, and the group never wraps onto
 * its own line — the docs link and CTA both drop to icon-only below `sm`,
 * same as the toggle already does, so the row reads as one composed group
 * at every width. Docs sits as the ghost-styled quiet sibling next to the
 * CTA, which stays the loudest element in the cluster.
 */
export function MarketingActions({ isSignedIn }: MarketingActionsProps) {
  return (
    <div className="flex items-center justify-end gap-3">
      <ThemeToggle className="shrink-0" />
      <DocsLink
        size="sm"
        iconSize={13}
        compact
        className="shrink-0 whitespace-nowrap"
      />
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
