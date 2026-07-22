import type { Metadata } from 'next'
import { auth } from '@clerk/nextjs/server'
import { dashboardApi } from '@/lib/api/dashboard'
import type { Mode } from '@/lib/api/dashboard'
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
  const token = await getToken()

  const { events, nextCursor } = await dashboardApi.listProjectEvents(
    token,
    projectId,
    { mode },
  )

  return (
    // Remounts on mode change (see EventsView's own `useState`-seeded
    // event list) so a toggle-driven `?mode=` navigation actually replaces
    // the table instead of leaving the previous mode's rows in place.
    <EventsView
      key={mode}
      projectId={projectId}
      mode={mode}
      initialEvents={events}
      initialCursor={nextCursor}
    />
  )
}
