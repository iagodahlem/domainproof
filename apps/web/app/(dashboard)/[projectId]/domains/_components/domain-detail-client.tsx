'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  Check,
  ChevronDown,
  CircleDashed,
  MoreVertical,
  RefreshCw,
  RotateCw,
  Trash2,
} from 'lucide-react'
import {
  Badge,
  Button,
  Callout,
  CopyButton,
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
  RecordCard,
  RecordField,
  StatusSummary,
  VerificationLog,
} from '@domainproof/ui'
import { ApiError } from '@/lib/query/errors'
import { hostedVerificationUrl } from '@/lib/hosted-verification-url'
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
import { domainStatusSteps } from './domain-status-steps'
import { checkOutcomePresentation } from './domain-check-outcome'
import { toVerificationLogEntries } from './domain-event-log'
import { DeleteDomainDialog } from './delete-domain-dialog'
import { HostedLinkCard } from './hosted-link-card'
import { DomainMetaRail } from './domain-meta-rail'
import { WhatWeFound } from './what-we-found'
import { DEFAULT_INTERVALS_MS, useBoundedPoll } from './use-bounded-poll'

export interface DomainDetailClientProps {
  projectId: string
  initialDomain: DomainDetail
  initialEvents: DomainEvent[]
  initialEventsNextCursor: string | null
}

function formatNextCheckDelay(ms: number): string {
  if (ms < 60_000) return `in ~${Math.round(ms / 1000)}s`
  return `in ~${Math.round(ms / 60_000)} min`
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

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const verifyDomain = useVerifyDomain(projectId, domain.id)
  // A second, independent mutation instance for the bounded auto-check
  // below — sharing `verifyDomain` would make the header's "Check now"
  // button flash into a loading state on every unattended auto-check tick,
  // not just when a builder actually clicks it.
  const autoVerifyDomain = useVerifyDomain(projectId, domain.id)
  const regenerateDomain = useRegenerateDomain(projectId, domain.id)
  const loadMoreEvents = useListDomainEvents(projectId, domain.id)

  const presentation = domainStatusPresentation(domain.status)
  const outcome = lastCheck ? checkOutcomePresentation(lastCheck.outcome) : null
  const verificationUrl = hostedVerificationUrl(domain.frontendToken)

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

  // Fires a real verify check on the bounded schedule below while the
  // domain is `pending` — not just a passive re-read of the current state
  // (that's `useDomain`'s own polling, unchanged) — so a sandbox domain
  // flips to `verified` and a real domain's DNS propagation is caught
  // within seconds to minutes, without a manual "Check now" click. Errors
  // (a transient DNS/network hiccup) are swallowed rather than surfaced:
  // the manual button remains available, and the schedule just tries again
  // on its next tick.
  async function autoCheck() {
    try {
      const result = await autoVerifyDomain.mutateAsync()
      queryClient.setQueryData(domainKey(projectId, domain.id), result.domain)
      queryClient.setQueryData(domainEventsKey(projectId, domain.id), {
        events: result.events,
        nextCursor: result.nextCursor,
      })
      setLastCheck(result.check)
    } catch {
      // swallowed — see doc comment above
    }
  }

  const { attempts: autoCheckAttempts } = useBoundedPoll(
    autoCheck,
    domain.status === 'pending',
  )

  useTopbarSlot({
    // A domain's mode is a fixed fact, already shown in its own meta rail —
    // the dashboard-wide toggle here is noise, not to mention it was the
    // main reason this row wrapped onto multiple lines at normal desktop
    // widths.
    hideModeToggle: true,
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
    action: (
      <div className="flex flex-nowrap items-center gap-2">
        <CopyButton value={verificationUrl} className="max-[420px]:hidden">
          Copy verification link
        </CopyButton>
        <CopyButton
          value={verificationUrl}
          size="icon"
          iconOnly
          aria-label="Copy verification link"
          className="hidden max-[420px]:flex"
        >
          Copy verification link
        </CopyButton>
        <Button
          variant="primary"
          size="sm"
          onClick={handleVerify}
          loading={verifyDomain.isPending}
          icon={<RefreshCw aria-hidden="true" size={13} />}
        >
          <span className="max-[420px]:sr-only">Check now</span>
        </Button>
        <Menu>
          <MenuTrigger asChild>
            <Button size="sm" className="px-2" aria-label="More actions">
              <MoreVertical aria-hidden="true" size={15} />
            </Button>
          </MenuTrigger>
          <MenuContent align="end">
            <MenuItem
              icon={<RotateCw aria-hidden="true" size={14} />}
              disabled={regenerateDomain.isPending}
              onSelect={handleRegenerate}
            >
              Regenerate challenge
            </MenuItem>
            <MenuSeparator />
            <MenuItem
              tone="danger"
              icon={<Trash2 aria-hidden="true" size={14} />}
              onSelect={() => setDeleteDialogOpen(true)}
            >
              Delete domain
            </MenuItem>
          </MenuContent>
        </Menu>
      </div>
    ),
  })

  const nextCheck =
    domain.status === 'pending'
      ? {
          value: formatNextCheckDelay(
            DEFAULT_INTERVALS_MS[
              Math.min(autoCheckAttempts, DEFAULT_INTERVALS_MS.length - 1)
            ] ?? 0,
          ),
          note: 'Auto, while propagating',
        }
      : domain.status === 'failed'
        ? { value: 'Paused', note: 'Use "Check now" to retry' }
        : undefined

  return (
    <div>
      <div
        // eslint-disable-next-line better-tailwindcss/no-restricted-classes -- 272px is the approved mock's fixed meta-rail width; no mapped token equivalent for a track size
        className="grid grid-cols-[1fr_272px] items-start gap-6 max-[980px]:grid-cols-1"
      >
        <div className="min-w-0">
          <StatusSummary steps={domainStatusSteps(domain, lastCheck)} />

          <RecordCard
            className="mb-6"
            step={
              domain.status === 'verified' ? (
                <Check aria-hidden="true" size={10} />
              ) : (
                <CircleDashed aria-hidden="true" size={10} />
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

          {outcome && domain.status !== 'failed' ? (
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

          {domain.status === 'failed' ? (
            <WhatWeFound
              domain={domain}
              check={lastCheck}
              onRetry={handleVerify}
              retrying={verifyDomain.isPending}
            />
          ) : null}

          <HostedLinkCard
            verificationUrl={verificationUrl}
            verified={domain.status === 'verified'}
          />

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

        <DomainMetaRail
          mode={domain.mode}
          createdAt={domain.createdAt}
          updatedAt={domain.updatedAt}
          nextCheck={nextCheck}
        />
      </div>

      <DeleteDomainDialog
        projectId={projectId}
        domainId={domain.id}
        domainName={domain.domain}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
      />
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
