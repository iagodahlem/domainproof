'use client'

import { useState } from 'react'
import type { KeyboardEvent } from 'react'
import { ChevronRight } from 'lucide-react'
import { Badge, CopyButton, TableCell, TableRow, cn } from '@domainproof/ui'
import type { ProjectEventSummary } from '@/lib/api/dashboard'

export interface EventRowProps {
  event: ProjectEventSummary
}

export const EVENT_GRID_COLS = 'grid-cols-[1fr_1fr_70px_150px_16px] gap-x-4'

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

/**
 * One event row. Clicking it (or Enter/Space) expands the raw payload
 * flush on the surface below — no boxed container around the JSON, the
 * same "plain language first, raw detail on demand" idea as the hosted
 * page's verification log, applied to a table row instead of a
 * `<details>` toggle (see the board's rationale for this treatment).
 */
export function EventRow({ event }: EventRowProps) {
  const [expanded, setExpanded] = useState(false)

  function handleKeyDown(keyboardEvent: KeyboardEvent<HTMLDivElement>) {
    if (keyboardEvent.key === 'Enter' || keyboardEvent.key === ' ') {
      keyboardEvent.preventDefault()
      setExpanded((value) => !value)
    }
  }

  const payloadText = JSON.stringify(event.payload, null, 2)

  return (
    <>
      <TableRow
        role="button"
        tabIndex={0}
        onClick={() => setExpanded((value) => !value)}
        onKeyDown={handleKeyDown}
        className={cn(
          EVENT_GRID_COLS,
          'max-[760px]:flex max-[760px]:flex-wrap max-[760px]:items-center max-[760px]:gap-x-3 max-[760px]:gap-y-2 max-[760px]:p-4',
        )}
      >
        <TableCell className="max-[760px]:order-1">
          <Badge tone="neutral">{event.type}</Badge>
        </TableCell>
        <TableCell className="truncate font-mono text-sm max-[760px]:order-2 max-[760px]:min-w-0 max-[760px]:flex-1">
          {event.domain}
        </TableCell>
        <TableCell className="max-[760px]:order-3">
          <Badge tone={event.mode === 'live' ? 'success' : 'warning'} mode>
            {event.mode === 'live' ? 'Live' : 'Test'}
          </Badge>
        </TableCell>
        <TableCell className="text-xs text-text-faint max-[760px]:order-4 max-[760px]:basis-full max-[760px]:pl-1">
          {formatTime(event.createdAt)}
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
          <div className="mb-3 flex items-center justify-between gap-3">
            <Badge tone="neutral">Payload</Badge>
            <CopyButton value={payloadText} size="sm">
              Copy
            </CopyButton>
          </div>
          <pre className="overflow-x-auto font-mono text-xs leading-code whitespace-pre-wrap break-words text-text-muted">
            {payloadText}
          </pre>
        </div>
      ) : null}
    </>
  )
}
