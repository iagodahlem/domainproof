'use client'

import Link from 'next/link'
import { Play } from 'lucide-react'
import { Button, Callout, CodePanel } from '@domainproof/ui'
import { buildClaimCodeTabs } from './onboarding-claim-code'
import {
  SANDBOX_DOMAIN,
  WALKTHROUGH_SURFACE_MAX_WIDTH,
} from './onboarding-constants'

export interface ClaimStepContentProps {
  projectId: string
  alreadyClaimed: boolean
  isClaiming: boolean
  claimError?: string
  onClaim: () => void
}

/**
 * Step 1's body, shared by the API, Hosted page, and React components
 * tabs — all three claim the exact same sandbox domain the exact same
 * way, so this is the one place that button/code-panel/error markup
 * lives, parametrized only by which tab's description text wraps it.
 */
export function ClaimStepContent({
  projectId,
  alreadyClaimed,
  isClaiming,
  claimError,
  onClaim,
}: ClaimStepContentProps) {
  return (
    <>
      <CodePanel
        tabs={buildClaimCodeTabs(SANDBOX_DOMAIN)}
        className={WALKTHROUGH_SURFACE_MAX_WIDTH}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="primary"
          size="sm"
          onClick={onClaim}
          loading={isClaiming}
          disabled={alreadyClaimed}
        >
          <Play aria-hidden="true" size={13} />
          Run against sandbox
        </Button>
        <span className="text-xs text-faint-foreground">
          Hits <code className="font-mono">{SANDBOX_DOMAIN}</code> — no real DNS
          needed.
        </span>
      </div>
      {claimError ? <Callout tone="warning">{claimError}</Callout> : null}
      <p className="text-2xs text-faint-foreground">
        Uses the test key you saved when creating the project. Lost it? Rotate
        it from{' '}
        <Link
          href={`/${projectId}/settings`}
          className="font-semibold text-muted-foreground underline"
        >
          Settings → API keys
        </Link>{' '}
        — the old one stops working the moment you do.
      </p>
    </>
  )
}
