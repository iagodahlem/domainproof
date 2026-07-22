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
import { ApiError } from '@/lib/query/errors'
// loadMore below still hand-rolls its own fetch/state; converting it to a
// lib/query hook is a real behavior change (new request
// de-duplication/caching semantics), so it's deliberately excluded from
// this structural migration and left for an immediate follow-on PR (see
// apps/web/ARCHITECTURE.md).
// eslint-disable-next-line no-restricted-imports -- see note above
import {
  dashboardApi,
  type Mode,
  type ProjectEventSummary,
} from '@/lib/api/dashboard'
import { EventRow, EVENT_GRID_COLS } from './event-row'

export interface EventsViewProps {
  projectId: string
  /** The mode this page's data was loaded for — passed through to `loadMore` so pagination doesn't drift onto the other mode's rows. */
  mode: Mode
  initialEvents: ProjectEventSummary[]
  initialCursor: string | null
}

/**
 * Project-wide events table — every verification event for the project's
 * domains in the active mode, newest first. No search: the API gives no
 * filter beyond cursor pagination and mode, and the board calls the table
 * short enough to scan directly.
 */
export function EventsView({
  projectId,
  mode,
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
        mode,
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
          No {mode} events yet
        </h3>
        <p className="mx-auto max-w-[44ch] text-sm text-muted-foreground">
          Every verification event across your project&rsquo;s {mode} domains
          shows up here as it happens.
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
