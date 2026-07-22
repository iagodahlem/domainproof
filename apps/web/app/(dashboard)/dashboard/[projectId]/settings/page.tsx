import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { dashboardApi } from '@/lib/api/dashboard'
import { SettingsView } from './_components/settings-view'

export const metadata: Metadata = {
  title: 'Settings — DomainProof',
}

/**
 * `[projectId]/layout.tsx` already resolves and validates `projectId`
 * against the caller's own projects (redirecting otherwise), so the
 * `listProjects` call below — deduped by Next's request memoization
 * against the layout's identical call — is guaranteed to contain it.
 */
export default async function SettingsPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const { getToken } = await auth()
  const token = await getToken()

  const [{ projects }, { apiKeys }] = await Promise.all([
    dashboardApi.listProjects(token),
    dashboardApi.listKeys(token, projectId),
  ])

  const project = projects.find((candidate) => candidate.id === projectId)
  if (!project) {
    notFound()
  }

  return <SettingsView project={project} apiKeys={apiKeys} />
}
