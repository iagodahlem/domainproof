import type { Metadata } from 'next'
import { auth } from '@clerk/nextjs/server'
import { HydrationBoundary } from '@tanstack/react-query'
import type { DomainMode } from '@/lib/api/dashboard'
import { domainsListQueryOptions } from '@/lib/query/domains'
import { dehydrateStreaming, getQueryClient } from '@/lib/query/query-client'
import { DomainsPageClient } from './_components/domains-page-client'

export const metadata: Metadata = {
  title: 'Domains — DomainProof',
}

function resolveMode(value: string | string[] | undefined): DomainMode {
  return value === 'live' ? 'live' : 'test'
}

/** Prefetched (never awaited) into the query cache and streamed down — see `dehydrateStreaming`. A failed fetch surfaces through `[projectId]/error.tsx` once the client's own `useSuspenseQuery` retries and throws. */
export default async function DomainsPage({
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
    domainsListQueryOptions(projectId, mode, getToken),
  )

  return (
    <HydrationBoundary state={dehydrateStreaming(queryClient)}>
      {/* Remounts on mode change (see DomainsPageClient's own
          `useSuspenseQuery`, keyed per mode) so a toggle-driven `?mode=`
          navigation actually replaces the table instead of leaving the
          previous mode's rows in place — same as EventsPage's `key={mode}`. */}
      <DomainsPageClient key={mode} projectId={projectId} mode={mode} />
    </HydrationBoundary>
  )
}
