import type { Metadata } from 'next'
import { auth } from '@clerk/nextjs/server'
import { dashboardApi } from '@/lib/api/dashboard'
import { EventsView } from '@/components/events/events-view'

export const metadata: Metadata = {
  title: 'Events — DomainProof',
}

export default async function EventsPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const { getToken } = await auth()
  const token = await getToken()

  const { events, nextCursor } = await dashboardApi.listProjectEvents(
    token,
    projectId,
  )

  return (
    <EventsView
      projectId={projectId}
      initialEvents={events}
      initialCursor={nextCursor}
    />
  )
}
