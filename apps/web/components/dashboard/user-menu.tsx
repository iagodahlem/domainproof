'use client'

import { Menu, MenuContent, MenuSeparator, MenuTrigger } from '@domainproof/ui'
import { SignOutButton } from './sign-out-button'

export interface UserMenuProps {
  email: string
}

/** Topbar account menu — email + sign-out (deviation from the board mock, which puts this row at the sidebar's bottom instead; see the PR description). */
export function UserMenu({ email }: UserMenuProps) {
  const initial = email ? email.charAt(0).toUpperCase() : '?'

  return (
    <Menu>
      <MenuTrigger
        aria-label={email ? `Account menu for ${email}` : 'Account menu'}
        className="flex items-center gap-2 rounded-full border border-border-strong bg-surface px-2 py-1 transition-colors duration-150 hover:bg-surface-2"
      >
        <span
          aria-hidden="true"
          className="flex h-6.5 w-6.5 shrink-0 items-center justify-center rounded-full bg-accent-soft font-mono text-2xs font-bold text-accent"
        >
          {initial}
        </span>
        {email ? (
          <span className="max-w-40 truncate text-sm font-semibold text-text max-[640px]:hidden">
            {email}
          </span>
        ) : null}
      </MenuTrigger>
      <MenuContent align="end" aria-label="Account">
        {email ? (
          <div className="truncate px-3 py-2 text-xs text-text-faint">
            {email}
          </div>
        ) : null}
        <MenuSeparator />
        <SignOutButton variant="menu-item" />
      </MenuContent>
    </Menu>
  )
}
