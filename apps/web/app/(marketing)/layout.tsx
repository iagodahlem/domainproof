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
