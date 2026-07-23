import type { ReactNode } from 'react'

/**
 * The landing and design-system pages share the same Header composition
 * (`left={<Logo />}`, `right={<MarketingActions />}`), but `/sso-callback`
 * has none, so there's nothing visual to hoist into this layout without
 * adding chrome to a page that never had any. This group boundary exists
 * to keep the public routes physically separate from the auth'd dashboard
 * group; each chromed page still composes its own `Header` from
 * `@domainproof/ui`.
 */
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      {/* Clerk's Smart CAPTCHA widget mount — must exist in the DOM before
          authenticateWithRedirect() runs from any marketing-page CTA, or
          bot-protected sign-ups fall back to an invisible check that can
          reject real users. Zero-height; lives here so every public page
          that can start a sign-up has it. */}
      <div id="clerk-captcha" />
    </>
  )
}
