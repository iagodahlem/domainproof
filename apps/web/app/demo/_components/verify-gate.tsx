'use client'

import { useState } from 'react'
import { Check as CheckIcon, Copy } from 'lucide-react'
import { DomainVerification } from '@domainproof/react'
import type { Verification } from '@domainproof/react'
import '@domainproof/react/styles.css'
import { SgButton } from './sg-button'

const GATE_BENEFITS = [
  'See all 9 checks, including email posture and DNS security',
  'Get a verified-owner badge on your report',
  'One DNS record — no code changes to your site',
]

export interface VerifyGateProps {
  domain: string
  hostedUrl: string | null
  sessionToken: string | null
  onVerified: (verification: Verification) => void
}

export function VerifyGate({
  domain,
  hostedUrl,
  sessionToken,
  onVerified,
}: VerifyGateProps) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    if (!hostedUrl) return
    try {
      await navigator.clipboard.writeText(hostedUrl)
    } catch {
      return
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="mt-7 grid grid-cols-1 overflow-hidden rounded-sg-lg border border-sg-line-strong shadow-sg-card md:grid-cols-2">
      <div className="bg-sg-violet-soft p-7">
        <h4 className="mb-3 font-sg-display text-lg leading-snug text-sg-violet-strong italic">
          Own {domain}? Verify to unlock the full report.
        </h4>
        <ul className="mb-5 flex flex-col gap-2.5">
          {GATE_BENEFITS.map((benefit) => (
            <li
              key={benefit}
              className="relative pl-5 font-sg-body text-xs leading-relaxed text-sg-ink"
            >
              <span className="absolute top-1.5 left-0 h-1.5 w-1.5 rounded-full bg-sg-violet" />
              {benefit}
            </li>
          ))}
        </ul>

        <div className="border-t border-sg-violet-line pt-4.5">
          <div className="mb-2.5 font-sg-body text-xs leading-relaxed text-sg-ink-soft">
            Prefer to hand this to whoever manages your DNS?
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-sg-violet-line bg-sg-paper py-1 pr-1 pl-3.5">
            <span className="min-w-0 flex-1 truncate font-sg-mono text-2xs text-sg-ink-soft">
              {hostedUrl ?? 'Preparing your verification link…'}
            </span>
            <SgButton
              type="button"
              variant="ghost"
              size="sm"
              disabled={!hostedUrl}
              onClick={() => void handleCopy()}
            >
              {copied ? (
                <CheckIcon aria-hidden="true" size={13} />
              ) : (
                <Copy aria-hidden="true" size={13} />
              )}
              {copied ? 'Copied' : 'Copy'}
            </SgButton>
          </div>
        </div>
      </div>

      <div className="relative flex flex-col bg-sg-dp-bg p-7">
        <span className="absolute top-0 right-0 rounded-bl-sg-sm border-b border-l border-white/10 bg-sg-dp-surface px-3 py-1.5 font-sg-mono text-3xs tracking-wide text-sg-dp-text-muted uppercase">
          Embedded &middot; @domainproof/react
        </span>
        {sessionToken ? (
          <>
            <p className="mb-4 font-sg-body text-xs leading-relaxed text-sg-dp-text-muted">
              Try DomainProof right here. Verifying your own domain over real
              DNS can take a few minutes — to see it complete instantly, use a
              DomainProof sandbox domain (any address ending in{' '}
              <code className="font-sg-mono">.test</code>).
            </p>
            <DomainVerification
              sessionToken={sessionToken}
              theme="dark"
              onVerified={onVerified}
            />
          </>
        ) : (
          <div className="font-sg-body text-xs text-sg-dp-text-muted">
            Preparing the DomainProof verification widget&hellip;
          </div>
        )}
      </div>
    </div>
  )
}
