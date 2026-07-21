import type { Metadata } from 'next'
import { auth } from '@clerk/nextjs/server'
import { dashboardApi } from '@/lib/api'
import { WebhooksView } from '@/components/webhooks/webhooks-view'

export const metadata: Metadata = {
  title: 'Webhooks — DomainProof',
}

export default async function WebhooksPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const { getToken } = await auth()
  const token = await getToken()

  const { endpoints } = await dashboardApi.listWebhookEndpoints(
    token,
    projectId,
  )

  return <WebhooksView projectId={projectId} initialEndpoints={endpoints} />
}
