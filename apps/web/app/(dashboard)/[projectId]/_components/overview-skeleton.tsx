import { Card, CardBody, CardHead, Skeleton } from '@domainproof/ui'

/**
 * Matches `ProjectOverviewView`'s real rendered shape (project header,
 * status card with its badge row and most-recent-domain block, three link
 * cards) so the section never jumps once data lands — heights measured
 * against a live render rather than guessed.
 */
export function OverviewSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="mb-6">
        <Skeleton className="h-3 w-14" />
        <Skeleton className="mt-2 h-8 w-64" />
      </div>

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
