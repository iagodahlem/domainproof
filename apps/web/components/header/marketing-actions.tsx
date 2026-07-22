import { ThemeToggle } from '@domainproof/ui'
import { AuthCta } from './auth-cta'

/**
 * The marketing Header's right-slot cluster — shared by every chromed
 * public page (landing, design system) so the toggle and CTA line up the
 * same way everywhere they appear.
 */
export function MarketingActions() {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
      <ThemeToggle className="shrink-0" />
      <AuthCta size="sm" iconSize={13} className="shrink-0 whitespace-nowrap" />
    </div>
  )
}
