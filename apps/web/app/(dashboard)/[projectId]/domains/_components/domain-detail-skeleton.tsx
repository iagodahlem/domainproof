'use client'

import { useParams } from 'next/navigation'
import { Copy, MoreVertical, RefreshCw } from 'lucide-react'
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
 * Matches `DomainDetailClient`'s real shape after the #96 redesign: a
 * two-column grid (status stepper, ownership record, hosted-link card, and
 * verification log on the left; the meta rail on the right), reusing the
 * same `Card`/`RecordCard`/`CardRow` wrapper primitives the real content
 * renders in. Also registers the topbar's back link, title, and (disabled)
 * action buttons itself — same reasoning as `DomainsSkeleton`'s "Add
 * domain" button — so none of that pops in only once the real page mounts.
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
      <div className="flex flex-nowrap items-center gap-2">
        <Button
          size="sm"
          disabled
          icon={<Copy aria-hidden="true" size={13} />}
          className="max-[420px]:hidden"
        >
          Copy verification link
        </Button>
        <Button
          size="icon"
          disabled
          aria-label="Copy verification link"
          className="hidden max-[420px]:flex"
        >
          <Copy aria-hidden="true" size={13} />
        </Button>
        <Button
          variant="primary"
          size="sm"
          disabled
          icon={<RefreshCw aria-hidden="true" size={13} />}
        >
          <span className="max-[420px]:sr-only">Check now</span>
        </Button>
        <Button size="sm" className="px-2" disabled aria-label="More actions">
          <MoreVertical aria-hidden="true" size={15} />
        </Button>
      </div>
    ),
  })

  return (
    <div aria-hidden="true">
      {/* eslint-disable-next-line better-tailwindcss/no-restricted-classes -- 272px is the approved mock's fixed meta-rail width; matches DomainDetailClient's own grid track exactly, see its own comment */}
      <div className="grid grid-cols-[1fr_272px] items-start gap-6 max-[980px]:grid-cols-1">
        <div className="min-w-0">
          <div className="mb-6 rounded-lg border border-border p-5">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <Skeleton className="h-5.5 w-24 rounded-full" />
              <Skeleton className="h-3 w-32" />
            </div>
            <div className="flex items-start overflow-x-auto">
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
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-56" />
            </CardRow>
            <CardRow>
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-72" />
            </CardRow>
          </div>

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
              <div className="flex min-w-0 items-center gap-2">
                <Skeleton className="h-7 min-w-0 flex-1 rounded-md" />
                <Skeleton className="h-7 w-24 shrink-0 rounded-md" />
              </div>
            </CardBody>
          </Card>

          <div className="overflow-hidden rounded-lg border border-border">
            <div className="flex items-center justify-between gap-3 bg-surface-2 px-5 py-3">
              <Skeleton className="h-3 w-40" />
              <Skeleton className="h-3 w-12" />
            </div>
            <div className="px-5 pt-3 pb-4">
              <div className="flex gap-4 border-b border-border py-3">
                <Skeleton className="h-3 w-14 shrink-0" />
                <Skeleton className="h-4 w-3/4" />
              </div>
              <div className="flex gap-4 border-b border-border py-3">
                <Skeleton className="h-3 w-14 shrink-0" />
                <Skeleton className="h-4 w-2/3" />
              </div>
              <div className="flex gap-4 py-3">
                <Skeleton className="h-3 w-14 shrink-0" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </div>
          </div>
        </div>

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
        </div>
      </div>
    </div>
  )
}
