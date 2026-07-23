'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle } from 'lucide-react'
import { Button, Callout } from '@domainproof/ui'
import { ApiError } from '@/lib/query/errors'
import { useDeleteDomain } from '@/lib/query/domains'

export interface DeleteConfirmProps {
  projectId: string
  domainId: string
  domainName: string
  onCancel: () => void
}

/**
 * The delete confirm bar — a danger-toned `Callout` extended with its own
 * flex layout to hold an inline button group alongside the message,
 * something no other `Callout` call site needs. Owns the delete call
 * itself so the parent only needs to toggle whether this is mounted.
 */
export function DeleteConfirm({
  projectId,
  domainId,
  domainName,
  onCancel,
}: DeleteConfirmProps) {
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
    <div className="mb-6 flex flex-col gap-3">
      <Callout
        tone="danger"
        className="flex items-start justify-between gap-3 max-[640px]:flex-col"
      >
        <div className="flex items-start gap-2">
          <AlertTriangle
            aria-hidden="true"
            size={15}
            className="mt-0.5 shrink-0 text-danger"
          />
          <span>
            Deleting <strong className="text-foreground">{domainName}</strong>{' '}
            stops all checks and revokes its hosted verification link
            immediately. Any product feature gated on this domain&rsquo;s
            verified status will see it disappear, not just go unverified.
          </span>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            size="sm"
            onClick={onCancel}
            disabled={deleteDomain.isPending}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            variant="danger-ghost"
            onClick={handleConfirm}
            loading={deleteDomain.isPending}
          >
            {deleteDomain.isPending ? null : (
              // Reserves the spinner's own footprint (icon + Button's
              // `gap-2`) so the button doesn't widen — and the callout's
              // message doesn't reflow around it — the moment it does.
              <span
                aria-hidden="true"
                // eslint-disable-next-line better-tailwindcss/no-restricted-classes -- matches ButtonSpinner's own `h-[1em] w-[1em]`: sized relative to the button's font-size, not a fixed token value.
                className="h-[1em] w-[1em]"
              />
            )}
            Confirm delete
          </Button>
        </div>
      </Callout>
      {error ? <Callout tone="warning">{error}</Callout> : null}
    </div>
  )
}
