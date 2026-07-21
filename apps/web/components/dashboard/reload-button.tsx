'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@domainproof/ui'

/** Re-renders the current server component tree — used by the shell's error state to retry the projects fetch without a full page reload. */
export function ReloadButton() {
  const router = useRouter()
  return <Button onClick={() => router.refresh()}>Try again</Button>
}
