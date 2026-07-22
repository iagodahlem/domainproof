import type { Metadata } from 'next'
import { auth } from '@clerk/nextjs/server'
import { Callout } from '@domainproof/ui'
import { ApiError } from '@/lib/api/request'
import { dashboardApi } from '@/lib/api/dashboard'
import { DomainsPageClient } from '@/components/dashboard/domains/domains-page-client'

export const metadata: Metadata = {
  title: 'Domains — DomainProof',
}

export default async function DomainsPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const { getToken } = await auth()
  const token = await getToken()

  try {
    const { domains, nextCursor } = await dashboardApi.listDomains(
      token,
      projectId,
    )

    return (
      <DomainsPageClient
        projectId={projectId}
        initialDomains={domains}
        initialNextCursor={nextCursor}
      />
    )
  } catch (error) {
    return (
      <Callout tone="warning">
        {error instanceof ApiError
          ? error.message
          : "We couldn't load your domains. Please try again."}
      </Callout>
    )
  }
}
