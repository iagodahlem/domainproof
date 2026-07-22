'use client'

import { cva } from 'class-variance-authority'
import {
  Menu,
  MenuContent,
  MenuSeparator,
  MenuTrigger,
  cn,
} from '@domainproof/ui'
import { SignOutButton } from './sign-out-button'

const triggerVariants = cva(
  'inline-flex items-center rounded-full border border-border-strong bg-surface p-1 transition-colors duration-150 hover:bg-surface-2',
  {
    variants: {
      iconOnly: {
        true: '',
        // `w-full` fills the sidebar's own column (truncating the email
        // there); `max-w-64` is a no-op at that width but caps the pill on
        // the sidebar's mobile strip, where the wrapping row has no
        // definite width of its own to fill.
        false: 'w-full max-w-64 gap-2 pr-3',
      },
    },
    defaultVariants: {
      iconOnly: false,
    },
  },
)

export interface UserMenuProps {
  email: string
  /** Icon-only trigger — just the avatar circle, no email label — for header contexts too narrow for the full pill (e.g. the locked /new screen). The dropdown still shows the full email once opened. The sidebar keeps the default, full-width pill. */
  iconOnly?: boolean
  className?: string
}

/**
 * Account menu trigger — avatar pill (initial circle + email) opening a
 * sign-out dropdown. Lives at the sidebar's bottom (board-conformant); the
 * default trigger sizes to the width of its container (rather than a fixed
 * cap) so the email truncates within whatever space it's given instead of
 * overflowing it. The pill's padding matches the avatar's own radius on
 * every side (`p-1`) so the circle reads as concentrically inset in the
 * pill rather than off-center.
 */
export function UserMenu({
  email,
  iconOnly = false,
  className,
}: UserMenuProps) {
  const initial = email ? email.charAt(0).toUpperCase() : '?'

  return (
    <Menu>
      <MenuTrigger
        aria-label={email ? `Account menu for ${email}` : 'Account menu'}
        className={cn(triggerVariants({ iconOnly }), className)}
      >
        <span
          aria-hidden="true"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft font-mono text-2xs font-bold text-accent"
        >
          {initial}
        </span>
        {email && !iconOnly ? (
          <span className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-foreground">
            {email}
          </span>
        ) : null}
      </MenuTrigger>
      <MenuContent
        align={iconOnly ? 'end' : 'start'}
        aria-label="Account"
        className="w-64"
      >
        {email ? (
          <div className="px-3 py-2 text-xs break-words text-faint-foreground">
            {email}
          </div>
        ) : null}
        <MenuSeparator />
        <SignOutButton variant="menu-item" />
      </MenuContent>
    </Menu>
  )
}
