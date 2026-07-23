import Link from 'next/link'
import { GithubIcon } from './github-icon'

const GITHUB_URL = 'https://github.com/iagodahlem/domainproof'

/**
 * The marketing pages' shared footer — landing and design-system both
 * render it as the last thing on the page. Product links plus the repo,
 * nothing that needs upkeep (no newsletter form, no invented pages).
 */
export function MarketingFooter() {
  return (
    <footer className="border-t border-border px-6 py-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-6 text-sm sm:flex-row sm:justify-between">
        <p className="text-faint-foreground">
          DomainProof · domain ownership as a service
        </p>
        <nav className="flex items-center gap-6 text-muted-foreground">
          <Link
            href="/docs"
            className="transition-colors hover:text-foreground"
          >
            Docs
          </Link>
          <Link
            href="/design-system"
            className="transition-colors hover:text-foreground"
          >
            Design system
          </Link>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
          >
            <GithubIcon size={14} />
            GitHub
          </a>
        </nav>
      </div>
    </footer>
  )
}
