'use client'

import { useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useMutation } from '@tanstack/react-query'
import { ChevronRight } from 'lucide-react'
import {
  Badge,
  Button,
  Callout,
  ConfirmBar,
  TableCell,
  TableRow,
  cn,
  dotVariants,
} from '@domainproof/ui'
import { ApiError } from '@/lib/api/request'
import {
  dashboardApi,
  WEBHOOK_EVENT_TYPES,
  type WebhookEndpointSummary,
} from '@/lib/api/dashboard'
import { DeliveryLog } from './delivery-log'

export interface EndpointRowProps {
  projectId: string
  endpoint: WebhookEndpointSummary
  onUpdated: (endpoint: WebhookEndpointSummary) => void
  onDeleted: (endpointId: string) => void
}

export const ENDPOINT_GRID_COLS = 'grid-cols-[10px_1fr_170px_90px_16px] gap-x-4'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function eventsSummary(eventTypes: string[]): { label: string; extra: number } {
  if (eventTypes.length === WEBHOOK_EVENT_TYPES.length) {
    return { label: 'All events', extra: 0 }
  }
  const [first, ...rest] = eventTypes
  return { label: first ?? '—', extra: rest.length }
}

/**
 * One endpoint row. Clicking it (or Enter/Space when focused) expands an
 * inline detail panel below — mode, masked signing secret, enable/disable,
 * delete (behind a `ConfirmBar`), and the endpoint's delivery log — rather
 * than navigating anywhere, matching this design system's no-modal
 * convention.
 */
export function EndpointRow({
  projectId,
  endpoint,
  onUpdated,
  onDeleted,
}: EndpointRowProps) {
  const { getToken } = useAuth()
  const [expanded, setExpanded] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [error, setError] = useState<string>()

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setExpanded((value) => !value)
    }
  }

  const toggleDisabled = useMutation({
    mutationFn: async () => {
      const token = await getToken()
      const { endpoint: updated } = endpoint.disabled
        ? await dashboardApi.enableWebhookEndpoint(
            token,
            projectId,
            endpoint.id,
          )
        : await dashboardApi.disableWebhookEndpoint(
            token,
            projectId,
            endpoint.id,
          )
      return updated
    },
    onSuccess: onUpdated,
    onError: (err) => {
      console.error('Failed to toggle webhook endpoint', err)
      setError(
        err instanceof ApiError
          ? err.message
          : 'Something went wrong. Please try again.',
      )
    },
  })

  const deleteEndpoint = useMutation({
    mutationFn: async () => {
      const token = await getToken()
      await dashboardApi.deleteWebhookEndpoint(token, projectId, endpoint.id)
    },
    onSuccess: () => onDeleted(endpoint.id),
    onError: (err) => {
      console.error('Failed to delete webhook endpoint', err)
      setError(
        err instanceof ApiError
          ? err.message
          : 'Something went wrong. Please try again.',
      )
    },
  })

  const busy = toggleDisabled.isPending || deleteEndpoint.isPending

  function handleToggleDisabled() {
    setError(undefined)
    toggleDisabled.mutate()
  }

  function handleDelete() {
    setError(undefined)
    deleteEndpoint.mutate()
  }

  const summary = eventsSummary(endpoint.eventTypes)

  return (
    <>
      <TableRow
        role="button"
        tabIndex={0}
        onClick={() => setExpanded((value) => !value)}
        onKeyDown={handleKeyDown}
        className={cn(
          ENDPOINT_GRID_COLS,
          'py-2.5',
          'max-[760px]:flex max-[760px]:flex-wrap max-[760px]:items-center max-[760px]:gap-x-3 max-[760px]:gap-y-2 max-[760px]:p-4',
        )}
      >
        <TableCell className="flex items-center max-[760px]:order-1">
          <span
            className={dotVariants({
              tone: endpoint.disabled ? 'neutral' : 'success',
            })}
          />
        </TableCell>
        <TableCell className="truncate font-mono text-sm max-[760px]:order-2 max-[760px]:min-w-0 max-[760px]:flex-1">
          {endpoint.url}
        </TableCell>
        <TableCell className="flex items-center gap-1.5 text-xs text-text-muted max-[760px]:order-4 max-[760px]:basis-full max-[760px]:pl-5">
          <span className="truncate font-mono">{summary.label}</span>
          {summary.extra > 0 ? (
            <Badge tone="neutral">+{summary.extra}</Badge>
          ) : null}
        </TableCell>
        <TableCell className="max-[760px]:order-3">
          <Badge tone={endpoint.disabled ? 'neutral' : 'success'}>
            {endpoint.disabled ? 'Disabled' : 'Active'}
          </Badge>
        </TableCell>
        <TableCell className="justify-self-end max-[760px]:hidden">
          <ChevronRight
            aria-hidden="true"
            size={16}
            className={cn(
              'text-text-faint transition-transform duration-150',
              expanded && 'rotate-90',
            )}
          />
        </TableCell>
      </TableRow>

      {expanded ? (
        <div className="border-b border-border bg-surface-2 px-4 py-5 last:border-b-0">
          <div className="mb-4 flex flex-wrap items-center gap-3 text-xs text-text-faint">
            <Badge tone={endpoint.mode === 'live' ? 'success' : 'warning'} mode>
              {endpoint.mode === 'live' ? 'Live' : 'Test'}
            </Badge>
            <span className="font-mono">{endpoint.maskedSecret}</span>
            <span>Created {formatDate(endpoint.createdAt)}</span>
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            <Button size="sm" disabled={busy} onClick={handleToggleDisabled}>
              {endpoint.disabled ? 'Enable' : 'Disable'}
            </Button>
            <Button
              size="sm"
              disabled={busy}
              onClick={() => setConfirmingDelete(true)}
            >
              Delete
            </Button>
          </div>

          {confirmingDelete ? (
            <div className="mb-4">
              <ConfirmBar
                message="Deleting this endpoint stops all future deliveries. This can't be undone."
                confirmLabel="Confirm delete"
                pending={busy}
                onCancel={() => setConfirmingDelete(false)}
                onConfirm={handleDelete}
              />
            </div>
          ) : null}

          {error ? (
            <Callout tone="warning" className="mb-4">
              {error}
            </Callout>
          ) : null}

          <h4 className="mb-3 text-sm font-heading text-text">Delivery log</h4>
          <DeliveryLog projectId={projectId} endpointId={endpoint.id} />
        </div>
      ) : null}
    </>
  )
}
