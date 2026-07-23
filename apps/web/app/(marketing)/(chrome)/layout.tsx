import type { ReactNode } from 'react'
import { auth } from '@clerk/nextjs/server'
import { Header, Logo } from '@domainproof/ui'
import { resolveActiveProjectPath } from '@/lib/project-resolution'
import { MarketingActions } from '@/components/header/marketing-actions'

/**
 * The landing page and the design system share this header — resolved once
 * here so neither page calls `auth()`/`resolveActiveProjectPath` just to
 * paint its chrome. This is a nested group inside `(marketing)`, not the
 * group's own layout, specifically so `/sso-callback` (a sibling of this
 * group, not a child) doesn't inherit the header it never had.
 */
export default async function MarketingChromeLayout({
  children,
}: {
  children: ReactNode
}) {
  const { userId, getToken } = await auth()
  const initialDashboardHref = userId
    ? await resolveActiveProjectPath(await getToken())
    : null

  return (
    <>
      <Header
        left={<Logo />}
        right={<MarketingActions initialDashboardHref={initialDashboardHref} />}
      />
      {children}
    </>
  )
}
