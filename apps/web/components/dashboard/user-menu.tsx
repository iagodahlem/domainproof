'use client'

import { Menu, MenuContent, MenuSeparator, MenuTrigger } from '@domainproof/ui'
import { SignOutButton } from './sign-out-button'

export interface UserMenuProps {
  email: string
}

/**
 * Account menu trigger — avatar pill (initial circle + email) opening a
 * sign-out dropdown. Lives at the sidebar's bottom (board-conformant) and
 * is reused as-is in the locked /new screen's header. The pill's padding
 * matches the avatar's own radius on every side (`p-1`) so the circle
 * reads as concentrically inset in the pill rather than off-center.
 */
export function UserMenu({ email }: UserMenuProps) {
  const initial = email ? email.charAt(0).toUpperCase() : '?'

  return (
    <Menu>
      <MenuTrigger
        aria-label={email ? `Account menu for ${email}` : 'Account menu'}
        className="inline-flex max-w-64 items-center gap-2 rounded-full border border-border-strong bg-surface p-1 pr-3 transition-colors duration-150 hover:bg-surface-2"
      >
        <span
          aria-hidden="true"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft font-mono text-2xs font-bold text-accent"
        >
          {initial}
        </span>
        {email ? (
          <span className="min-w-0 truncate text-left text-sm font-semibold text-foreground">
            {email}
          </span>
        ) : null}
      </MenuTrigger>
      <MenuContent align="end" aria-label="Account">
        {email ? (
          <div className="truncate px-3 py-2 text-xs text-faint-foreground">
            {email}
          </div>
        ) : null}
        <MenuSeparator />
        <SignOutButton variant="menu-item" />
      </MenuContent>
    </Menu>
  )
}
