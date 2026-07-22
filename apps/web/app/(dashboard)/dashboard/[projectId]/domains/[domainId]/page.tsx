import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { Callout } from '@domainproof/ui'
import { ApiError } from '@/lib/api/request'
import { dashboardApi } from '@/lib/api/dashboard'
import { DomainDetailClient } from '@/components/dashboard/domains/domain-detail-client'

export const metadata: Metadata = {
  title: 'Domain — DomainProof',
}

export default async function DomainDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; domainId: string }>
}) {
  const { projectId, domainId } = await params
  const { getToken } = await auth()
  const token = await getToken()

  let domain
  try {
    ;({ domain } = await dashboardApi.getDomain(token, projectId, domainId))
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

  const { events, nextCursor } = await dashboardApi.listDomainEvents(
    token,
    projectId,
    domainId,
  )

  return (
    <DomainDetailClient
      projectId={projectId}
      initialDomain={domain}
      initialEvents={events}
      initialEventsNextCursor={nextCursor}
    />
  )
}
