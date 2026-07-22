'use client'

import { useState } from 'react'
import { Eye, TriangleAlert } from 'lucide-react'
import {
  Badge,
  Button,
  Callout,
  CopyButton,
  RecordCard,
  RecordField,
} from '@domainproof/ui'
import type { CreateProjectResult } from '@/lib/api/dashboard'

export interface KeysHandoffProps {
  result: CreateProjectResult
  onContinue: () => void
}

/**
 * Show-once handoff for the test/live keys `POST /dashboard/projects`
 * returns — the only response where a project's bootstrap keys are ever
 * shown together. A placeholder for tomorrow's onboarding build (FD-022
 * B2); kept self-contained so it's trivial to replace.
 */
export function KeysHandoff({ result, onContinue }: KeysHandoffProps) {
  const [liveRevealed, setLiveRevealed] = useState(false)

  return (
    <div className="flex w-full max-w-xl flex-col gap-6">
      <div>
        <p className="font-mono text-xs font-semibold tracking-widest text-accent uppercase">
          Project created
        </p>
        <h3 className="mt-1 text-xl font-heading text-foreground">
          {result.project.name} is ready
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Use the test key while you build — switch to the live key when
          you&rsquo;re ready to verify real domains.
        </p>
      </div>

      <Callout tone="warning" className="flex items-start gap-3">
        <TriangleAlert
          aria-hidden="true"
          size={16}
          className="mt-0.5 shrink-0 text-warning-strong"
        />
        <p>
          <strong>Save these now.</strong> Full key values are shown exactly
          once — copy them somewhere safe. You won&rsquo;t be able to see them
          again after you leave this screen.
        </p>
      </Callout>

      <RecordCard
        title="API keys"
        trailing={<Badge tone="accent">One-time</Badge>}
      >
        <RecordField
          label="Test key"
          value={result.keys.test.key}
          labelWidth="content"
          truncateValue
          action={
            <CopyButton
              value={result.keys.test.key}
              size="icon"
              iconOnly
              aria-label="Copy test key"
            >
              Copy
            </CopyButton>
          }
        />
        <RecordField
          label="Live key"
          value={
            liveRevealed
              ? result.keys.live.key
              : result.keys.live.apiKey.maskedKey
          }
          labelWidth="content"
          truncateValue
          action={
            liveRevealed ? (
              <CopyButton
                value={result.keys.live.key}
                size="icon"
                iconOnly
                aria-label="Copy live key"
              >
                Copy
              </CopyButton>
            ) : (
              <Button
                type="button"
                size="icon"
                aria-label="Reveal"
                onClick={() => setLiveRevealed(true)}
              >
                <Eye aria-hidden="true" size={14} />
              </Button>
            )
          }
        />
      </RecordCard>

      <Button
        variant="primary"
        className="w-full justify-center"
        onClick={onContinue}
      >
        Continue to dashboard
      </Button>
    </div>
  )
}
