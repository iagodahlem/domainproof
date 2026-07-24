import { Card, CardBody, CardHead, Skeleton } from '@domainproof/ui'

/**
 * Matches `ProjectOverviewView`'s real rendered shape, sized for its
 * tallest common case — a fresh project, where `SetupChecklist` renders
 * expanded (the "Get started" card, with the First-run step's full
 * walkthrough body) rather than the collapsed strip a project with both
 * required steps done falls back to. A populated project's Status card and
 * three link cards render underneath regardless (they only disappear on a
 * project with zero domains at all, the same fresh state that keeps the
 * checklist expanded), so this stays a reasonable approximation either
 * way — heights measured against a live render rather than guessed.
 */
export function OverviewSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="mb-6">
        <Skeleton className="h-3 w-14" />
        <Skeleton className="mt-2 h-8 w-64" />
      </div>

      <ChecklistSkeleton />

      <Card className="mb-6">
        <CardHead>
          <Skeleton className="h-5.5 w-16" />
          <div className="flex items-center gap-4">
            <Skeleton className="h-4 w-14" />
            <Skeleton className="h-4 w-14" />
          </div>
        </CardHead>
        <CardBody className="flex flex-col gap-5">
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-5.5 w-24 rounded-full" />
            <Skeleton className="h-5.5 w-28 rounded-full" />
            <Skeleton className="h-5.5 w-32 rounded-full" />
          </div>
          <div>
            <Skeleton className="mb-2 h-3 w-32" />
            <Skeleton className="h-14 w-full rounded-md" />
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-3 gap-4 max-[640px]:grid-cols-1">
        <Skeleton className="h-33 w-full rounded-lg" />
        <Skeleton className="h-33 w-full rounded-lg" />
        <Skeleton className="h-33 w-full rounded-lg" />
      </div>
    </div>
  )
}

/** `SetupChecklist`'s expanded shape — see `setup-checklist.tsx`. The first-run row's own content approximates `OnboardingPanel`'s callout, path tabs, and walkthrough steps rather than any one integration path's exact (and highly variable) body. */
function ChecklistSkeleton() {
  return (
    <div className="mb-6 overflow-hidden rounded-lg border border-border bg-surface">
      <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
        <Skeleton className="h-5 w-28" />
        <div className="flex items-center gap-3">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-1 w-24 rounded-full" />
        </div>
      </div>

      <div className="flex gap-4 border-b border-border p-5">
        <Skeleton className="mt-px h-6 w-6 shrink-0 rounded-full" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Skeleton className="h-4.5 w-36" />
          <Skeleton className="h-3.5 w-56" />
        </div>
      </div>

      <div className="flex gap-4 border-b border-border bg-accent/5 p-5">
        <Skeleton className="mt-px h-6 w-6 shrink-0 rounded-full" />
        <div className="flex min-w-0 flex-1 flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4.5 w-24" />
            <Skeleton className="h-3.5 w-72" />
          </div>
          <Skeleton className="h-12 w-full rounded-md" />
          <div className="flex flex-wrap gap-3">
            <Skeleton className="h-16.5 w-44 rounded-lg" />
            <Skeleton className="h-16.5 w-44 rounded-lg" />
            <Skeleton className="h-16.5 w-44 rounded-lg" />
            <Skeleton className="h-16.5 w-44 rounded-lg" />
          </div>
          <Skeleton className="h-3.5 w-96 max-w-full" />

          {/* `VerticalTimeline`'s real 3-step shape — node/connector column
              + title/description/content column, same structure and gaps
              as `vertical-timeline.tsx`. Step 1 ("Claim your first domain")
              is the tall one: it's the only step with a `content` body
              (`ClaimStepContent`'s `CodePanel`), so it gets a code-panel-
              shaped placeholder rather than being sized like steps 2/3. */}
          <div className="flex flex-col">
            <div className="relative flex gap-4 pb-8">
              <div className="flex w-7 shrink-0 flex-col items-center">
                <Skeleton className="h-7 w-7 shrink-0 rounded-full" />
                <Skeleton className="mt-2 h-full w-0.5 min-h-4 flex-1" />
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <Skeleton className="h-4.5 w-52" />
                <Skeleton className="mt-2 h-3.5 w-full max-w-[54ch]" />
                <Skeleton className="mt-1 h-3.5 w-2/3 max-w-[54ch]" />
                <div className="mt-4 overflow-hidden rounded-lg border border-border">
                  <div className="flex items-center gap-1 border-b border-border bg-surface-2 px-3 py-2">
                    <Skeleton className="h-5 w-11 rounded-full" />
                    <Skeleton className="h-5 w-11 rounded-full" />
                    <Skeleton className="h-5 w-14 rounded-full" />
                  </div>
                  <div className="flex flex-col gap-2 p-4">
                    <Skeleton className="h-3 w-3/4" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-5/6" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                </div>
                <Skeleton className="mt-3 h-7 w-40 rounded-md" />
                <Skeleton className="mt-3 h-3.5 w-3/4" />
              </div>
            </div>

            <div className="relative flex gap-4 pb-8">
              <div className="flex w-7 shrink-0 flex-col items-center">
                <Skeleton className="h-7 w-7 shrink-0 rounded-full" />
                <Skeleton className="mt-2 h-full w-0.5 min-h-4 flex-1" />
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <Skeleton className="h-4.5 w-56" />
                <Skeleton className="mt-2 h-3.5 w-full max-w-[54ch]" />
                <Skeleton className="mt-1 h-3.5 w-1/2 max-w-[54ch]" />
              </div>
            </div>

            <div className="relative flex gap-4">
              <div className="flex w-7 shrink-0 flex-col items-center">
                <Skeleton className="h-7 w-7 shrink-0 rounded-full" />
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <Skeleton className="h-4.5 w-20" />
                <Skeleton className="mt-2 h-3.5 w-2/3 max-w-[54ch]" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-4 p-5">
        <Skeleton className="mt-px h-6 w-6 shrink-0 rounded-full" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Skeleton className="h-4.5 w-40" />
          <Skeleton className="h-3.5 w-64" />
        </div>
      </div>
    </div>
  )
}
