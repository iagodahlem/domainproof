import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { auth, currentUser } from '@clerk/nextjs/server'
import { Button, CenteredMain, Header, Logo, cn } from '@domainproof/ui'
import { dashboardApi, type ProjectSummary } from '@/lib/api/dashboard'
import { CREATE_PROJECT_CARD_WIDTH } from '@/lib/create-project-card-width'
import { CreateProjectFlow } from './_components/create-project-flow'
import { ApiErrorState } from './_components/api-error-state'
import { UserMenu } from '@/components/dashboard-shell/user-menu'

export const metadata: Metadata = {
  title: 'Create your project — DomainProof',
}

/**
 * Create-project screen (D-045): a fresh account has no project yet, so it
 * lands here and stays here — no nav, nothing else to click. The dashboard
 * shell's project switcher also routes its "New project" item here, so a
 * caller with existing projects can reach it too — routing is derived from
 * the projects list either way (no `/me` route).
 *
 * The back affordance rides a `?from=<projectId>` query param rather than
 * `document.referrer` — a referrer is unset on a fresh tab/direct nav and
 * strippable by the browser, while the query param survives a reload and
 * is trivial to validate server-side. `from` is only trusted once it's
 * confirmed to be one of the caller's own projects (below), which is also
 * exactly the condition under which a first-signup caller (no projects at
 * all) naturally gets no back control — there's nothing valid for `from`
 * to resolve to.
 */
export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>
}) {
  const { getToken } = await auth()
  const [{ from }, projectsOutcome] = await Promise.all([
    searchParams,
    dashboardApi
      .listProjects(await getToken())
      .then((result) => ({
        projects: result.projects,
        loadFailed: false as const,
      }))
      .catch((error: unknown) => {
        console.error('Failed to load projects', error)
        return { projects: [] as ProjectSummary[], loadFailed: true as const }
      }),
  ])
  const { projects, loadFailed } = projectsOutcome
  const previousProject = projects.find((project) => project.id === from)

  const user = await currentUser()
  const email =
    user?.primaryEmailAddress?.emailAddress ??
    user?.emailAddresses[0]?.emailAddress ??
    ''
  const namePrefill =
    projects.length === 0
      ? user?.firstName
        ? `${user.firstName}'s project`
        : 'My project'
      : undefined

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header
        contentClassName="mx-0 max-w-none px-5 max-[640px]:px-4"
        left={<Logo />}
        right={email ? <UserMenu email={email} iconOnly /> : null}
      />

      <CenteredMain>
        {loadFailed ? (
          <ApiErrorState />
        ) : (
          <div
            className={cn(
              'flex w-full flex-col gap-3',
              CREATE_PROJECT_CARD_WIDTH,
            )}
          >
            {previousProject ? (
              <Button asChild variant="ghost" size="sm" className="self-start">
                <Link href={`/${previousProject.id}`}>
                  <ArrowLeft aria-hidden="true" size={14} />
                  Back to {previousProject.name}
                </Link>
              </Button>
            ) : null}
            <CreateProjectFlow
              hasExistingProjects={projects.length > 0}
              namePrefill={namePrefill}
            />
          </div>
        )}
      </CenteredMain>
    </div>
  )
}
