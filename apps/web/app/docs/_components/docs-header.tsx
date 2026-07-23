import Link from 'next/link'
import { Button, Header, Logo } from '@domainproof/ui'

/**
 * The real Header, variant="glass" — same instance the marketing pages and
 * locked create-project screen use. Its default max-w-5xl content column is
 * lifted via contentClassName (max-w-none — overriding the gutter the
 * shared chrome does define on its own, rather than lining up with one the
 * caller defines) so the logo and Dashboard button sit flush against the
 * true screen edges, matching the sidebar and TOC rails below it rather
 * than a centered column. Right slot omits the board's search pill per the
 * one directed exception — everything else here is unchanged from the
 * board.
 *
 * Dashboard links straight to `/app` — the single resolver route that
 * lands a signed-in visitor on their active project, or bounces a
 * signed-out one to sign-in (see middleware.ts). No per-render auth check
 * or project lookup needed here.
 */
export function DocsHeader() {
  return (
    <Header
      contentClassName="max-w-none gap-4 px-6"
      left={
        <div className="flex items-center gap-3">
          <Link href="/docs">
            <Logo />
          </Link>
          <span className="border-l border-border-strong pl-3 font-mono text-2xs text-faint-foreground">
            docs
          </span>
        </div>
      }
      right={
        <Button asChild size="sm">
          <Link href="/app">Dashboard</Link>
        </Button>
      }
    />
  )
}
