import type { Metadata } from 'next'
import { auth } from '@clerk/nextjs/server'
import { Callout } from '@domainproof/ui'
import { ApiError } from '@/lib/api/request'
import { dashboardApi } from '@/lib/api/dashboard'
import type { DomainMode } from '@/lib/api/dashboard'
import { DomainsPageClient } from '@/components/dashboard/domains/domains-page-client'

export const metadata: Metadata = {
  title: 'Domains — DomainProof',
}

function resolveMode(value: string | string[] | undefined): DomainMode {
  return value === 'live' ? 'live' : 'test'
}

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
  const token = await getToken()

  try {
    const { domains, nextCursor } = await dashboardApi.listDomains(
      token,
      projectId,
      { mode },
    )

    return (
      // Remounts on mode change (see DomainsPageClient's own
      // `useState`-seeded domain list) so a toggle-driven `?mode=`
      // navigation actually replaces the table instead of leaving the
      // previous mode's rows in place — same as EventsPage's `key={mode}`.
      <DomainsPageClient
        key={mode}
        projectId={projectId}
        mode={mode}
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
