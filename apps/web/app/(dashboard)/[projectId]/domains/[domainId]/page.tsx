import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { dehydrate, HydrationBoundary } from '@tanstack/react-query'
import { Callout } from '@domainproof/ui'
import { ApiError } from '@/lib/api/request'
import {
  domainEventsQueryOptions,
  domainQueryOptions,
} from '@/lib/query/domains'
import { getQueryClient } from '@/lib/query/query-client'
import { DomainDetailClient } from '../_components/domain-detail-client'

export const metadata: Metadata = {
  title: 'Domain — DomainProof',
}

/**
 * The domain and its events timeline are the page's two primary queries,
 * prefetched together so the first render has both — a 404 on the domain
 * itself short-circuits before the events prefetch even starts, same as
 * the original sequential awaits did.
 */
export default async function DomainDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; domainId: string }>
}) {
  const { projectId, domainId } = await params
  const { getToken } = await auth()

  const queryClient = getQueryClient()
  try {
    await queryClient.fetchQuery(
      domainQueryOptions(projectId, domainId, getToken),
    )
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound()
    }
    return (
      <Callout tone="warning">
        {error instanceof ApiError
          ? error.message
          : "We couldn't load this domain. Please try again."}
      </Callout>
    )
  }
  await queryClient.fetchQuery(
    domainEventsQueryOptions(projectId, domainId, getToken),
  )

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DomainDetailClient projectId={projectId} domainId={domainId} />
    </HydrationBoundary>
  )
}
