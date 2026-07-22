'use client'

import { useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { Activity } from 'lucide-react'
import {
  Button,
  Callout,
  Table,
  TableBody,
  TableHeader,
  cn,
} from '@domainproof/ui'
import { ApiError } from '@/lib/api/request'
import { dashboardApi, type ProjectEventSummary } from '@/lib/api/dashboard'
import { EventRow, EVENT_GRID_COLS } from './event-row'

export interface EventsViewProps {
  projectId: string
  initialEvents: ProjectEventSummary[]
  initialCursor: string | null
}

/**
 * Project-wide events table — every verification event across the
 * project's domains and both modes, newest first. No search: the API
 * gives no filter beyond cursor pagination, and the board calls the
 * table short enough to scan directly.
 */
export function EventsView({
  projectId,
  initialEvents,
  initialCursor,
}: EventsViewProps) {
  const { getToken } = useAuth()
  const [events, setEvents] = useState(initialEvents)
  const [cursor, setCursor] = useState(initialCursor)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string>()

  async function loadMore() {
    if (!cursor) return
    setLoadingMore(true)
    setError(undefined)
    try {
      const token = await getToken()
      const result = await dashboardApi.listProjectEvents(token, projectId, {
        cursor,
      })
      setEvents((prev) => [...prev, ...result.events])
      setCursor(result.nextCursor)
    } catch (err) {
      console.error('Failed to load more events', err)
      setError(
        err instanceof ApiError
          ? err.message
          : 'Something went wrong. Please try again.',
      )
    } finally {
      setLoadingMore(false)
    }
  }

  if (events.length === 0) {
    return (
      <div className="rounded-lg border border-border p-12 text-center">
        <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft text-accent">
          <Activity aria-hidden="true" size={18} />
        </div>
        <h3 className="mb-2 text-lg font-heading text-foreground">
          No events yet
        </h3>
        <p className="mx-auto max-w-[44ch] text-sm text-muted-foreground">
          Every verification event across your project&rsquo;s domains shows up
          here as it happens.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <Table>
        <TableBody>
          <TableHeader className={cn(EVENT_GRID_COLS, 'max-[760px]:hidden')}>
            <span>Type</span>
            <span>Domain</span>
            <span>Mode</span>
            <span>Timestamp</span>
            <span />
          </TableHeader>
          {events.map((event) => (
            <EventRow key={event.id} event={event} />
          ))}
        </TableBody>
      </Table>

      {error ? <Callout tone="warning">{error}</Callout> : null}

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
