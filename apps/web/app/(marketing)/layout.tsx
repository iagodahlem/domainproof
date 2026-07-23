import type { ReactNode } from 'react'

/**
 * The landing and design-system pages share the same Header, hoisted into
 * `(chrome)`'s own nested layout; `/sso-callback` has none, so it's a
 * sibling of that group rather than a child, and renders no chrome of its
 * own here. This group boundary exists to keep the public routes physically
 * separate from the auth'd dashboard group.
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
