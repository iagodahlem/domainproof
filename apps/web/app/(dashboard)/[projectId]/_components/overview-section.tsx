'use client'

import type { ProjectSummary } from '@/lib/api/dashboard'
import { useOverviewSnapshot } from '@/lib/query/domains'
import { SANDBOX_DOMAIN } from './onboarding-constants'
import { ProjectOverviewView } from './project-overview-view'

export interface OverviewSectionProps {
  projectId: string
  project: ProjectSummary
}

/**
 * Thin client boundary between the server-prefetched snapshot query and the
 * presentational `ProjectOverviewView` — kept separate so that view stays a
 * plain, prop-driven component with no query-layer knowledge of its own.
 */
export function OverviewSection({ projectId, project }: OverviewSectionProps) {
  const { data } = useOverviewSnapshot(projectId, SANDBOX_DOMAIN)
  return (
    <ProjectOverviewView
      project={project}
      domains={data.domains}
      truncated={data.truncated}
      anyWebhookRegistered={data.anyWebhookRegistered}
      initialClaimedDomain={data.initialClaimedDomain}
    />
  )
}
