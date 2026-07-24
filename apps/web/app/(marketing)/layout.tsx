import type { ReactNode } from 'react'
import { auth } from '@clerk/nextjs/server'
import { Header } from '@domainproof/ui'
import { MarketingActions } from '@/components/header/marketing-actions'
import { MarketingBrand } from '@/components/header/marketing-brand'
import { MarketingFooter } from '@/components/footer/marketing-footer'

/**
 * The landing page and the design system share this header and footer —
 * resolved/rendered once here so neither page calls `auth()` just to paint
 * its chrome, and neither page renders its own footer. `/sso-callback`
 * lives in its own `(auth)` group, not under here, so it never inherits
 * either. The `min-h-svh flex-col` wrapper puts the footer in the same
 * flex column as the header and page content, so a page that opts into
 * `flex-1` sizing (like the landing page) fills exactly one viewport with
 * the footer at the bottom, instead of the footer trailing off below a
 * fold-height page.
 */
export default async function MarketingLayout({
  children,
}: {
  children: ReactNode
}) {
  const { userId } = await auth()

  return (
    <div className="flex min-h-svh flex-col">
      <Header
        left={<MarketingBrand />}
        right={<MarketingActions isSignedIn={Boolean(userId)} />}
      />
      {children}
      <MarketingFooter />
    </div>
  )
}
