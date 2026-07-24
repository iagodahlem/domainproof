import type { Metadata } from 'next'
import { auth } from '@clerk/nextjs/server'
import { HydrationBoundary } from '@tanstack/react-query'
import type { Mode } from '@/lib/api/dashboard'
import { webhookEndpointsQueryOptions } from '@/lib/query/webhooks'
import { dehydrateStreaming, getQueryClient } from '@/lib/query/query-client'
import { WebhooksView } from './_components/webhooks-view'

export const metadata: Metadata = {
  title: 'Webhooks — DomainProof',
}

function resolveMode(value: string | string[] | undefined): Mode {
  return value === 'live' ? 'live' : 'test'
}

/** Prefetched (never awaited) into the query cache and streamed down — see `dehydrateStreaming`. A failed fetch surfaces through `[projectId]/error.tsx` once the client's own `useSuspenseQuery` retries and throws. */
export default async function WebhooksPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>
  searchParams: Promise<{ mode?: string }>
}) {
  const { projectId } = await params
  const { mode: rawMode } = await searchParams
  const mode = resolveMode(rawMode)
  const { getToken } = await auth()

  const queryClient = getQueryClient()
  void queryClient.prefetchQuery(
    webhookEndpointsQueryOptions(projectId, mode, getToken),
  )

  return (
    <HydrationBoundary state={dehydrateStreaming(queryClient)}>
      {/* Remounts on mode change, same reasoning as
          DomainsPage/EventsPage's own `key={mode}`. */}
      <WebhooksView key={mode} projectId={projectId} mode={mode} />
    </HydrationBoundary>
  )
}
