import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'
import { Header, Logo } from '@domainproof/ui'
import { AuthCta } from '@/components/header/auth-cta'

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
 * Right slot is the same AuthCta the marketing header uses — signed-in
 * "Dashboard" / signed-out "Continue with Google", both resolving to
 * `/app` — resolved here via its own `auth()` call rather than threading
 * it down from the marketing layout, since docs pages aren't under that
 * layout. `variant="default"` and `showIcon={false}` keep it pixel-identical
 * to this button's pre-AuthCta look: a plain bordered text button, no icon.
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
        <AuthCta
          size="sm"
          variant="default"
          showIcon={false}
          initialIsSignedIn={Boolean(userId)}
        />
      }
    />
  )
}
