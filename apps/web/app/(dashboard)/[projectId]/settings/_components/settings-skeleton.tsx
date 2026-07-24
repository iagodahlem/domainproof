import { Card, CardBody, CardRow, RecordCard, Skeleton } from '@domainproof/ui'

/**
 * Matches `SettingsView`'s real rendered shape: `ProjectNameCard` (a
 * single-field form card) above `ApiKeysCard` (a titled record card with a
 * couple of key rows, each a label/badge line, a masked-value line, and
 * trailing action buttons).
 */
export function SettingsSkeleton() {
  return (
    <div aria-hidden="true">
      <Card className="max-w-xl">
        <CardBody>
          <Skeleton className="mb-5 h-5.5 w-36" />
          <Skeleton className="mb-1 h-3 w-24" />
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="mt-3 h-3 w-72" />
        </CardBody>
      </Card>

      <div className="mt-6 max-w-xl">
        <RecordCard title={<Skeleton className="h-5.5 w-20" />}>
          <SettingsKeyRowSkeleton />
          <SettingsKeyRowSkeleton />
        </RecordCard>
      </div>
    </div>
  )
}

function SettingsKeyRowSkeleton() {
  return (
    <CardRow>
      <div className="flex flex-wrap items-center gap-4">
        <span className="inline-flex items-center gap-1.5">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-4.5 w-10 rounded-full" />
        </span>
        <Skeleton className="h-4 w-40" />
        <div className="flex shrink-0 gap-2">
          <Skeleton className="h-7 w-16 rounded-md" />
          <Skeleton className="h-7 w-16 rounded-md" />
        </div>
      </div>
      <div className="mt-2 max-w-[58ch] pl-27 max-[560px]:pl-0">
        <Skeleton className="h-3 w-48" />
      </div>
    </CardRow>
  )
}
