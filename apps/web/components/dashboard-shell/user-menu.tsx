'use client'

import Link from 'next/link'
import { cva } from 'class-variance-authority'
import { BookOpen, Monitor, Moon, Sun } from 'lucide-react'
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
  SegmentedControl,
  cn,
  useTheme,
} from '@domainproof/ui'
import type { SegmentedControlOption, ThemePreference } from '@domainproof/ui'
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
 * Account menu trigger — avatar pill (initial circle + email) opening the
 * account dropdown. Lives at the sidebar's bottom (board-conformant); the
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
        <div className="flex items-center gap-2.5 px-3 py-2">
          <span
            aria-hidden="true"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft font-mono text-xs font-bold text-accent"
          >
            {initial}
          </span>
          <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">
            {email}
          </span>
        </div>
        <MenuSeparator />
        <MenuItem asChild icon={<BookOpen aria-hidden="true" size={14} />}>
          <Link href="/docs">Docs</Link>
        </MenuItem>
        <SignOutButton variant="menu-item" />
        <MenuSeparator />
        <ThemeFooterRow />
      </MenuContent>
    </Menu>
  )
}

const THEME_OPTIONS: SegmentedControlOption[] = [
  {
    value: 'system',
    label: <Monitor aria-hidden="true" size={13} />,
    tooltip: 'System',
  },
  {
    value: 'light',
    label: <Sun aria-hidden="true" size={13} />,
    tooltip: 'Light',
  },
  {
    value: 'dark',
    label: <Moon aria-hidden="true" size={13} />,
    tooltip: 'Dark',
  },
]

/**
 * The dropdown's own footer, not a `MenuItem` — a segmented control needs
 * to stay interactive (click through System/Light/Dark repeatedly) without
 * Radix treating the click as an item selection and closing the menu, which
 * a `MenuItem`'s `onSelect` would do by default even with
 * `preventDefault()` fighting it on every click.
 */
function ThemeFooterRow() {
  const { preference, setThemePreference } = useTheme()

  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2">
      <span className="text-xs font-semibold text-faint-foreground">Theme</span>
      <SegmentedControl
        aria-label="Theme"
        size="sm"
        options={THEME_OPTIONS}
        value={preference}
        onChange={(value) => setThemePreference(value as ThemePreference)}
        renderTab={(tab) => (
          <MenuItem asChild bare onSelect={(event) => event.preventDefault()}>
            {tab}
          </MenuItem>
        )}
      />
    </div>
  )
}
