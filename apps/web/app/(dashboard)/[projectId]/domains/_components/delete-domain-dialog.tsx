'use client'

import { useState } from 'react'
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

  const deleteDomain = useDeleteDomain(projectId, domainId)

  function handleConfirm() {
    setError(undefined)
    deleteDomain.mutate(undefined, {
      onSuccess: () => router.push(`/${projectId}/domains`),
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
      onOpenChange={(next) => {
        onOpenChange(next)
        if (next) setError(undefined)
      }}
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
      pending={deleteDomain.isPending}
      error={error}
      onConfirm={handleConfirm}
    />
  )
}
