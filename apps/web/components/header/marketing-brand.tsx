import Link from 'next/link'
import { Logo } from '@domainproof/ui'

/**
 * The marketing Header's left-slot content — the logo plus a quiet "Docs"
 * link, mirroring `MarketingActions` on the right. Docs drops out below
 * `sm` rather than going icon-only like the right cluster does — a bare
 * word has no icon to fall back to, and it stays reachable from the footer.
 */
export function MarketingBrand() {
  return (
    <div className="flex items-center gap-2">
      <Logo />
      <span aria-hidden="true" className="hidden text-border-strong sm:inline">
        ·
      </span>
      <Link
        href="/docs"
        className="hidden text-sm font-medium text-faint-foreground transition-colors hover:text-muted-foreground sm:inline"
      >
        Docs
      </Link>
    </div>
  )
}
