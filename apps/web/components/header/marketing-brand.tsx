import Link from 'next/link'
import { Logo } from '@domainproof/ui'

export interface MarketingBrandProps {
  /** True when this renders on the docs pages themselves — "Docs" becomes a plain current-page label instead of a link back to `/docs`. */
  docsActive?: boolean
}

/**
 * The marketing Header's left-slot content — the logo plus a quiet "Docs"
 * link, mirroring `MarketingActions` on the right. Docs drops out below
 * `sm` rather than going icon-only like the right cluster does — a bare
 * word has no icon to fall back to, and it stays reachable from the footer.
 * The docs header reuses this same lockup (`docsActive`) so the brand reads
 * identically everywhere; only the "Docs" label's link-ness changes.
 */
export function MarketingBrand({
  docsActive = false,
}: MarketingBrandProps = {}) {
  return (
    <div className="flex items-center gap-2">
      <Logo />
      <span aria-hidden="true" className="hidden text-border-strong sm:inline">
        ·
      </span>
      {docsActive ? (
        <span
          aria-current="page"
          className="hidden text-sm font-medium text-faint-foreground sm:inline"
        >
          Docs
        </span>
      ) : (
        <Link
          href="/docs"
          className="hidden text-sm font-medium text-faint-foreground transition-colors hover:text-muted-foreground sm:inline"
        >
          Docs
        </Link>
      )}
    </div>
  )
}
