import type { ReactNode } from 'react'

/**
 * Every public page (landing, design system, the Clerk sso callback) needs
 * different — or no — header content, so there's nothing visual to hoist
 * here without either duplicating chrome for the landing page or adding it
 * to a page that never had any (`/sso-callback`). This group boundary exists
 * to keep the public routes physically separate from the auth'd dashboard
 * group; each page still composes its own `Header` from `@domainproof/ui`.
 */
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
