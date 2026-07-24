'use client'

import { useParams } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
import {
  Button,
  Card,
  CardBody,
  CardHead,
  CardRow,
  Skeleton,
} from '@domainproof/ui'
import { useTopbarSlot } from '@/components/dashboard-shell/topbar-slot'

// Same 4-step shape every domain's stepper renders — see
// `domain-status-steps.tsx` — so the skeleton's connector/label count
// matches regardless of which status the real domain lands on.
const STEPPER_STEP_COUNT = 4

/**
 * Matches `DomainDetailClient`'s real shape: a two-column grid (status
 * stepper, ownership record, hosted-link card, and verification log on the
 * left; the meta rail — facts plus its own copy/regenerate/delete actions —
 * on the right), reusing the same `Card`/`CardHead`/`CardRow` wrapper
 * primitives the real content renders in, or the same hand-drawn shells for
 * the sections (`VerificationLog`, `DomainMetaRail`) that don't build on
 * those primitives themselves. Also registers the topbar's back link,
 * title, and (disabled) action button itself — same reasoning as
 * `DomainsSkeleton`'s "Add domain" button — so none of that pops in only
 * once the real page mounts.
 *
 * The topbar's only action is "Check now" — copying the verification link
 * and the domain's destructive actions live in the meta rail instead (see
 * `domain-meta-rail.tsx`), not a second topbar button or a menu. And the
 * stepper box itself renders with no status-badge/meta row of its own
 * (`StatusSummary`'s `statusBadge` prop is intentionally omitted by the
 * real page — that status is already shown once, in the topbar's own
 * badge).
 */
export function DomainDetailSkeleton() {
  const { projectId } = useParams<{ projectId: string }>()

  useTopbarSlot({
    hideModeToggle: true,
    back: { href: `/${projectId}/domains`, label: 'Back to domains' },
    title: (
      <div className="flex items-center gap-3">
        <Skeleton className="h-4.5 w-36" />
        <Skeleton className="h-5.5 w-16 rounded-full" />
      </div>
    ),
    action: (
      <Button
        variant="primary"
        size="sm"
        disabled
        icon={<RefreshCw aria-hidden="true" size={13} />}
      >
        Check now
      </Button>
    ),
  })

  return (
    <div aria-hidden="true">
      {/* eslint-disable-next-line better-tailwindcss/no-restricted-classes -- 272px is the approved mock's fixed meta-rail width; matches DomainDetailClient's own grid track exactly, see its own comment */}
      <div className="grid grid-cols-[1fr_272px] items-start gap-6 max-[980px]:grid-cols-1">
        <div className="min-w-0">
          {/* StatusSummary — the stepper only, no top row (see doc comment above). */}
          <div className="mb-6 rounded-lg border border-border p-5">
            <div className="flex items-start overflow-x-auto py-1 -my-1">
              {Array.from({ length: STEPPER_STEP_COUNT }).map((_, index) => (
                <div
                  key={index}
                  className="flex flex-1 items-start last:flex-none"
                >
                  <div className="flex shrink-0 flex-col items-center gap-2">
                    <Skeleton className="h-5.5 w-5.5 rounded-full" />
                    <Skeleton className="h-3 w-14" />
                  </div>
                  {index < STEPPER_STEP_COUNT - 1 ? (
                    <Skeleton className="mt-2.75 h-0.5 min-w-3 flex-1" />
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          {/* RecordCard "Ownership record" — a CardHead (step chip + title + record-type badge) then one CardRow per RecordField (label, value, copy button). */}
          <div className="mb-6 overflow-hidden rounded-lg border border-border">
            <CardHead>
              <div className="flex items-start gap-3">
                {/* Matches RecordCard's own step-chip radius exactly (see its `stepChipVariants`) — one-off, between rounded-sm (6px) and no smaller token. */}
                {/* eslint-disable-next-line better-tailwindcss/no-restricted-classes */}
                <Skeleton className="mt-px h-5 w-5 rounded-[5px]" />
                <Skeleton className="h-4.5 w-36" />
              </div>
              <Skeleton className="h-5.5 w-10 rounded-full" />
            </CardHead>
            <CardRow>
              <div className="flex flex-wrap items-center gap-4">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-56 flex-1" />
                <Skeleton className="h-6 w-14 rounded-md" />
              </div>
            </CardRow>
            <CardRow>
              <div className="flex flex-wrap items-center gap-4">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-72 flex-1" />
                <Skeleton className="h-6 w-14 rounded-md" />
              </div>
            </CardRow>
          </div>

          {/* HostedLinkCard — icon + heading + description, then one CopyField (a single full-width input with its copy button overlapping the right edge, not a separate side-by-side control). */}
          <Card className="mb-6">
            <CardBody className="flex flex-col gap-4">
              <div className="flex items-start gap-3">
                <Skeleton className="h-8 w-8 shrink-0 rounded-md" />
                <div className="flex flex-1 flex-col gap-2">
                  <Skeleton className="h-4.5 w-64 max-w-full" />
                  <Skeleton className="h-3.5 w-full" />
                  <Skeleton className="h-3.5 w-2/3" />
                </div>
              </div>
              <div className="relative">
                <Skeleton className="h-11 w-full rounded-md" />
                <Skeleton className="absolute top-1/2 right-3 h-6 w-14 -translate-y-1/2 rounded-md" />
              </div>
            </CardBody>
          </Card>

          {/* VerificationLog — not built on Card/CardHead itself, so hand-drawn to match its own literal markup instead. */}
          <div className="overflow-hidden rounded-lg border border-border">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-surface-2 px-5 py-3">
              <Skeleton className="h-3 w-40" />
              <Skeleton className="h-3 w-12" />
            </div>
            <div className="px-5 pt-3 pb-4">
              <div className="flex gap-4 border-b border-border py-3">
                <Skeleton className="h-3 w-16 shrink-0" />
                <Skeleton className="h-4 w-3/4" />
              </div>
              <div className="flex gap-4 border-b border-border py-3">
                <Skeleton className="h-3 w-16 shrink-0" />
                <Skeleton className="h-4 w-2/3" />
              </div>
              <div className="flex gap-4 py-3">
                <Skeleton className="h-3 w-16 shrink-0" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </div>
          </div>
        </div>

        {/* DomainMetaRail — not built on Card either. Facts (mode/created/last checked), divider-separated, then its own copy/regenerate/delete actions below one more divider — see its doc comment on why those actions live here instead of the topbar. */}
        <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5">
          <div className="flex flex-col gap-1">
            <Skeleton className="h-2.5 w-10" />
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="border-t border-border" />
          <div className="flex flex-col gap-1">
            <Skeleton className="h-2.5 w-14" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="border-t border-border" />
          <div className="flex flex-col gap-1">
            <Skeleton className="h-2.5 w-20" />
            <Skeleton className="h-4 w-20" />
          </div>
          <div className="border-t border-border" />
          <div className="flex flex-col gap-1">
            <Skeleton className="h-7 w-full rounded-md" />
            <Skeleton className="h-7 w-full rounded-md" />
            <Skeleton className="h-7 w-full rounded-md" />
          </div>
        </div>
      </div>
    </div>
  )
}
