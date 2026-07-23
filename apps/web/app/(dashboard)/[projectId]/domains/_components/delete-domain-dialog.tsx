'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ConfirmDialog } from '@domainproof/ui'
import { ApiError } from '@/lib/query/errors'
import { useDeleteDomain } from '@/lib/query/domains'

export interface DeleteDomainDialogProps {
  projectId: string
  domainId: string
  domainName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Domain delete confirmation, triggered from the header's overflow menu —
 * a modal rather than `ConfirmBar`'s inline expansion, since a menu item
 * has no natural inline slot below it to expand into. Owns the delete call
 * itself so the trigger only needs to toggle whether this is open.
 *
 * `isNavigating` keeps the dialog in its pending state across the gap
 * between the delete request resolving and `router.push` actually landing
 * on the domains list — otherwise the mutation's own `isPending` flips back
 * to false the instant the request succeeds, the confirm button pops back
 * to its idle, clickable state, and the dialog just sits there doing
 * nothing for however long the navigation takes. The dialog unmounts with
 * the page once the navigation completes, so nothing ever resets it back to
 * false on the happy path.
 *
 * The dialog stays mounted (just hidden) between opens rather than
 * unmounting, so a failed attempt's `error` would otherwise still be
 * sitting in state the next time this reopens — reset it whenever `open`
 * flips true, rather than trying to catch that in `onOpenChange` (which
 * only fires for Radix-driven dismissal, never for the parent flipping its
 * own `open` prop back on).
 */
export function DeleteDomainDialog({
  projectId,
  domainId,
  domainName,
  open,
  onOpenChange,
}: DeleteDomainDialogProps) {
  const router = useRouter()
  const [error, setError] = useState<string | undefined>()
  const [isNavigating, setIsNavigating] = useState(false)

  const deleteDomain = useDeleteDomain(projectId, domainId)
  const pending = deleteDomain.isPending || isNavigating

  useEffect(() => {
    if (open) setError(undefined)
  }, [open])

  function handleConfirm() {
    setError(undefined)
    deleteDomain.mutate(undefined, {
      onSuccess: () => {
        setIsNavigating(true)
        router.push(`/${projectId}/domains`)
      },
      onError: (err) => {
        setError(
          err instanceof ApiError
            ? err.message
            : 'Something went wrong. Please try again.',
        )
      },
    })
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Delete ${domainName}?`}
      description={
        <>
          Deleting <strong className="text-foreground">{domainName}</strong>{' '}
          stops all checks and revokes its hosted verification link immediately.
          Any product feature gated on this domain&rsquo;s verified status will
          see it disappear, not just go unverified.
        </>
      }
      confirmLabel="Confirm delete"
      pending={pending}
      error={error}
      onConfirm={handleConfirm}
    />
  )
}
