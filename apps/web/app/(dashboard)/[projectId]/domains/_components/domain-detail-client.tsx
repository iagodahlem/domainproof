'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Check, ChevronDown, RefreshCw, RotateCw, Trash2 } from 'lucide-react'
import {
  Badge,
  Button,
  Callout,
  RecordCard,
  RecordField,
  StatusPill,
  StatusSummary,
  VerificationLog,
} from '@domainproof/ui'
import { ApiError } from '@/lib/query/errors'
import type {
  DomainCheck,
  DomainDetail,
  DomainEvent,
} from '@/lib/api/dashboard'
import {
  domainEventsKey,
  domainKey,
  useDomain,
  useDomainEvents,
  useListDomainEvents,
  useRegenerateDomain,
  useVerifyDomain,
} from '@/lib/query/domains'
import type { DomainEventsPage } from '@/lib/query/domains'
import { useTopbarSlot } from '@/components/dashboard-shell/topbar-slot'
import { domainStatusPresentation } from '@/lib/domain-status'
import { formatRelativeTime } from '@/lib/format-relative-time'
import { domainStatusSteps } from './domain-status-steps'
import { checkOutcomePresentation } from './domain-check-outcome'
import { toVerificationLogEntries } from './domain-event-log'
import { DeleteConfirm } from './delete-confirm'

export interface DomainDetailClientProps {
  projectId: string
  initialDomain: DomainDetail
  initialEvents: DomainEvent[]
  initialEventsNextCursor: string | null
}

export function DomainDetailClient({
  projectId,
  initialDomain,
  initialEvents,
  initialEventsNextCursor,
}: DomainDetailClientProps) {
  const queryClient = useQueryClient()
  const { data: domain } = useDomain(projectId, initialDomain.id, initialDomain)
  const { data: eventsPage } = useDomainEvents(projectId, initialDomain.id, {
    events: initialEvents,
    nextCursor: initialEventsNextCursor,
  })
  const { events, nextCursor: eventsNextCursor } = eventsPage

  const [lastCheck, setLastCheck] = useState<DomainCheck | null>(null)
  const [verifyError, setVerifyError] = useState<string | undefined>()

  const [regenerateError, setRegenerateError] = useState<string | undefined>()

  const [deleteConfirming, setDeleteConfirming] = useState(false)

  const verifyDomain = useVerifyDomain(projectId, domain.id)
  const regenerateDomain = useRegenerateDomain(projectId, domain.id)
  const loadMoreEvents = useListDomainEvents(projectId, domain.id)

  const presentation = domainStatusPresentation(domain.status)
  const outcome = lastCheck ? checkOutcomePresentation(lastCheck.outcome) : null

  function handleVerify() {
    setVerifyError(undefined)
    verifyDomain.mutate(undefined, {
      onSuccess: (result) => {
        queryClient.setQueryData(domainKey(projectId, domain.id), result.domain)
        queryClient.setQueryData(domainEventsKey(projectId, domain.id), {
          events: result.events,
          nextCursor: result.nextCursor,
        })
        setLastCheck(result.check)
      },
      onError: (error) => {
        setVerifyError(
          error instanceof ApiError
            ? error.message
            : 'Something went wrong. Please try again.',
        )
      },
    })
  }

  function handleRegenerate() {
    setRegenerateError(undefined)
    regenerateDomain.mutate(undefined, {
      onSuccess: (result) => {
        queryClient.setQueryData(domainKey(projectId, domain.id), result.domain)
        queryClient.setQueryData(domainEventsKey(projectId, domain.id), {
          events: result.events,
          nextCursor: result.nextCursor,
        })
        setLastCheck(null)
      },
      onError: (error) => {
        setRegenerateError(
          error instanceof ApiError
            ? error.message
            : 'Something went wrong. Please try again.',
        )
      },
    })
  }

  function handleLoadMoreEvents() {
    if (!eventsNextCursor) return
    loadMoreEvents.mutate(eventsNextCursor, {
      onSuccess: (result) => {
        queryClient.setQueryData<DomainEventsPage>(
          domainEventsKey(projectId, domain.id),
          (current) => ({
            events: [...(current?.events ?? []), ...result.events],
            nextCursor: result.nextCursor,
          }),
        )
      },
    })
  }

  useTopbarSlot({
    back: {
      href: `/${projectId}/domains`,
      label: 'Back to domains',
    },
    title: (
      <div className="flex items-center gap-3">
        <h1 className="font-mono text-base font-heading text-foreground">
          {domain.domain}
        </h1>
        <Badge tone={presentation.tone}>{presentation.label}</Badge>
      </div>
    ),
  })

  return (
    <div>
      <RecordCard
        className="mb-6"
        step={
          domain.status === 'verified' ? (
            <Check aria-hidden="true" size={10} />
          ) : (
            '1'
          )
        }
        stepTone={domain.status === 'verified' ? 'success' : 'accent'}
        title="Ownership record"
        trailing={
          domain.records[0] ? (
            <Badge tone="accent">{domain.records[0].type}</Badge>
          ) : null
        }
      >
        {domain.records.map((record) => (
          <div key={record.name}>
            <RecordField label="Host / Name" value={record.name} copyable />
            <RecordField label="Value" value={record.value} copyable />
          </div>
        ))}
      </RecordCard>

      <StatusSummary
        statusBadge={
          <StatusPill
            tone={presentation.tone}
            size="default"
            pulse={domain.status === 'pending'}
          >
            {presentation.label}
          </StatusPill>
        }
        meta={[
          {
            label: 'Last checked',
            value: formatRelativeTime(domain.updatedAt),
          },
        ]}
        steps={domainStatusSteps(domain)}
      />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Button
          variant="primary"
          size="sm"
          onClick={handleVerify}
          loading={verifyDomain.isPending}
        >
          <RefreshCw aria-hidden="true" size={13} />
          Verify now
        </Button>
        <Button
          size="sm"
          onClick={handleRegenerate}
          loading={regenerateDomain.isPending}
        >
          <RotateCw aria-hidden="true" size={13} />
          Regenerate challenge
        </Button>
        {!deleteConfirming ? (
          <Button
            variant="danger-ghost"
            size="sm"
            onClick={() => setDeleteConfirming(true)}
          >
            <Trash2 aria-hidden="true" size={13} />
            Delete domain
          </Button>
        ) : null}
      </div>

      {outcome ? (
        <Callout tone={outcome.tone} className="mb-6">
          <OutcomeBody outcome={outcome} check={lastCheck} />
        </Callout>
      ) : null}
      {verifyError ? (
        <Callout tone="warning" className="mb-6">
          {verifyError}
        </Callout>
      ) : null}
      {regenerateError ? (
        <Callout tone="warning" className="mb-6">
          {regenerateError}
        </Callout>
      ) : null}

      {deleteConfirming ? (
        <DeleteConfirm
          projectId={projectId}
          domainId={domain.id}
          domainName={domain.domain}
          onCancel={() => setDeleteConfirming(false)}
        />
      ) : null}

      <VerificationLog
        meta={`${events.length} ${events.length === 1 ? 'entry' : 'entries'}`}
        entries={toVerificationLogEntries(events)}
      />
      {eventsNextCursor ? (
        <div className="mt-3 flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLoadMoreEvents}
            loading={loadMoreEvents.isPending}
          >
            Load more events
            <ChevronDown aria-hidden="true" size={14} />
          </Button>
        </div>
      ) : null}
    </div>
  )
}

function OutcomeBody({
  outcome,
  check,
}: {
  outcome: { message: string }
  check: DomainCheck | null
}) {
  return (
    <>
      <p>{outcome.message}</p>
      {check?.expected ? (
        <dl className="mt-2 flex flex-col gap-1 font-mono text-xs">
          <div>
            <dt className="inline text-faint-foreground">expected:</dt>{' '}
            <dd className="inline">{check.expected}</dd>
          </div>
          {check.detected?.map((value, index) => (
            <div key={index}>
              <dt className="inline text-faint-foreground">detected:</dt>{' '}
              <dd className="inline">{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </>
  )
}
