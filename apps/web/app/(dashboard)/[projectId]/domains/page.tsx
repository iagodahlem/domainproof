import type { Metadata } from 'next'
import { auth } from '@clerk/nextjs/server'
import { dehydrate, HydrationBoundary } from '@tanstack/react-query'
import { Callout } from '@domainproof/ui'
import { ApiError } from '@/lib/api/request'
import type { DomainMode } from '@/lib/api/dashboard'
import { domainsListQueryOptions } from '@/lib/query/domains'
import { getQueryClient } from '@/lib/query/query-client'
import { DomainsPageClient } from './_components/domains-page-client'

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

  const queryClient = getQueryClient()
  try {
    await queryClient.fetchQuery(
      domainsListQueryOptions(projectId, mode, getToken),
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

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {/* Remounts on mode change (see DomainsPageClient's own
          `useSuspenseQuery`, keyed per mode) so a toggle-driven `?mode=`
          navigation actually replaces the table instead of leaving the
          previous mode's rows in place — same as EventsPage's `key={mode}`. */}
      <DomainsPageClient key={mode} projectId={projectId} mode={mode} />
    </HydrationBoundary>
  )
}
