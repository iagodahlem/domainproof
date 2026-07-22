'use client'

import { useState } from 'react'
import {
  Button,
  Callout,
  Card,
  CardBody,
  StatusPill,
  type Tone,
} from '@domainproof/ui'
import type { Verification } from '../../../lib/frontend-api'
import { runVerificationCheck } from '../../../lib/frontend-api'
import { describeStatus, type StatusTone } from './status-view'

export interface StatusSectionProps {
  token: string
  data: Verification
  onDataChange: (next: Verification) => void
  isPolling: boolean
  pollError: string | null
}

const BADGE_TONE_BY_STATUS_TONE: Record<StatusTone, Tone> = {
  pending: 'accent',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
}

type RecheckState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'rate_limited' }
  | { kind: 'error'; message: string }

export function StatusSection({
  token,
  data,
  onDataChange,
  isPolling,
  pollError,
}: StatusSectionProps) {
  const [recheckState, setRecheckState] = useState<RecheckState>({
    kind: 'idle',
  })

  const view = describeStatus({
    status: data.status,
    check: data.check,
    domain: data.domain,
    projectName: data.projectName,
  })

  async function handleRecheck() {
    setRecheckState({ kind: 'loading' })
    const result = await runVerificationCheck(token)
    if (result.ok) {
      onDataChange(result.data)
      setRecheckState({ kind: 'idle' })
      return
    }
    if (result.error.kind === 'http' && result.error.status === 429) {
      setRecheckState({ kind: 'rate_limited' })
      return
    }
    setRecheckState({
      kind: 'error',
      message: "Couldn't reach DomainProof to recheck. Try again in a moment.",
    })
  }

  return (
    <Card>
      <CardBody className="max-[640px]:p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <StatusPill
            tone={BADGE_TONE_BY_STATUS_TONE[view.tone]}
            size="default"
            pulse={view.tone === 'pending'}
          >
            {view.badgeLabel}
          </StatusPill>
          {isPolling ? (
            <span className="text-xs text-text-faint">
              Checking automatically…
            </span>
          ) : null}
        </div>

        <h2 className="text-lg font-heading">{view.heading}</h2>
        <p className="mt-2 text-sm leading-body text-text-muted">{view.body}</p>

        {view.unreachableNote ? (
          <Callout tone="neutral" emphasis="dashed" className="mt-4">
            {view.unreachableNote}
          </Callout>
        ) : null}

        {view.showDiff && data.check ? (
          <div className="mt-4 flex flex-col gap-2 rounded-sm border border-border bg-surface-2 px-4 py-3 font-mono text-sm break-all">
            <div>
              <span className="text-text-faint">Expected </span>
              {data.check.expected}
            </div>
            <div>
              <span className="text-text-faint">Found instead </span>
              {data.check.detected && data.check.detected.length > 0
                ? data.check.detected.join(', ')
                : '—'}
            </div>
          </div>
        ) : null}

        {pollError ? (
          <Callout tone="warning" className="mt-4">
            {pollError}
          </Callout>
        ) : null}

        {view.showRecheck ? (
          <div className="mt-4 flex flex-col gap-2">
            <Button
              variant="default"
              loading={recheckState.kind === 'loading'}
              onClick={() => void handleRecheck()}
              className="w-fit"
            >
              Recheck now
            </Button>
            {recheckState.kind === 'rate_limited' ? (
              <p className="text-xs text-warning-strong">
                Give it a few seconds before checking again.
              </p>
            ) : null}
            {recheckState.kind === 'error' ? (
              <p className="text-xs text-danger">{recheckState.message}</p>
            ) : null}
          </div>
        ) : null}
      </CardBody>
    </Card>
  )
}
