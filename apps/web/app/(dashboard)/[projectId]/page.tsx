import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { dehydrate, HydrationBoundary } from '@tanstack/react-query'
import { Callout } from '@domainproof/ui'
import { ApiError } from '@/lib/api/request'
import { dashboardApi } from '@/lib/api/dashboard'
import type { DomainDetail } from '@/lib/api/dashboard'
import { overviewDomainsQueryOptions } from '@/lib/query/domains'
import { getQueryClient } from '@/lib/query/query-client'
import { SANDBOX_DOMAIN } from './_components/onboarding-constants'
import { OverviewSection } from './_components/overview-section'

export const metadata: Metadata = {
  title: 'Overview — DomainProof',
}

/**
 * `[projectId]/layout.tsx` already resolves and validates `projectId`
 * against the caller's own projects (redirecting otherwise), so the
 * `listProjects` call below — deduped by Next's request memoization
 * against the layout's identical call — is guaranteed to contain it, same
 * reasoning as `SettingsPage`. The domains snapshot itself is prefetched
 * into the query cache and dehydrated into `OverviewSection`, which reads
 * it via `useOverviewDomains` — a client-side refetch/poll never needs a
 * server round trip for this same data again.
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

  const queryClient = getQueryClient()
  let anyWebhookRegistered: boolean
  let initialClaimedDomain: DomainDetail | null
  try {
    const [{ domains }, { endpoints }] = await Promise.all([
      queryClient.fetchQuery(
        overviewDomainsQueryOptions(projectId, getToken),
      ),
      // No `mode` filter — the checklist only cares whether *any* endpoint
      // exists, in either mode.
      dashboardApi.listWebhookEndpoints(token, projectId),
    ])
    anyWebhookRegistered = endpoints.length > 0

    // The onboarding walkthrough's own claimed-domain state has to survive
    // a remount (collapsing/expanding the checklist, or a reload) — fetched
    // here, alongside everything else this page already needs, so
    // `OnboardingPanel` can seed its state from real project data instead
    // of starting blank every time it mounts.
    const sandboxDomainSummary = domains.find(
      (domain) => domain.mode === 'test' && domain.domain === SANDBOX_DOMAIN,
    )
    initialClaimedDomain = sandboxDomainSummary
      ? (
          await dashboardApi.getDomain(
            token,
            projectId,
            sandboxDomainSummary.id,
          )
        ).domain
      : null
  } catch (error) {
    return (
      <Callout tone="warning">
        {error instanceof ApiError
          ? error.message
          : "We couldn't load your domains. Please try again."}
      </Callout>
    )
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <OverviewSection
        projectId={projectId}
        project={project}
        anyWebhookRegistered={anyWebhookRegistered}
        initialClaimedDomain={initialClaimedDomain}
      />
    </HydrationBoundary>
  )
}
