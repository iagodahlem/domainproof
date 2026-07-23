import { ThemeToggle } from '@domainproof/ui'
import { AuthCta } from './auth-cta'

/**
 * The marketing Header's right-slot cluster — shared by every chromed
 * public page (landing, design system) so the toggle and CTA line up the
 * same way everywhere they appear. Same pill-beside-button rhythm as the
 * dashboard topbar's mode toggle + action button: fixed `gap-3`, both
 * controls the same height, and neither ever wraps onto its own line —
 * the CTA drops to icon-only below `sm`, same as the toggle already does,
 * so the pair reads as one composed group at every width.
 */
export function MarketingActions() {
  return (
    <div className="flex items-center justify-end gap-3">
      <ThemeToggle className="shrink-0" />
      <AuthCta
        size="sm"
        iconSize={13}
        compact
        className="shrink-0 whitespace-nowrap"
      />
    </div>
  )
}
