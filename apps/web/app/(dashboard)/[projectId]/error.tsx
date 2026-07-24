'use client'

import { Button, Callout } from '@domainproof/ui'
import { ApiError } from '@/lib/query/errors'

/**
 * Every route under `[projectId]` prefetches its primary query
 * server-side without awaiting it (see `dehydrateStreaming`), so a failed
 * fetch no longer surfaces as a server-rendered `Callout` the way it used
 * to — it resolves client-side instead, where `useSuspenseQuery` throws
 * it straight into this boundary. `reset()` re-renders the segment, which
 * re-runs the server component and retries the prefetch from scratch.
 */
export default function ProjectRouteError({
  error,
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return (
    <div className="flex flex-col items-start gap-4">
      <Callout tone="warning" className="max-w-md">
        {error instanceof ApiError
          ? error.message
          : "We couldn't load this page. Please try again."}
      </Callout>
      <Button onClick={reset}>Try again</Button>
    </div>
  )
}
