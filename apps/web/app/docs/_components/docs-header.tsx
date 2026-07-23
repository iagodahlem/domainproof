import Link from 'next/link'
import { Button, Header, Logo } from '@domainproof/ui'

/**
 * The real Header, variant="glass" — same instance the marketing pages and
 * locked create-project screen use. Widened from its default max-w-5xl to
 * max-w-7xl via contentClassName (built for exactly this: lining a caller's
 * content up with a gutter the shared chrome doesn't define on its own) so
 * it lines up with the docs body's sidebar+content+toc row below it. Right
 * slot omits the board's search pill per the one directed exception —
 * everything else here is unchanged from the board.
 */
export function DocsHeader() {
  return (
    <Header
      contentClassName="mx-auto max-w-7xl gap-4 px-6"
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
          <Link href="/dashboard">Dashboard</Link>
        </Button>
      }
    />
  )
}
