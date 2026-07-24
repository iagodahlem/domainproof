import { Check } from 'lucide-react'
import type { Verification } from '@domainproof/react'
import { computeGrade } from '../_lib/grade'
import type { Grade } from '../_lib/grade'
import type { CheckResult } from '../_lib/types'
import { CheckList, CheckSectionLabel, LockedCheckList } from './check-list'
import { GradeBadge } from './grade-badge'
import { VerifyGate } from './verify-gate'

export interface ReportViewProps {
  domain: string
  teaser: CheckResult[]
  grade: Grade
  gradeLabel: string
  /** True only once `domain` itself — the exact domain that was scanned — is verified. */
  verified: boolean
  fullReport: CheckResult[] | null
  verifiedAt: string | null
  /** A domain verified through the embedded widget, which may differ from `domain` — see VerifyGate's sandbox-domain framing. */
  widgetVerifiedDomain: string | null
  hostedUrl: string | null
  /** `domain`'s own claim, already made server-side — lets the widget render already bound to it instead of asking to claim it again. `null` only if the claim response's `verificationUrl` was ever shaped unexpectedly. */
  frontendToken: string | null
  sessionToken: string | null
  onVerified: (verification: Verification) => void
}

export function ReportView({
  domain,
  teaser,
  grade,
  gradeLabel,
  verified,
  fullReport,
  verifiedAt,
  widgetVerifiedDomain,
  hostedUrl,
  frontendToken,
  sessionToken,
  onVerified,
}: ReportViewProps) {
  if (verified && fullReport) {
    const unlockedGrade = computeGrade(fullReport)

    return (
      <div>
        <div className="mb-3.5 inline-flex items-center gap-2 rounded-full bg-sg-sage-soft px-3.5 py-1.5 font-sg-body text-xs font-bold text-sg-sage-text">
          <Check aria-hidden="true" size={13} />
          Verified owner
        </div>
        <div className="mb-5.5 font-sg-mono text-lg font-bold text-sg-ink">
          {domain}
          {verifiedAt ? (
            <span className="ml-2 font-sg-body text-xs font-normal text-sg-ink-faint">
              verified via DomainProof{' '}
              {new Date(verifiedAt).toLocaleString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </span>
          ) : null}
        </div>

        <div className="mb-5 flex items-center justify-between">
          <GradeBadge grade={unlockedGrade.grade} />
          <div className="flex-1 pl-3.5">
            <div className="font-sg-body text-sm font-bold text-sg-ink">
              Full grade
            </div>
            <div className="font-sg-body text-xs text-sg-ink-faint">
              {unlockedGrade.label}
            </div>
          </div>
        </div>

        <CheckList checks={fullReport} />
      </div>
    )
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <GradeBadge grade={grade} />
        <div className="flex-1 pl-3.5">
          <div className="font-sg-body text-sm font-bold text-sg-ink">
            {domain}
          </div>
          <div className="font-sg-body text-xs text-sg-ink-faint">
            {gradeLabel}
          </div>
        </div>
      </div>

      <CheckSectionLabel>Visible now</CheckSectionLabel>
      <CheckList checks={teaser} />

      <CheckSectionLabel>Locked — verify to view</CheckSectionLabel>
      <LockedCheckList />

      {widgetVerifiedDomain ? (
        <p className="mt-5.5 font-sg-body text-xs leading-relaxed text-sg-sage-text">
          DomainProof verified {widgetVerifiedDomain} through the widget below.
          To unlock {domain}&rsquo;s own full report, verify {domain} itself —
          the hosted link on the left is the fastest way for a real domain.
        </p>
      ) : null}

      <VerifyGate
        domain={domain}
        hostedUrl={hostedUrl}
        frontendToken={frontendToken}
        sessionToken={sessionToken}
        onVerified={onVerified}
      />
    </div>
  )
}
