import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { HydrationBoundary } from '@tanstack/react-query'
import { dashboardApi } from '@/lib/api/dashboard'
import { apiKeysQueryOptions } from '@/lib/query/keys'
import { dehydrateStreaming, getQueryClient } from '@/lib/query/query-client'
import { SettingsView } from './_components/settings-view'

export const metadata: Metadata = {
  title: 'Settings — DomainProof',
}

/**
 * `[projectId]/layout.tsx` already resolves and validates `projectId`
 * against the caller's own projects (redirecting otherwise), so the
 * `listProjects` call below — deduped by Next's request memoization
 * against the layout's identical call — is guaranteed to contain it. The
 * API keys list is the page's only real content query, so it's the only
 * one prefetched (never awaited) into the query cache and streamed down —
 * see `dehydrateStreaming`. A failed fetch surfaces through
 * `[projectId]/error.tsx` once the client's own `useSuspenseQuery` retries
 * and throws.
 */
export default async function SettingsPage({
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
  void queryClient.prefetchQuery(apiKeysQueryOptions(projectId, getToken))

  return (
    <HydrationBoundary state={dehydrateStreaming(queryClient)}>
      <SettingsView project={project} />
    </HydrationBoundary>
  )
}
