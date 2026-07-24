import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { Callout } from '@domainproof/ui'
import { ApiError } from '@/lib/api/request'
import { dashboardApi } from '@/lib/api/dashboard'
import { SANDBOX_DOMAIN } from './_components/onboarding-constants'
import { ProjectOverviewView } from './_components/project-overview-view'

export const metadata: Metadata = {
  title: 'Overview — DomainProof',
}

// A snapshot for the health-check summary below, not exhaustive pagination —
// the max page size the dashboard API allows in one call.
const OVERVIEW_DOMAINS_LIMIT = 100

/**
 * `[projectId]/layout.tsx` already resolves and validates `projectId`
 * against the caller's own projects (redirecting otherwise), so the
 * `listProjects` call below — deduped by Next's request memoization
 * against the layout's identical call — is guaranteed to contain it, same
 * reasoning as `SettingsPage`.
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

  try {
    const [{ domains, nextCursor }, { endpoints }] = await Promise.all([
      dashboardApi.listDomains(token, projectId, {
        limit: OVERVIEW_DOMAINS_LIMIT,
      }),
      // No `mode` filter — the checklist only cares whether *any* endpoint
      // exists, in either mode.
      dashboardApi.listWebhookEndpoints(token, projectId),
    ])

    // The onboarding walkthrough's own claimed-domain state has to survive
    // a remount (collapsing/expanding the checklist, or a reload) — fetched
    // here, alongside everything else this page already needs, so
    // `OnboardingPanel` can seed its state from real project data instead
    // of starting blank every time it mounts.
    const sandboxDomainSummary = domains.find(
      (domain) => domain.mode === 'test' && domain.domain === SANDBOX_DOMAIN,
    )
    const initialClaimedDomain = sandboxDomainSummary
      ? (
          await dashboardApi.getDomain(
            token,
            projectId,
            sandboxDomainSummary.id,
          )
        ).domain
      : null

    return (
      <ProjectOverviewView
        project={project}
        domains={domains}
        truncated={nextCursor !== null}
        anyWebhookRegistered={endpoints.length > 0}
        initialClaimedDomain={initialClaimedDomain}
      />
    )
  } catch (error) {
    return (
      <Callout tone="warning">
        {error instanceof ApiError
          ? error.message
          : "We couldn't load your domains. Please try again."}
      </Callout>
    )
  }
}
