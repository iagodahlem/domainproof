import type { ReactNode } from 'react'

/**
 * `/sso-callback` and `/app` both render nothing visible — the OAuth
 * handshake and the post-auth resolver — so this group gets no marketing
 * header and no dashboard shell, just the root layout's chrome (which is
 * none). Its own group purely so neither route sits under `(marketing)`
 * or `(dashboard)` and picks up chrome it was never meant to have.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
