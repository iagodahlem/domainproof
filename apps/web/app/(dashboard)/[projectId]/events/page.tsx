import type { Metadata } from 'next'
import { auth } from '@clerk/nextjs/server'
import { dehydrate, HydrationBoundary } from '@tanstack/react-query'
import type { Mode } from '@/lib/api/dashboard'
import { projectEventsQueryOptions } from '@/lib/query/events'
import { getQueryClient } from '@/lib/query/query-client'
import { EventsView } from './_components/events-view'

export const metadata: Metadata = {
  title: 'Events — DomainProof',
}

function resolveMode(value: string | string[] | undefined): Mode {
  return value === 'live' ? 'live' : 'test'
}

export default async function EventsPage({
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
  await queryClient.fetchQuery(
    projectEventsQueryOptions(projectId, mode, getToken),
  )

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {/* Remounts on mode change (see EventsView's own `useSuspenseQuery`,
          keyed per mode) so a toggle-driven `?mode=` navigation actually
          replaces the table instead of leaving the previous mode's rows in
          place. */}
      <EventsView key={mode} projectId={projectId} mode={mode} />
    </HydrationBoundary>
  )
}
