import type { ReactNode } from 'react'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { auth, currentUser } from '@clerk/nextjs/server'
import { Callout, Logo } from '@domainproof/ui'
import { ApiError, dashboardApi } from '@/lib/api'
import { DashboardShell } from '@/components/dashboard/shell'
import { ReloadButton } from '@/components/dashboard/reload-button'

export const metadata: Metadata = {
  title: 'Dashboard — DomainProof',
}

/**
 * Resolves the active project from `GET /dashboard/projects` + the
 * `projectId` URL segment (there's no `/me` route) and renders the shared
 * sidebar/topbar shell around every nav route below it. A fresh account
 * with no projects goes to `/new`; an unknown/placeholder segment (e.g.
 * `/dashboard/active/...`) redirects to the caller's first project.
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
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-bg px-6 py-16">
        <Logo />
        <Callout tone="warning" className="max-w-md">
          {error instanceof ApiError
            ? error.message
            : "We couldn't load your projects. Please try again."}
        </Callout>
        <ReloadButton />
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
    redirect(`/dashboard/${activeProject.id}/domains`)
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
