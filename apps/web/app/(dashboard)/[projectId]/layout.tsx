import type { ReactNode } from 'react'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { auth, currentUser } from '@clerk/nextjs/server'
import { Callout, CenteredMain, Header, Logo } from '@domainproof/ui'
import { ApiError } from '@/lib/api/request'
import { dashboardApi } from '@/lib/api/dashboard'
import { DashboardShell } from '@/components/dashboard-shell/shell'
import { ReloadButton } from '@/components/dashboard-shell/reload-button'

export const metadata: Metadata = {
  title: 'Dashboard — DomainProof',
}

/**
 * Resolves the active project from `GET /dashboard/projects` + the
 * `projectId` URL segment (there's no `/me` route) and renders the shared
 * sidebar/topbar shell around every nav route below it. A fresh account
 * with no projects goes to `/new`; an unknown/placeholder segment (e.g.
 * `/active/...`, from the `/dashboard` redirect stub) redirects to the
 * caller's first project.
 */
export default async function DashboardProjectLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const { getToken } = await auth()
  const token = await getToken()

  let projects
  try {
    ;({ projects } = await dashboardApi.listProjects(token))
  } catch (error) {
    console.error('Failed to load projects', error)
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header left={<Logo />} />
        <CenteredMain>
          <Callout tone="warning" className="max-w-md">
            {error instanceof ApiError
              ? error.message
              : "We couldn't load your projects. Please try again."}
          </Callout>
          <ReloadButton />
        </CenteredMain>
      </div>
    )
  }

  const firstProject = projects[0]
  if (!firstProject) {
    redirect('/new')
  }

  const activeProject =
    projects.find((project) => project.id === projectId) ?? firstProject

  if (activeProject.id !== projectId) {
    redirect(`/${activeProject.id}/domains`)
  }

  const user = await currentUser()
  const email =
    user?.primaryEmailAddress?.emailAddress ??
    user?.emailAddresses[0]?.emailAddress ??
    ''

  return (
    <DashboardShell
      projects={projects}
      activeProject={activeProject}
      email={email}
    >
      {children}
    </DashboardShell>
  )
}
