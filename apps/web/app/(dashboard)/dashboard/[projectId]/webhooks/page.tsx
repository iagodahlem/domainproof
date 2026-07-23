import type { Metadata } from 'next'
import { auth } from '@clerk/nextjs/server'
import { dashboardApi } from '@/lib/api/dashboard'
import type { Mode } from '@/lib/api/dashboard'
import { WebhooksView } from './_components/webhooks-view'

export const metadata: Metadata = {
  title: 'Webhooks — DomainProof',
}

function resolveMode(value: string | string[] | undefined): Mode {
  return value === 'live' ? 'live' : 'test'
}

export default async function WebhooksPage({
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

  const { endpoints } = await dashboardApi.listWebhookEndpoints(
    token,
    projectId,
    { mode },
  )

  return (
    // Remounts on mode change, same reasoning as DomainsPage/EventsPage's
    // own `key={mode}`.
    <WebhooksView
      key={mode}
      projectId={projectId}
      initialEndpoints={endpoints}
    />
  )
}
