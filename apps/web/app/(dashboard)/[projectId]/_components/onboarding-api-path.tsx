import { Check, RefreshCw } from 'lucide-react'
import { Button, Callout, RecordField, StatusPill } from '@domainproof/ui'
import type { VerticalTimelineStep } from '@domainproof/ui'
import type { DomainDetail } from '@/lib/api/dashboard'
import { domainStatusPresentation } from '@/lib/domain-status'
import { ClaimStepContent } from './onboarding-claim-step'
import { WALKTHROUGH_SURFACE_MAX_WIDTH } from './onboarding-constants'

export interface ApiPathStepsInput {
  projectId: string
  domain: DomainDetail | null
  isClaiming: boolean
  claimError?: string
  onClaim: () => void
  onVerify: () => void
  isVerifying: boolean
  verifyError?: string
}

/**
 * The API tab's 3 steps: claim, add the DNS record it returned, verify —
 * the DIY path where the caller builds their own verification UI. Claim
 * and record-display are treated as one instantaneous fact (there's no
 * separately-observable "the record propagated" signal to gate on — see
 * `domain-status-steps.tsx`'s identical reasoning for the domain detail
 * page's own stepper), so both steps go `done` together the moment the
 * claim succeeds; only the verify step's status tracks the domain's real,
 * possibly-still-settling status.
 */
export function buildApiPathSteps({
  projectId,
  domain,
  isClaiming,
  claimError,
  onClaim,
  onVerify,
  isVerifying,
  verifyError,
}: ApiPathStepsInput): VerticalTimelineStep[] {
  const claimed = domain !== null
  const verified = domain?.status === 'verified'
  const record = domain?.records[0]
  const presentation = domain ? domainStatusPresentation(domain.status) : null

  return [
    {
      id: 'claim',
      status: claimed ? 'done' : 'current',
      node: claimed ? <Check aria-hidden="true" size={10} /> : '1',
      title: 'Claim your first domain',
      description: (
        <>
          Call <code className="font-mono">POST /v1/domains</code> to register a
          domain and get back its verification record.
        </>
      ),
      content: (
        <ClaimStepContent
          projectId={projectId}
          alreadyClaimed={claimed}
          isClaiming={isClaiming}
          claimError={claimError}
          onClaim={onClaim}
        />
      ),
    },
    {
      id: 'record',
      status: claimed ? 'done' : 'upcoming',
      node: claimed ? <Check aria-hidden="true" size={10} /> : '2',
      title: 'Add the returned DNS record',
      description:
        'The response includes a host and value to add at your DNS provider — the same record shown on the hosted page.',
      content: record ? (
        <div
          className={`overflow-hidden rounded-lg border border-border ${WALKTHROUGH_SURFACE_MAX_WIDTH}`}
        >
          <RecordField label="Host" value={record.name} compact copyable />
          <RecordField label="Value" value={record.value} compact copyable />
        </div>
      ) : null,
    },
    {
      id: 'verify',
      status: verified ? 'done' : claimed ? 'current' : 'upcoming',
      node: verified ? <Check aria-hidden="true" size={10} /> : '3',
      title: 'Verify',
      description:
        'We check automatically every couple of minutes, or trigger it yourself.',
      content:
        domain && presentation ? (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <StatusPill tone={presentation.tone} pulse={!verified}>
                {presentation.label}
              </StatusPill>
              {!verified ? (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={onVerify}
                  loading={isVerifying}
                >
                  <RefreshCw aria-hidden="true" size={13} />
                  Recheck now
                </Button>
              ) : null}
            </div>
            {verifyError ? (
              <Callout tone="warning">{verifyError}</Callout>
            ) : null}
            {!verified ? (
              <Callout emphasis="dashed">
                <span className="mb-2 block font-mono text-2xs tracking-label text-faint-foreground uppercase">
                  What&rsquo;s happening under the hood
                </span>
                We check automatically every couple of minutes, tab open or not.
                This sandbox domain is seeded to verify itself in about 45
                seconds — real domains follow the same polling cadence.
              </Callout>
            ) : null}
          </>
        ) : null,
    },
  ]
}
