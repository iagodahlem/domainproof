import { CardHead, CardRow, Skeleton } from '@domainproof/ui'

/**
 * Matches `DomainDetailClient`'s real shape — ownership record card, status
 * summary row, action buttons, and the verification log — reusing the same
 * `Card`/`CardHead`/`CardRow` wrapper primitives the real content renders
 * in so borders/padding/heights line up exactly, not just approximate
 * pixel guesses.
 */
export function DomainDetailSkeleton() {
  return (
    <div aria-hidden="true">
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

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-7 w-24 rounded-full" />
          <Skeleton className="h-4 w-28" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-5.5 w-5.5 rounded-full" />
          <Skeleton className="h-0.5 w-8" />
          <Skeleton className="h-5.5 w-5.5 rounded-full" />
          <Skeleton className="h-0.5 w-8" />
          <Skeleton className="h-5.5 w-5.5 rounded-full" />
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Skeleton className="h-8 w-28 rounded-md" />
        <Skeleton className="h-8 w-40 rounded-md" />
        <Skeleton className="h-8 w-32 rounded-md" />
      </div>

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
  )
}
