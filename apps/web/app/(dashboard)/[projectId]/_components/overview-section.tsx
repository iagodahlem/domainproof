'use client'

import type { DomainDetail, ProjectSummary } from '@/lib/api/dashboard'
import { useOverviewDomains } from '@/lib/query/domains'
import { ProjectOverviewView } from './project-overview-view'

export interface OverviewSectionProps {
  projectId: string
  project: ProjectSummary
  /** Whether this project has registered at least one webhook endpoint, in any mode — the checklist's third step. */
  anyWebhookRegistered: boolean
  /** The sandbox domain the First-run walkthrough claims, if it already has been — the walkthrough's source of truth so its state survives a remount. */
  initialClaimedDomain: DomainDetail | null
}

/**
 * Thin client boundary between the server-prefetched primary query and the
 * presentational `ProjectOverviewView` — kept separate so that view stays a
 * plain, prop-driven component with no query-layer knowledge of its own.
 */
export function OverviewSection({
  projectId,
  project,
  anyWebhookRegistered,
  initialClaimedDomain,
}: OverviewSectionProps) {
  const { data } = useOverviewDomains(projectId)
  return (
    <ProjectOverviewView
      project={project}
      domains={data.domains}
      truncated={data.truncated}
      anyWebhookRegistered={anyWebhookRegistered}
      initialClaimedDomain={initialClaimedDomain}
    />
  )
}
