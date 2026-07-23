'use client'

import { useState } from 'react'
import type { KeyboardEvent } from 'react'
import { ChevronRight } from 'lucide-react'
import {
  Badge,
  Button,
  Callout,
  ConfirmDialog,
  TableCell,
  TableRow,
  cn,
  dotVariants,
} from '@domainproof/ui'
import { ApiError } from '@/lib/query/errors'
import type { WebhookEndpointSummary } from '@/lib/api/dashboard'
import {
  useDeleteWebhookEndpoint,
  useToggleWebhookEndpointDisabled,
  WEBHOOK_EVENT_TYPES,
} from '@/lib/query/webhooks'
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
 * delete (behind a `ConfirmDialog`, converted from an inline `ConfirmBar`
 * for consistency with the domain detail page's delete dialog — see that
 * PR's description), and the endpoint's delivery log — rather than
 * navigating anywhere.
 */
export function EndpointRow({
  projectId,
  endpoint,
  onUpdated,
  onDeleted,
}: EndpointRowProps) {
  const [expanded, setExpanded] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [error, setError] = useState<string>()

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setExpanded((value) => !value)
    }
  }

  const toggleDisabled = useToggleWebhookEndpointDisabled(projectId, endpoint)
  const deleteEndpoint = useDeleteWebhookEndpoint(projectId, endpoint.id)

  const busy = toggleDisabled.isPending || deleteEndpoint.isPending

  function handleToggleDisabled() {
    setError(undefined)
    toggleDisabled.mutate(undefined, {
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
  }

  function handleDelete() {
    setError(undefined)
    deleteEndpoint.mutate(undefined, {
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
        <TableCell className="flex items-center gap-1.5 text-xs text-muted-foreground max-[760px]:order-4 max-[760px]:basis-full max-[760px]:pl-5">
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
              'text-faint-foreground transition-transform duration-150',
              expanded && 'rotate-90',
            )}
          />
        </TableCell>
      </TableRow>

      {expanded ? (
        <div className="border-b border-border bg-surface-2 px-4 py-5 last:border-b-0">
          <div className="mb-4 flex flex-wrap items-center gap-3 text-xs text-faint-foreground">
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

          <ConfirmDialog
            open={confirmingDelete}
            onOpenChange={setConfirmingDelete}
            title="Delete this endpoint?"
            description="Deleting this endpoint stops all future deliveries. This can't be undone."
            confirmLabel="Confirm delete"
            pending={busy}
            // Only surfaced inside the dialog while it's open (a delete
            // attempt failing) — the row's own Callout below covers the
            // same `error` state for a toggle-disabled failure, which
            // never opens this dialog at all.
            error={confirmingDelete ? error : undefined}
            onConfirm={handleDelete}
          />

          {error && !confirmingDelete ? (
            <Callout tone="warning" className="mb-4">
              {error}
            </Callout>
          ) : null}

          <h4 className="mb-3 text-sm font-heading text-foreground">
            Delivery log
          </h4>
          <DeliveryLog projectId={projectId} endpointId={endpoint.id} />
        </div>
      ) : null}
    </>
  )
}
