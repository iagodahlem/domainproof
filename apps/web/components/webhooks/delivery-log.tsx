'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/nextjs'
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
import { ApiError, dashboardApi, type WebhookDeliverySummary } from '@/lib/api'

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

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * A single endpoint's delivery log — lazily loaded the first time a
 * `EndpointRow` expands, cursor-paginated via "Load more". `redeliver`
 * fires a fresh delivery (attempt 1 of a new row, not a mutation of the
 * original) and prepends it, matching the API's own semantics.
 */
export function DeliveryLog({ projectId, endpointId }: DeliveryLogProps) {
  const { getToken } = useAuth()
  const [deliveries, setDeliveries] = useState<WebhookDeliverySummary[] | null>(
    null,
  )
  const [cursor, setCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string>()
  const [redeliveringId, setRedeliveringId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(undefined)
      try {
        const token = await getToken()
        const result = await dashboardApi.listWebhookDeliveries(
          token,
          projectId,
          endpointId,
        )
        if (cancelled) return
        setDeliveries(result.deliveries)
        setCursor(result.nextCursor)
      } catch (err) {
        if (cancelled) return
        setError(
          err instanceof ApiError
            ? err.message
            : 'Something went wrong. Please try again.',
        )
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [getToken, projectId, endpointId])

  async function loadMore() {
    if (!cursor) return
    setLoadingMore(true)
    try {
      const token = await getToken()
      const result = await dashboardApi.listWebhookDeliveries(
        token,
        projectId,
        endpointId,
        { cursor },
      )
      setDeliveries((prev) => [...(prev ?? []), ...result.deliveries])
      setCursor(result.nextCursor)
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Something went wrong. Please try again.',
      )
    } finally {
      setLoadingMore(false)
    }
  }

  async function handleRedeliver(deliveryId: string) {
    setRedeliveringId(deliveryId)
    try {
      const token = await getToken()
      const { delivery } = await dashboardApi.redeliverWebhookDelivery(
        token,
        projectId,
        endpointId,
        deliveryId,
      )
      setDeliveries((prev) => [delivery, ...(prev ?? [])])
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Something went wrong. Please try again.',
      )
    } finally {
      setRedeliveringId(null)
    }
  }

  if (loading) {
    return <p className="text-sm text-text-faint">Loading deliveries…</p>
  }

  if (error) {
    return <Callout tone="warning">{error}</Callout>
  }

  if (!deliveries || deliveries.length === 0) {
    return <p className="text-sm text-text-faint">No deliveries yet.</p>
  }

  return (
    <div className="flex flex-col gap-3">
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
              <TableCell className="font-mono text-2xs text-text-faint">
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
              <TableCell className="text-xs text-text-faint">
                {formatTime(delivery.createdAt)}
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
      {cursor ? (
        <Button
          size="sm"
          onClick={loadMore}
          loading={loadingMore}
          className="self-start"
        >
          Load more
        </Button>
      ) : null}
    </div>
  )
}
