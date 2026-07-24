import type { ReactNode } from 'react'
import { RotateCw, Trash2 } from 'lucide-react'
import { Button, CopyButton, cn } from '@domainproof/ui'
import type { DomainMode } from '@/lib/api/dashboard'
import { formatRelativeTime } from '@/lib/format-relative-time'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function RailField({
  label,
  note,
  children,
}: {
  label: string
  note?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-2xs tracking-label text-faint-foreground uppercase">
        {label}
      </span>
      <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
        {children}
      </span>
      {note ? (
        <span className="text-2xs text-faint-foreground">{note}</span>
      ) : null}
    </div>
  )
}

export interface DomainMetaRailProps {
  mode: DomainMode
  createdAt: string
  updatedAt: string
  /** Omit entirely for states with nothing honest to show (verified, recovering) — see `domain-detail-client.tsx`'s doc comment on why "challenge expires" never appears here at all. */
  nextCheck?: { value: string; note?: string }
  verificationUrl: string
  onRegenerate: () => void
  regenerating: boolean
  onDeleteRequest: () => void
}

/**
 * The quiet meta rail — mode/created/last-checked/next-check, pulled out of
 * the header so it stops competing with the domain's own actions. Every
 * field here is backed by data the dashboard API actually returns today
 * (`mode`/`createdAt`) or an existing established convention
 * (`updatedAt` standing in for "last checked", same as the domains table's
 * own row) — `nextCheck` is the one exception, computed client-side from
 * this page's own polling schedule rather than read from the API, since
 * it's a fact about *this page's* behavior, not the domain's.
 *
 * The secondary domain actions (copy/regenerate/delete) live here too,
 * divider-separated below the facts — not a header dropdown. They're
 * reached rarely enough that low-emphasis, always-visible buttons read
 * better than a menu a builder has to open to even see what's possible.
 */
export function DomainMetaRail({
  mode,
  createdAt,
  updatedAt,
  nextCheck,
  verificationUrl,
  onRegenerate,
  regenerating,
  onDeleteRequest,
}: DomainMetaRailProps) {
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5">
      <RailField label="Mode">
        <span
          className={cn(
            'inline-block h-2 w-2 shrink-0 rounded-full',
            mode === 'live' ? 'bg-success' : 'bg-warning',
          )}
        />
        {mode === 'live' ? 'Live' : 'Test'}
      </RailField>
      <div className="border-t border-border" />
      <RailField label="Created">{formatDate(createdAt)}</RailField>
      <div className="border-t border-border" />
      <RailField label="Last checked">
        {formatRelativeTime(updatedAt)}
      </RailField>
      {nextCheck ? (
        <>
          <div className="border-t border-border" />
          <RailField label="Next check" note={nextCheck.note}>
            {nextCheck.value}
          </RailField>
        </>
      ) : null}
      <div className="border-t border-border" />
      <div className="flex flex-col gap-1">
        <CopyButton
          value={verificationUrl}
          variant="ghost"
          size="sm"
          className="w-full justify-start"
        >
          Copy verification link
        </CopyButton>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start"
          icon={<RotateCw aria-hidden="true" size={14} />}
          loading={regenerating}
          onClick={onRegenerate}
        >
          Regenerate challenge
        </Button>
        <Button
          variant="danger-ghost"
          size="sm"
          className="w-full justify-start"
          icon={<Trash2 aria-hidden="true" size={14} />}
          onClick={onDeleteRequest}
        >
          Delete domain
        </Button>
      </div>
    </div>
  )
}
