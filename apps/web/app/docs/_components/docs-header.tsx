import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'
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
 * Dashboard link resolves auth state server-side (Clerk's auth()) so a
 * signed-out visitor never bounces through Clerk's hosted sign-in page —
 * every project route is protected (see middleware.ts), so a signed-out
 * click goes to the marketing root instead.
 */
export async function DocsHeader() {
  const { userId } = await auth()

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
          <Link href={userId ? '/active' : '/'}>Dashboard</Link>
        </Button>
      }
    />
  )
}
