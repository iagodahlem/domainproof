import { Activity, Globe, Zap } from 'lucide-react'
import { Badge, Card, CardBody, CardHead } from '@domainproof/ui'
import type {
  DomainDetail,
  DomainListItem,
  DomainStatus,
  ProjectSummary,
} from '@/lib/api/dashboard'
import { domainStatusPresentation } from '@/lib/domain-status'
import { formatRelativeTime } from '@/lib/format-relative-time'
import { deriveChecklistProgress } from './checklist-progress'
import { OnboardingPanel } from './onboarding-panel'
import { OverviewLinkCard } from './overview-link-card'
import { SetupChecklist } from './setup-checklist'

export interface ProjectOverviewViewProps {
  project: ProjectSummary
  domains: DomainListItem[]
  /** True once the domains snapshot below hit the fetch limit — the counts are a lower bound, not an exhaustive tally. */
  truncated: boolean
  /** Whether this project has registered at least one webhook endpoint, in any mode — the checklist's third step. */
  anyWebhookRegistered: boolean
  /** The sandbox domain the First-run walkthrough claims, if it already has been — the walkthrough's source of truth so its state survives a remount. */
  initialClaimedDomain: DomainDetail | null
}

// Every status worth its own badge, in the order builders scan a health
// check: what's working, what's in flight, what needs attention.
const STATUS_ORDER: DomainStatus[] = [
  'verified',
  'pending',
  'temporarily_failed',
  'failed',
  'not_started',
]

export function ProjectOverviewView({
  project,
  domains,
  truncated,
  anyWebhookRegistered,
  initialClaimedDomain,
}: ProjectOverviewViewProps) {
  const total = domains.length
  // `listDomains` returns both modes mixed, newest first — the first row is
  // the most recently touched domain regardless of mode.
  const mostRecent = domains[0]

  const countsByStatus = domains.reduce<Partial<Record<DomainStatus, number>>>(
    (acc, domain) => {
      acc[domain.status] = (acc[domain.status] ?? 0) + 1
      return acc
    },
    {},
  )
  const testCount = domains.filter((domain) => domain.mode === 'test').length
  const liveCount = total - testCount

  const progress = deriveChecklistProgress({
    anyDomainVerified: domains.some((domain) => domain.status === 'verified'),
    anyWebhookRegistered,
  })

  return (
    <div>
      <header className="mb-6">
        <p className="font-mono text-xs font-semibold tracking-widest text-accent uppercase">
          Project
        </p>
        {/* Topbar already renders the page's own <h1> ("Overview") — this is
            the project name, not a second top-level heading. */}
        <h2 className="mt-1 text-2xl font-heading text-foreground">
          {project.name}
        </h2>
      </header>

      <SetupChecklist
        project={project}
        progress={progress}
        firstRunContent={
          <OnboardingPanel
            projectId={project.id}
            initialClaimedDomain={initialClaimedDomain}
          />
        }
      />

      {total > 0 ? (
        <>
          <Card className="mb-6">
            <CardHead>
              <h2 className="text-lg font-heading text-foreground">Status</h2>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-faint-foreground">
                <span>
                  <strong className="font-semibold text-muted-foreground">
                    {testCount}
                  </strong>{' '}
                  test
                </span>
                <span>
                  <strong className="font-semibold text-muted-foreground">
                    {liveCount}
                  </strong>{' '}
                  live
                </span>
              </div>
            </CardHead>
            <CardBody className="flex flex-col gap-5">
              <div className="flex flex-wrap gap-2">
                {STATUS_ORDER.filter((status) => countsByStatus[status]).map(
                  (status) => {
                    const presentation = domainStatusPresentation(status)
                    return (
                      <Badge key={status} tone={presentation.tone}>
                        {countsByStatus[status]} {presentation.label}
                      </Badge>
                    )
                  },
                )}
              </div>

              {mostRecent ? (
                <div>
                  <p className="mb-2 text-xs font-semibold text-muted-foreground">
                    Most recent domain
                  </p>
                  <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface-2 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {mostRecent.domain}
                      </p>
                      <p className="text-xs text-faint-foreground">
                        {formatRelativeTime(mostRecent.updatedAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge
                        tone={
                          mostRecent.mode === 'live' ? 'success' : 'warning'
                        }
                        mode
                      >
                        {mostRecent.mode === 'live' ? 'Live' : 'Test'}
                      </Badge>
                      <Badge
                        tone={domainStatusPresentation(mostRecent.status).tone}
                      >
                        {domainStatusPresentation(mostRecent.status).label}
                      </Badge>
                    </div>
                  </div>
                </div>
              ) : null}

              {truncated ? (
                <p className="text-xs text-faint-foreground">
                  Showing the {total} most recently touched domains.
                </p>
              ) : null}
            </CardBody>
          </Card>

          <div className="grid grid-cols-3 gap-4 max-[640px]:grid-cols-1">
            <OverviewLinkCard
              href={`/${project.id}/domains`}
              icon={Globe}
              title="Domains"
              description={`${total} domain${total === 1 ? '' : 's'} across test and live`}
            />
            <OverviewLinkCard
              href={`/${project.id}/events`}
              icon={Activity}
              title="Events"
              description="Every claim, check, and state change, in order"
            />
            <OverviewLinkCard
              href={`/${project.id}/webhooks`}
              icon={Zap}
              title="Webhooks"
              description="Get notified the moment a domain's state changes"
            />
          </div>
        </>
      ) : null}
    </div>
  )
}
