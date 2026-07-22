'use client'

import { useEffect, useState } from 'react'
import {
  Callout,
  VerificationLog,
  VerificationLogStatus,
} from '@domainproof/ui'
import type { VerificationEvent } from '@/lib/api/frontend'
// This route mounts no QueryProvider (D-029: no auth/session context on the
// anonymous verification page) — converting to a lib/query hook would mean
// adding one, a real behavior change rather than a structural move (see
// apps/web/ARCHITECTURE.md).
// eslint-disable-next-line no-restricted-imports -- see note above
import { listVerificationEvents } from '@/lib/api/frontend'

export interface TimelineSectionProps {
  token: string
  /** Bumped by the parent (e.g. the verification's own `updatedAt`) whenever a poll or manual recheck sees new data — refetches the feed so a just-published event shows up without a full page reload. */
  refreshKey?: string
}

const EVENTS_PAGE_LIMIT = 20

interface EventDescription {
  summary: string
  tone: 'ok' | 'warn'
}

/** Plain-English narration for the raw `DomainEventMap` types this feed returns — see README.md's Webhooks section for the full type list. */
function describeEvent(event: VerificationEvent): EventDescription {
  switch (event.type) {
    case 'domain.claimed':
      return {
        summary: 'Domain claimed — a verification record was issued.',
        tone: 'ok',
      }
    case 'domain.check_passed':
      return { summary: 'DNS check passed — the record matched.', tone: 'ok' }
    case 'domain.check_failed':
      return {
        summary: `DNS check didn't pass${event.outcome ? ` (${event.outcome.replace(/_/g, ' ')})` : ''}.`,
        tone: 'warn',
      }
    case 'domain.verified':
      return { summary: 'Domain verified.', tone: 'ok' }
    case 'domain.temporarily_failed':
      return {
        summary:
          'The record went missing or changed — a 72-hour grace window started.',
        tone: 'warn',
      }
    case 'domain.failed':
      return { summary: 'Verification failed.', tone: 'warn' }
    case 'domain.dns_autoconfigured':
      return {
        summary: 'The DNS record was added automatically via Cloudflare.',
        tone: 'ok',
      }
    case 'domain.challenge_regenerated':
      return { summary: 'A fresh verification record was issued.', tone: 'ok' }
    default:
      return { summary: event.type, tone: 'ok' }
  }
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  })
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; events: VerificationEvent[] }

export function TimelineSection({ token, refreshKey }: TimelineSectionProps) {
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    // Don't drop back to the loading skeleton on a refresh triggered by
    // `refreshKey` changing — only the very first fetch should show it;
    // a poll/recheck refresh keeps the current entries visible until the
    // new ones are ready.
    setState((current) =>
      current.status === 'ready' ? current : { status: 'loading' },
    )
    listVerificationEvents(token, { limit: EVENTS_PAGE_LIMIT }).then(
      (result) => {
        if (cancelled) return
        setState(
          result.ok
            ? { status: 'ready', events: result.data.events }
            : { status: 'error' },
        )
      },
    )
    return () => {
      cancelled = true
    }
  }, [token, refreshKey])

  if (state.status === 'loading') {
    return (
      <div
        aria-hidden="true"
        className="h-32 animate-pulse rounded-lg bg-surface-3"
      />
    )
  }

  if (state.status === 'error') {
    return (
      <Callout tone="warning">
        Couldn&apos;t load the verification timeline. Refresh the page to try
        again.
      </Callout>
    )
  }

  const entries = state.events.map((event) => {
    const described = describeEvent(event)
    return {
      id: event.id,
      time: formatTime(event.createdAt),
      summary: described.summary,
      detail: (
        <>
          {event.type}
          {event.outcome ? (
            <>
              {' '}
              →{' '}
              <VerificationLogStatus tone={described.tone}>
                {event.outcome}
              </VerificationLogStatus>
            </>
          ) : null}
        </>
      ),
    }
  })

  return <VerificationLog entries={entries} emptyState="No activity yet." />
}
