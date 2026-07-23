'use client'

import { useState } from 'react'
import { RotateCw } from 'lucide-react'
import {
  Badge,
  Button,
  Callout,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
  cn,
  type Tone,
} from '@domainproof/ui'
import { ApiError } from '@/lib/query/errors'
import type { WebhookDeliverySummary } from '@/lib/api/dashboard'
import { formatTimestamp } from '@/lib/format-timestamp'
import {
  useRedeliverWebhookDelivery,
  useWebhookDeliveries,
} from '@/lib/query/webhooks'

export interface DeliveryLogProps {
  projectId: string
  endpointId: string
}

const GRID_COLS = 'grid-cols-[64px_1fr_72px_120px_100px] gap-x-4'

function statusTone(delivery: WebhookDeliverySummary): Tone {
  if (delivery.status === 'succeeded') return 'success'
  if (delivery.status === 'failed') return 'danger'
  return 'warning'
}

function responseLabel(delivery: WebhookDeliverySummary): string {
  if (delivery.responseStatus != null) return String(delivery.responseStatus)
  return delivery.status === 'pending' ? 'Pending' : '—'
}

function errorMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : 'Something went wrong. Please try again.'
}

/**
 * A single endpoint's delivery log — lazily loaded the first time a
 * `EndpointRow` expands, cursor-paginated via "Load more" (`useInfiniteQuery`,
 * one page per cursor). `redeliver` fires a fresh delivery (attempt 1 of a
 * new row, not a mutation of the original) and prepends it to the first
 * cached page, matching the API's own semantics.
 */
export function DeliveryLog({ projectId, endpointId }: DeliveryLogProps) {
  const [redeliveringId, setRedeliveringId] = useState<string | null>(null)
  const [redeliverError, setRedeliverError] = useState<string>()

  const deliveriesQuery = useWebhookDeliveries(projectId, endpointId)
  const redeliver = useRedeliverWebhookDelivery(projectId, endpointId)

  function handleRedeliver(deliveryId: string) {
    setRedeliverError(undefined)
    setRedeliveringId(deliveryId)
    redeliver.mutate(deliveryId, {
      onError: (err) => {
        console.error('Failed to redeliver webhook delivery', err)
        setRedeliverError(errorMessage(err))
      },
      onSettled: () => setRedeliveringId(null),
    })
  }

  if (deliveriesQuery.isLoading) {
    return <p className="text-sm text-faint-foreground">Loading deliveries…</p>
  }

  if (deliveriesQuery.isError && !deliveriesQuery.data) {
    return (
      <Callout tone="warning">{errorMessage(deliveriesQuery.error)}</Callout>
    )
  }

  const deliveries = deliveriesQuery.data?.pages.flatMap(
    (page) => page.deliveries,
  )

  if (!deliveries || deliveries.length === 0) {
    return <p className="text-sm text-faint-foreground">No deliveries yet.</p>
  }

  // A "Load more" failure keeps the already-loaded pages (`deliveriesQuery.data`
  // stays populated), so the initial-load guard above never catches it —
  // surface it here instead, without hiding the list already on screen.
  const loadMoreError = deliveriesQuery.isError
    ? errorMessage(deliveriesQuery.error)
    : undefined

  return (
    <div className="flex flex-col gap-3">
      {redeliverError || loadMoreError ? (
        <Callout tone="warning">{redeliverError ?? loadMoreError}</Callout>
      ) : null}
      <Table>
        <TableBody>
          <TableHeader className={cn(GRID_COLS, 'max-[760px]:hidden')}>
            <span>Attempt</span>
            <span>Event</span>
            <span>Response</span>
            <span>Timestamp</span>
            <span />
          </TableHeader>
          {deliveries.map((delivery) => (
            <TableRow
              key={delivery.id}
              className={cn(
                GRID_COLS,
                'max-[760px]:flex max-[760px]:flex-wrap max-[760px]:items-center max-[760px]:gap-x-3 max-[760px]:gap-y-2 max-[760px]:p-4',
              )}
            >
              <TableCell className="font-mono text-2xs text-faint-foreground">
                #{delivery.attempt}
              </TableCell>
              <TableCell>
                <Badge tone="accent">{delivery.eventType}</Badge>
              </TableCell>
              <TableCell>
                <Badge tone={statusTone(delivery)}>
                  {responseLabel(delivery)}
                </Badge>
              </TableCell>
              <TableCell className="text-xs text-faint-foreground">
                {formatTimestamp(delivery.createdAt)}
              </TableCell>
              <TableCell className="max-[760px]:basis-full">
                <Button
                  size="sm"
                  disabled={redeliveringId === delivery.id}
                  onClick={() => handleRedeliver(delivery.id)}
                >
                  <RotateCw aria-hidden="true" size={12} />
                  Redeliver
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {deliveriesQuery.hasNextPage ? (
        <Button
          size="sm"
          onClick={() => deliveriesQuery.fetchNextPage()}
          loading={deliveriesQuery.isFetchingNextPage}
          className="self-start"
        >
          Load more
        </Button>
      ) : null}
    </div>
  )
}
