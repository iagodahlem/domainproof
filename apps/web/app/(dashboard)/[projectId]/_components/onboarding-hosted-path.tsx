import { Check } from 'lucide-react'
import { BrowserChrome, Callout, CopyField, StatusPill } from '@domainproof/ui'
import type { VerticalTimelineStep } from '@domainproof/ui'
import type { DomainDetail } from '@/lib/api/dashboard'
import { domainStatusPresentation } from '@/lib/domain-status'
import { ClaimStepContent } from './onboarding-claim-step'
import { WALKTHROUGH_SURFACE_MAX_WIDTH } from './onboarding-constants'
import { LiveBadge } from './live-badge'

export interface HostedPathStepsInput {
  projectId: string
  domain: DomainDetail | null
  isClaiming: boolean
  claimError?: string
  onClaim: () => void
}

/**
 * `verificationUrl` is always the production `https://domainproof.dev/verify/…`
 * absolute URL (see each plane's `routes/domains.ts`, `VERIFICATION_BASE_URL`) —
 * correct to copy/send as-is, but wrong to embed as this preview's iframe
 * `src` outside of production itself, where it would silently point at a
 * domain this environment never claimed. Deriving a root-relative path from
 * the same token instead resolves against whatever origin is actually
 * serving this page — the real production URL in production, this app's
 * own dev server in dev — so the live preview always shows the domain this
 * walkthrough itself just claimed.
 */
function hostedPreviewPath(verificationUrl: string): string {
  const token = verificationUrl.split('/').pop()
  return `/verify/${token}`
}

/**
 * The Hosted page tab's 3 steps: claim, send the hosted link, then wait to
 * be notified — no verification UI to build, since DomainProof's own
 * hosted page (and, in production, a webhook) does that work. Same
 * claim/record-are-one-fact reasoning as the API path (see its doc
 * comment) for why steps 1–2 share a `done` transition.
 */
export function buildHostedPathSteps({
  projectId,
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
          projectId={projectId}
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
      content: domain ? (
        <>
          <CopyField
            value={domain.verificationUrl}
            className={WALKTHROUGH_SURFACE_MAX_WIDTH}
          />
          <div className="flex max-w-md flex-col gap-2">
            <LiveBadge />
            <BrowserChrome url={domain.verificationUrl}>
              <iframe
                src={hostedPreviewPath(domain.verificationUrl)}
                title={`Verify ${domain.domain}`}
                className="h-72 w-full border-0"
              />
            </BrowserChrome>
          </div>
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
