import { RefreshCw, X } from 'lucide-react'
import { Badge, Button, CardRow, RecordCard } from '@domainproof/ui'
import type { DomainCheck, DomainDetail } from '@/lib/api/dashboard'
import { checkOutcomePresentation } from './domain-check-outcome'

export interface WhatWeFoundProps {
  domain: DomainDetail
  /** The most recent check run *this session* — `null` on a cold page load, since the dashboard API doesn't persist or return a domain's last check result (see the doc comment below). */
  check: DomainCheck | null
  onRetry: () => void
  retrying: boolean
}

/**
 * The failed state's expected/found diff — but only ever shows a real
 * "found" value when `check` actually carries one. `wrong_value` is the
 * only outcome with a `detected` value at all (core's `checkTxt`/
 * `checkHttp`), and even then only within the browser session that ran the
 * check: the dashboard's domain read (`serializeDomainDetail`) doesn't
 * persist or return a last-check result, so a domain that's been `failed`
 * since before this page loaded has no found-data to show until "Check
 * again" runs a fresh one. `not_found`/`unreachable`/`expired` never carry
 * a found value at all, even mid-session — there was nothing there to
 * report. Every case that isn't a fresh `wrong_value` gets the honest
 * reduced version: what we looked for, and what happened, without
 * fabricating a "found" value that was never observed.
 */
export function WhatWeFound({
  domain,
  check,
  onRetry,
  retrying,
}: WhatWeFoundProps) {
  const expected = domain.records[0]?.value
  const hasDiff =
    check?.outcome === 'wrong_value' && (check.detected?.length ?? 0) > 0
  const message = check
    ? checkOutcomePresentation(check.outcome).message
    : "We couldn't verify this domain. Run a fresh check to see what we find."

  return (
    <div className="mb-6">
      <div className="mb-3 font-mono text-2xs tracking-label text-faint-foreground uppercase">
        What we found
      </div>
      <RecordCard
        step={<X aria-hidden="true" size={10} />}
        stepTone="danger"
        title="What we found"
        trailing={
          <Badge tone="danger">{hasDiff ? 'Mismatch' : 'Not verified'}</Badge>
        }
      >
        {expected ? (
          <CardRow>
            <div className="flex flex-wrap items-center gap-4">
              <span className="w-23 flex-shrink-0 font-mono text-2xs tracking-label text-faint-foreground uppercase max-[560px]:w-auto">
                Expected
              </span>
              <span className="min-w-45 flex-1 font-mono text-base break-all text-foreground">
                {expected}
              </span>
            </div>
          </CardRow>
        ) : null}
        {hasDiff ? (
          <CardRow>
            <div className="flex flex-wrap items-center gap-4">
              <span className="w-23 flex-shrink-0 font-mono text-2xs tracking-label text-faint-foreground uppercase max-[560px]:w-auto">
                Found
              </span>
              <span className="min-w-45 flex-1 font-mono text-base break-all text-danger">
                {check?.detected?.join(', ')}
              </span>
            </div>
          </CardRow>
        ) : null}
        <CardRow>
          <p className="text-sm text-muted-foreground">{message}</p>
        </CardRow>
      </RecordCard>
      <Button
        variant="primary"
        size="sm"
        className="mt-4"
        onClick={onRetry}
        loading={retrying}
      >
        <RefreshCw aria-hidden="true" size={13} />
        Check again
      </Button>
    </div>
  )
}
