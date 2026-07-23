import type { ReactNode } from 'react'
import { auth } from '@clerk/nextjs/server'
import { Header } from '@domainproof/ui'
import { MarketingActions } from '@/components/header/marketing-actions'
import { MarketingBrand } from '@/components/header/marketing-brand'

/**
 * The landing page and the design system share this header — resolved once
 * here so neither page calls `auth()` just to paint its chrome. `/sso-callback`
 * lives in its own `(auth)` group, not under here, so it never inherits
 * this header.
 */
export default async function MarketingLayout({
  children,
}: {
  children: ReactNode
}) {
  const { userId } = await auth()

  return (
    <>
      <Header
        left={<MarketingBrand />}
        right={<MarketingActions isSignedIn={Boolean(userId)} />}
      />
      {children}
    </>
  )
}
