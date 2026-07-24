import { auth } from '@clerk/nextjs/server'
import { Header, ThemeToggle } from '@domainproof/ui'
import { AuthCta } from '@/components/header/auth-cta'
import { MarketingBrand } from '@/components/header/marketing-brand'

/**
 * The real Header, variant="glass" — same instance the marketing pages and
 * locked create-project screen use. Its default max-w-5xl content column is
 * lifted via contentClassName (max-w-none — overriding the gutter the
 * shared chrome does define on its own, rather than lining up with one the
 * caller defines) so the logo and Dashboard button sit flush against the
 * true screen edges, matching the sidebar and TOC rails below it rather
 * than a centered column.
 *
 * Left slot is `MarketingBrand` with `docsActive` — the same "DomainProof ·
 * Docs" lockup the marketing header links out with, except "Docs" is the
 * current page here rather than a link back to itself. Right slot pairs the
 * same icon `ThemeToggle` the marketing header's actions cluster uses with
 * this page's own AuthCta — resolved here via its own `auth()` call rather
 * than threading it down from the marketing layout, since docs pages
 * aren't under that layout. `variant="default"` and `showIcon={false}` keep
 * the CTA pixel-identical to this button's pre-AuthCta look: a plain
 * bordered text button, no icon.
 */
export async function DocsHeader() {
  const { userId } = await auth()

  return (
    <Header
      contentClassName="max-w-none gap-4 px-6"
      left={<MarketingBrand docsActive />}
      right={
        <div className="flex items-center gap-3">
          <ThemeToggle variant="icon" className="shrink-0" />
          <AuthCta
            size="sm"
            variant="default"
            showIcon={false}
            initialIsSignedIn={Boolean(userId)}
          />
        </div>
      }
    />
  )
}
