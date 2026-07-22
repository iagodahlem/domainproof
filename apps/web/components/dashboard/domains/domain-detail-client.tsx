'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@clerk/nextjs'
import {
  Check,
  ChevronDown,
  ChevronLeft,
  RefreshCw,
  RotateCw,
  Trash2,
} from 'lucide-react'
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
import {
  ApiError,
  dashboardApi,
  type DomainCheck,
  type DomainDetail,
  type DomainEvent,
} from '@/lib/api'
import { domainStatusPresentation } from './domain-status'
import { domainStatusSteps } from './domain-status-steps'
import { checkOutcomePresentation } from './domain-check-outcome'
import { toVerificationLogEntries } from './domain-event-log'
import { formatRelativeTime } from './format-relative-time'
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
  const { getToken } = useAuth()
  const [domain, setDomain] = useState(initialDomain)
  const [events, setEvents] = useState(initialEvents)
  const [eventsNextCursor, setEventsNextCursor] = useState(
    initialEventsNextCursor,
  )
  const [loadingMoreEvents, setLoadingMoreEvents] = useState(false)

  const [verifying, setVerifying] = useState(false)
  const [lastCheck, setLastCheck] = useState<DomainCheck | null>(null)
  const [verifyError, setVerifyError] = useState<string | undefined>()

  const [regenerating, setRegenerating] = useState(false)
  const [regenerateError, setRegenerateError] = useState<string | undefined>()

  const [deleteConfirming, setDeleteConfirming] = useState(false)

  const presentation = domainStatusPresentation(domain.status)
  const outcome = lastCheck ? checkOutcomePresentation(lastCheck.outcome) : null

  /** Re-fetches the timeline's first page — called after verify/regenerate, since both publish fresh domain events server-side that the initial server-rendered page never sees. */
  async function refreshEvents() {
    const token = await getToken()
    const result = await dashboardApi.listDomainEvents(
      token,
      projectId,
      domain.id,
    )
    setEvents(result.events)
    setEventsNextCursor(result.nextCursor)
  }

  async function handleVerify() {
    setVerifying(true)
    setVerifyError(undefined)
    try {
      const token = await getToken()
      const result = await dashboardApi.verifyDomain(
        token,
        projectId,
        domain.id,
      )
      setDomain(result.domain)
      setLastCheck(result.check)
      await refreshEvents()
    } catch (error) {
      setVerifyError(
        error instanceof ApiError
          ? error.message
          : 'Something went wrong. Please try again.',
      )
    } finally {
      setVerifying(false)
    }
  }

  async function handleRegenerate() {
    setRegenerating(true)
    setRegenerateError(undefined)
    try {
      const token = await getToken()
      const result = await dashboardApi.regenerateDomain(
        token,
        projectId,
        domain.id,
      )
      setDomain(result.domain)
      setLastCheck(null)
      await refreshEvents()
    } catch (error) {
      setRegenerateError(
        error instanceof ApiError
          ? error.message
          : 'Something went wrong. Please try again.',
      )
    } finally {
      setRegenerating(false)
    }
  }

  async function handleLoadMoreEvents() {
    if (!eventsNextCursor) return
    setLoadingMoreEvents(true)
    try {
      const token = await getToken()
      const result = await dashboardApi.listDomainEvents(
        token,
        projectId,
        domain.id,
        {
          cursor: eventsNextCursor,
        },
      )
      setEvents((current) => [...current, ...result.events])
      setEventsNextCursor(result.nextCursor)
    } finally {
      setLoadingMoreEvents(false)
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link
          href={`/dashboard/${projectId}/domains`}
          aria-label="Back to domains"
          className="text-text-faint transition-colors duration-150 hover:text-text"
        >
          <ChevronLeft aria-hidden="true" size={16} />
        </Link>
        <h1 className="font-mono text-xl font-heading text-text">
          {domain.domain}
        </h1>
        <Badge tone={presentation.tone}>{presentation.label}</Badge>
      </div>

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
          onClick={() => void handleVerify()}
          loading={verifying}
        >
          <RefreshCw aria-hidden="true" size={13} />
          Verify now
        </Button>
        <Button
          size="sm"
          onClick={() => void handleRegenerate()}
          loading={regenerating}
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
            onClick={() => void handleLoadMoreEvents()}
            loading={loadingMoreEvents}
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
            <dt className="inline text-text-faint">expected:</dt>{' '}
            <dd className="inline">{check.expected}</dd>
          </div>
          {check.detected?.map((value, index) => (
            <div key={index}>
              <dt className="inline text-text-faint">detected:</dt>{' '}
              <dd className="inline">{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </>
  )
}
