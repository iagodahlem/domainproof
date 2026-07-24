import type { Metadata } from 'next'
import { auth } from '@clerk/nextjs/server'
import { HydrationBoundary } from '@tanstack/react-query'
import {
  domainEventsQueryOptions,
  domainQueryOptions,
} from '@/lib/query/domains'
import { dehydrateStreaming, getQueryClient } from '@/lib/query/query-client'
import { DomainDetailClient } from '../_components/domain-detail-client'

export const metadata: Metadata = {
  title: 'Domain — DomainProof',
}

/**
 * The domain and its events timeline are the page's two primary queries,
 * both prefetched (never awaited) in parallel so the server never blocks
 * on either — see `dehydrateStreaming`. A 404 can no longer short-circuit
 * here since that would require awaiting the domain fetch first; instead
 * `DomainDetailClient` calls Next's `notFound()` itself once its own
 * `useSuspenseQuery` throws a 404 `ApiError`. A non-404 failure surfaces
 * through `[projectId]/error.tsx`.
 */
export default async function DomainDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; domainId: string }>
}) {
  const { projectId, domainId } = await params
  const { getToken } = await auth()

  const queryClient = getQueryClient()
  void queryClient.prefetchQuery(
    domainQueryOptions(projectId, domainId, getToken),
  )
  void queryClient.prefetchQuery(
    domainEventsQueryOptions(projectId, domainId, getToken),
  )

  return (
    <HydrationBoundary state={dehydrateStreaming(queryClient)}>
      <DomainDetailClient projectId={projectId} domainId={domainId} />
    </HydrationBoundary>
  )
}
