'use client'

import { useState } from 'react'
import { Code, Component, Info, Link2, Sparkles } from 'lucide-react'
import { Callout, PathChooser, VerticalTimeline } from '@domainproof/ui'
import type { PathChooserOption } from '@domainproof/ui'
import { ApiError } from '@/lib/query/errors'
import type { DomainDetail } from '@/lib/api/dashboard'
import {
  useCreateDomain,
  useDomain,
  useVerifyDomain,
} from '@/lib/query/domains'
import { buildAgentsPathSteps } from './onboarding-agents-path'
import { buildApiPathSteps } from './onboarding-api-path'
import { buildComponentsPathSteps } from './onboarding-components-path'
import { SANDBOX_DOMAIN } from './onboarding-constants'
import { buildHostedPathSteps } from './onboarding-hosted-path'
import type { IntegrationPath } from './onboarding-storage'
import { useOnboardingTab, useRefreshOnVerified } from './onboarding-storage'
import { PathDelegate } from './path-delegate'

const PATH_OPTIONS: PathChooserOption[] = [
  {
    id: 'api',
    icon: <Code aria-hidden="true" size={15} />,
    label: 'API',
    sub: 'Full control, your UI',
  },
  {
    id: 'hosted',
    icon: <Link2 aria-hidden="true" size={15} />,
    label: 'Hosted page',
    sub: 'We host the UI',
  },
  {
    id: 'components',
    icon: <Component aria-hidden="true" size={15} />,
    label: 'React components',
    sub: 'Drop into your app',
  },
  {
    id: 'agents',
    icon: <Sparkles aria-hidden="true" size={15} />,
    label: 'Agents & CLI',
    sub: 'Hand it off',
  },
]

const INTRO_TEXT: Record<Exclude<IntegrationPath, 'agents'>, string> = {
  api: 'Call our API directly — you build the verification UI.',
  hosted: 'Redirect to our hosted page — we build the verification UI.',
  components:
    'Drop @domainproof/react into your app — same UI, your app shell.',
}

const DELEGATE_PROMPT: Record<Exclude<IntegrationPath, 'agents'>, string> = {
  api: `Add DomainProof domain verification to this app using the REST API (or the Node SDK) only — skip the hosted page and the MCP server.

1. Claim the domain: POST /v1/domains with my test key (DOMAINPROOF_API_KEY in .env).
2. Show the returned TXT record in our own settings UI — reuse our existing form components, not DomainProof's.
3. Poll GET /v1/domains/:id (or dp.domains.get) until status is "verified", then update our own domain record.

Sandbox domain: ${SANDBOX_DOMAIN}. Docs: https://docs.domainproof.dev/api`,
  hosted: `Add DomainProof domain verification to this app using the hosted verification page — don't build a custom DNS-record UI.

1. Claim the domain server-side: POST /v1/domains with my test key.
2. Read verificationUrl from the response and redirect the user (or whoever owns the domain's DNS) there.
3. Register a webhook for domain.verified and update our own state when it fires — no polling needed.

Sandbox domain: ${SANDBOX_DOMAIN}. Docs: https://docs.domainproof.dev/hosted-page`,
  components: `Add DomainProof domain verification to this app using @domainproof/react — don't hand-roll the record card or status polling.

1. Install @domainproof/react and mint a component session server-side with @domainproof/sdk (never expose the api key to the browser).
2. Pass the session token to <DomainVerification sessionToken={token} />.
3. It handles claiming, the DNS record, and status polling on its own — listen for onVerified to know when it's done.

Sandbox domain: ${SANDBOX_DOMAIN} (test-mode session tokens only accept .test domains). Docs: https://docs.domainproof.dev/react`,
}

function conflictMessage(): string {
  return `This project already claimed ${SANDBOX_DOMAIN} — view it on the Domains page.`
}

export interface OnboardingPanelProps {
  projectId: string
}

/**
 * The "First run" step's whole body: the integration-path chooser, its
 * per-path intro + delegate disclosure, and the path-adaptive 3-step
 * walkthrough. Owns the one thing shared by the API/Hosted/React paths —
 * the claimed sandbox domain — since all three claim it exactly the same
 * way; the Agents & CLI path doesn't participate in that state at all (see
 * `onboarding-agents-path.tsx`).
 */
export function OnboardingPanel({ projectId }: OnboardingPanelProps) {
  const [activePath, setActivePath] = useOnboardingTab(projectId)
  const [claimedDomain, setClaimedDomain] = useState<DomainDetail | null>(null)
  const [claimError, setClaimError] = useState<string | undefined>()

  const createDomain = useCreateDomain(projectId)

  function handleClaim() {
    setClaimError(undefined)
    createDomain.mutate(
      { domain: SANDBOX_DOMAIN, mode: 'test' },
      {
        onSuccess: ({ domain }) => setClaimedDomain(domain),
        onError: (error) => {
          if (
            error instanceof ApiError &&
            error.code === 'domain_already_claimed'
          ) {
            setClaimError(conflictMessage())
            return
          }
          setClaimError(
            error instanceof ApiError
              ? error.message
              : 'Something went wrong. Please try again.',
          )
        },
      },
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <Callout tone="accent" className="flex items-start gap-3">
        <Sparkles
          aria-hidden="true"
          size={16}
          className="mt-0.5 shrink-0 text-accent"
        />
        <p>
          <strong className="text-foreground">Try it now</strong> — no real
          domain needed. Every step below runs against{' '}
          <code className="rounded-sm bg-surface-2 px-1 py-0.5 font-mono text-accent">
            {SANDBOX_DOMAIN}
          </code>
          , a sandbox domain that verifies itself in about 45 seconds.
        </p>
      </Callout>

      <PathChooser
        options={PATH_OPTIONS}
        value={activePath}
        onChange={(path) => setActivePath(path as IntegrationPath)}
        aria-label="Integration path"
      />

      {activePath === 'agents' ? (
        <div className="flex items-center gap-2 text-xs text-faint-foreground">
          <Info aria-hidden="true" size={14} className="shrink-0" />
          <span>
            Hand the whole thing to an agent — this tab already speaks
            agent-to-agent, so there&rsquo;s nothing extra to delegate.
          </span>
        </div>
      ) : (
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
          <p className="max-w-[48ch] pt-0.5 text-sm text-muted-foreground">
            {INTRO_TEXT[activePath]}
          </p>
          <PathDelegate prompt={DELEGATE_PROMPT[activePath]} />
        </div>
      )}

      {activePath === 'agents' ? (
        <VerticalTimeline steps={buildAgentsPathSteps({ projectId })} />
      ) : activePath === 'components' ? (
        <VerticalTimeline steps={buildComponentsPathSteps()} />
      ) : claimedDomain ? (
        <ClaimedDomainWalkthrough
          key={claimedDomain.id}
          projectId={projectId}
          path={activePath}
          initialDomain={claimedDomain}
          isClaiming={createDomain.isPending}
          claimError={claimError}
          onClaim={handleClaim}
        />
      ) : (
        <VerticalTimeline
          steps={
            activePath === 'api'
              ? buildApiPathSteps({
                  domain: null,
                  isClaiming: createDomain.isPending,
                  claimError,
                  onClaim: handleClaim,
                  onVerify: () => {},
                  isVerifying: false,
                })
              : buildHostedPathSteps({
                  domain: null,
                  isClaiming: createDomain.isPending,
                  claimError,
                  onClaim: handleClaim,
                })
          }
        />
      )}
    </div>
  )
}

interface ClaimedDomainWalkthroughProps {
  projectId: string
  path: 'api' | 'hosted'
  initialDomain: DomainDetail
  isClaiming: boolean
  claimError?: string
  onClaim: () => void
}

/**
 * Mounted only once a domain has been claimed (its `key` is the domain
 * id), so `useDomain`/`useVerifyDomain` — which need a real id — can be
 * called unconditionally here instead of the parent, which doesn't always
 * have one yet. Reuses the exact same bounded-poll domain query and
 * verify mutation the domain detail page uses.
 */
function ClaimedDomainWalkthrough({
  projectId,
  path,
  initialDomain,
  isClaiming,
  claimError,
  onClaim,
}: ClaimedDomainWalkthroughProps) {
  const { data: domain } = useDomain(projectId, initialDomain.id, initialDomain)
  const verifyDomain = useVerifyDomain(projectId, domain.id)
  const [verifyError, setVerifyError] = useState<string | undefined>()
  useRefreshOnVerified(domain.status)

  function handleVerify() {
    setVerifyError(undefined)
    verifyDomain.mutate(undefined, {
      onError: (error) => {
        setVerifyError(
          error instanceof ApiError
            ? error.message
            : 'Something went wrong. Please try again.',
        )
      },
    })
  }

  const steps =
    path === 'api'
      ? buildApiPathSteps({
          domain,
          isClaiming,
          claimError,
          onClaim,
          onVerify: handleVerify,
          isVerifying: verifyDomain.isPending,
          verifyError,
        })
      : buildHostedPathSteps({
          domain,
          isClaiming,
          claimError,
          onClaim,
        })

  return <VerticalTimeline steps={steps} />
}
