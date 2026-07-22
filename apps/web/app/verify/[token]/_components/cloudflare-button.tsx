'use client'

import { useState } from 'react'
import { Button } from '@domainproof/ui'

export interface CloudflareButtonProps {
  authorizeUrl: string
}

/**
 * A real `<button>` (not `Button asChild` wrapping an `<a>`) so the
 * built-in `loading`/`disabled`/spinner handling — which only exists on
 * `Button`'s native-element branch, not its `Slot` branch — applies while
 * the browser is mid-navigation to Cloudflare's consent screen.
 */
export function CloudflareButton({ authorizeUrl }: CloudflareButtonProps) {
  const [redirecting, setRedirecting] = useState(false)

  function handleClick() {
    setRedirecting(true)
    window.location.href = authorizeUrl
  }

  return (
    <Button
      type="button"
      variant="primary"
      loading={redirecting}
      onClick={handleClick}
      className="w-fit"
    >
      Add this record for me
    </Button>
  )
}
