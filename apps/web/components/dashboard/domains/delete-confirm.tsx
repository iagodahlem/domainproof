'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { AlertTriangle } from 'lucide-react'
import { Button, Callout } from '@domainproof/ui'
import { ApiError } from '@/lib/api/request'
import { dashboardApi } from '@/lib/api/dashboard'

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
  const { getToken } = useAuth()
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | undefined>()

  async function handleConfirm() {
    setDeleting(true)
    setError(undefined)
    try {
      const token = await getToken()
      await dashboardApi.deleteDomain(token, projectId, domainId)
      router.push(`/dashboard/${projectId}/domains`)
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Something went wrong. Please try again.',
      )
      setDeleting(false)
    }
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
            Deleting <strong className="text-text">{domainName}</strong> stops
            all checks and revokes its hosted verification link immediately. Any
            product feature gated on this domain&rsquo;s verified status will
            see it disappear, not just go unverified.
          </span>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button size="sm" onClick={onCancel} disabled={deleting}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="danger-ghost"
            onClick={() => void handleConfirm()}
            loading={deleting}
          >
            Confirm delete
          </Button>
        </div>
      </Callout>
      {error ? <Callout tone="warning">{error}</Callout> : null}
    </div>
  )
}
