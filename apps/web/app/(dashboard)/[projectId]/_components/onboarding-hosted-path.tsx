import { Check } from 'lucide-react'
import { BrowserChrome, Callout, CopyButton, StatusPill } from '@domainproof/ui'
import type { VerticalTimelineStep } from '@domainproof/ui'
import type { DomainDetail } from '@/lib/api/dashboard'
import { domainStatusPresentation } from '@/lib/domain-status'
import { ClaimStepContent } from './onboarding-claim-step'

export interface HostedPathStepsInput {
  domain: DomainDetail | null
  isClaiming: boolean
  claimError?: string
  onClaim: () => void
}

/**
 * The Hosted page tab's 3 steps: claim, send the hosted link, then wait to
 * be notified — no verification UI to build, since DomainProof's own
 * hosted page (and, in production, a webhook) does that work. Same
 * claim/record-are-one-fact reasoning as the API path (see its doc
 * comment) for why steps 1–2 share a `done` transition.
 */
export function buildHostedPathSteps({
  domain,
  isClaiming,
  claimError,
  onClaim,
}: HostedPathStepsInput): VerticalTimelineStep[] {
  const claimed = domain !== null
  const verified = domain?.status === 'verified'
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
          domain — the response also carries the hosted link you&rsquo;ll send
          along in step 2.
        </>
      ),
      content: (
        <ClaimStepContent
          alreadyClaimed={claimed}
          isClaiming={isClaiming}
          claimError={claimError}
          onClaim={onClaim}
        />
      ),
    },
    {
      id: 'send-link',
      status: claimed ? 'done' : 'upcoming',
      node: claimed ? <Check aria-hidden="true" size={10} /> : '2',
      title: 'Send them the hosted link',
      description:
        'Skip building any verification UI — the same response also returns a link to the hosted page, pre-scoped to this request and pre-filled with the sandbox record.',
      content:
        domain && presentation ? (
          <>
            <div className="flex min-w-0 items-center gap-2">
              <div className="min-w-0 flex-1 truncate rounded-md border border-border bg-background px-3 py-3 font-mono text-xs text-muted-foreground">
                {domain.verificationUrl}
              </div>
              <CopyButton value={domain.verificationUrl} size="sm" />
            </div>
            <BrowserChrome url={domain.verificationUrl} className="max-w-72">
              <div className="flex flex-col gap-2 p-4">
                <p className="text-2xs text-faint-foreground">
                  Verify <code className="font-mono">{domain.domain}</code> —
                  sandbox.
                </p>
                <StatusPill
                  tone={presentation.tone}
                  pulse={!verified}
                  size="small"
                >
                  {presentation.label}
                </StatusPill>
              </div>
            </BrowserChrome>
          </>
        ) : null,
    },
    {
      id: 'verify',
      status: verified ? 'done' : claimed ? 'current' : 'upcoming',
      node: verified ? <Check aria-hidden="true" size={10} /> : '3',
      title: "They verify — you're notified",
      description:
        "Your user completes the same steps shown in the preview above; we call your webhook the moment it's verified.",
      content:
        domain && presentation ? (
          <>
            <StatusPill tone={presentation.tone} pulse={!verified}>
              {presentation.label}
            </StatusPill>
            {!verified ? (
              <Callout emphasis="dashed">
                <span className="mb-2 block font-mono text-2xs tracking-label text-faint-foreground uppercase">
                  What&rsquo;s happening under the hood
                </span>
                Your user (or the teammate you send this link to) completes the
                same steps shown in the preview above; we call your webhook the
                instant it verifies — no polling required on your side.
              </Callout>
            ) : null}
          </>
        ) : null,
    },
  ]
}
