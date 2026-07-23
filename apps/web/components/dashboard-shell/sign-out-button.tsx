'use client'

import { useState } from 'react'
import { useClerk } from '@clerk/nextjs'
import { LogOut } from 'lucide-react'
import { Button, MenuItem, type ButtonProps } from '@domainproof/ui'

export interface SignOutButtonProps {
  /** `menu-item`: renders inside a dropdown `Menu` (the topbar account menu). `button` (default): a standalone `Button`, e.g. a page header. */
  variant?: 'menu-item' | 'button'
  redirectUrl?: string
  size?: ButtonProps['size']
  className?: string
}

/**
 * Wraps Clerk's `signOut` with a local loading state so the click gets
 * immediate feedback instead of appearing to do nothing until the redirect
 * lands. In the `menu-item` variant, selecting the item is prevented from
 * closing the dropdown so the loading state stays visible.
 */
export function SignOutButton({
  variant = 'button',
  redirectUrl = '/',
  size,
  className,
}: SignOutButtonProps) {
  const { signOut } = useClerk()
  const [loading, setLoading] = useState(false)

  function handleSignOut() {
    setLoading(true)
    void signOut({ redirectUrl })
  }

  if (variant === 'menu-item') {
    return (
      <MenuItem
        tone="danger"
        icon={<LogOut aria-hidden="true" size={14} />}
        disabled={loading}
        onSelect={(event) => {
          event.preventDefault()
          handleSignOut()
        }}
      >
        {loading ? 'Signing out…' : 'Sign out'}
      </MenuItem>
    )
  }

  return (
    <Button
      size={size}
      className={className}
      loading={loading}
      onClick={handleSignOut}
    >
      Sign out
    </Button>
  )
}
