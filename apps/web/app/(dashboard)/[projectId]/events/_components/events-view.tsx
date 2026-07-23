'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
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
import type { Mode } from '@/lib/api/dashboard'
import {
  projectEventsKey,
  useListProjectEvents,
  useProjectEvents,
} from '@/lib/query/events'
import type { ProjectEventsPage } from '@/lib/query/events'
import { EventRow, EVENT_GRID_COLS } from './event-row'

export interface EventsViewProps {
  projectId: string
  mode: Mode
}

/**
 * Project-wide events table — every verification event for the project's
 * domains in the active mode, newest first. No search: the API gives no
 * filter beyond cursor pagination and mode, and the board calls the table
 * short enough to scan directly.
 */
export function EventsView({ projectId, mode }: EventsViewProps) {
  const queryClient = useQueryClient()
  const { data } = useProjectEvents(projectId, mode)
  const { events, nextCursor: cursor } = data
  const [loadMoreError, setLoadMoreError] = useState<string>()

  const loadMoreEvents = useListProjectEvents(projectId, mode)

  function loadMore() {
    if (!cursor) return
    setLoadMoreError(undefined)
    loadMoreEvents.mutate(cursor, {
      onSuccess: (result) => {
        queryClient.setQueryData<ProjectEventsPage>(
          projectEventsKey(projectId, mode),
          (current) => ({
            events: [...(current?.events ?? []), ...result.events],
            nextCursor: result.nextCursor,
          }),
        )
      },
      onError: (err) => {
        console.error('Failed to load more events', err)
        setLoadMoreError(
          err instanceof ApiError
            ? err.message
            : 'Something went wrong. Please try again.',
        )
      },
    })
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

      {loadMoreError ? <Callout tone="warning">{loadMoreError}</Callout> : null}

      {cursor ? (
        <Button
          size="sm"
          onClick={loadMore}
          loading={loadMoreEvents.isPending}
          className="self-start"
        >
          Load more
        </Button>
      ) : null}
    </div>
  )
}
