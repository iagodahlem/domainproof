import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { HydrationBoundary } from '@tanstack/react-query'
import { dashboardApi } from '@/lib/api/dashboard'
import { overviewSnapshotQueryOptions } from '@/lib/query/domains'
import { dehydrateStreaming, getQueryClient } from '@/lib/query/query-client'
import { SANDBOX_DOMAIN } from './_components/onboarding-constants'
import { OverviewSection } from './_components/overview-section'

export const metadata: Metadata = {
  title: 'Overview — DomainProof',
}

/**
 * `[projectId]/layout.tsx` already resolves and validates `projectId`
 * against the caller's own projects (redirecting otherwise), so the
 * `listProjects` call below — deduped by Next's request memoization
 * against the layout's identical call — is guaranteed to contain it, same
 * reasoning as `SettingsPage`. The health-check snapshot itself is only
 * *prefetched* (never awaited) into the query cache and streamed into
 * `OverviewSection` via `HydrationBoundary` — see `dehydrateStreaming` —
 * so the server never blocks render on the dashboard API; the client
 * suspends on `loading.tsx`'s skeleton instead and fills in once the
 * prefetch resolves. A failed fetch surfaces through `[projectId]/error.tsx`
 * once the client's own `useSuspenseQuery` retries and throws.
 */
export default async function ProjectOverviewPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const { getToken } = await auth()
  const token = await getToken()

  const { projects } = await dashboardApi.listProjects(token)
  const project = projects.find((candidate) => candidate.id === projectId)
  if (!project) {
    notFound()
  }

  const queryClient = getQueryClient()
  void queryClient.prefetchQuery(
    overviewSnapshotQueryOptions(projectId, getToken, SANDBOX_DOMAIN),
  )

  return (
    <HydrationBoundary state={dehydrateStreaming(queryClient)}>
      <OverviewSection projectId={projectId} project={project} />
    </HydrationBoundary>
  )
}
