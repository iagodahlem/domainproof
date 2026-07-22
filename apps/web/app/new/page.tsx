import type { Metadata } from 'next'
import { auth, currentUser } from '@clerk/nextjs/server'
import { Logo } from '@domainproof/ui'
import { dashboardApi, type ProjectSummary } from '@/lib/api/dashboard'
import { CreateProjectFlow } from '@/components/create-project-flow'
import { ApiErrorState } from '@/components/api-error-state'
import { SignOutButton } from '@/components/dashboard/sign-out-button'

export const metadata: Metadata = {
  title: 'Create your project — DomainProof',
}

/**
 * Create-project screen (D-045): a fresh account has no project yet, so it
 * lands here and stays here — no nav, nothing else to click. The dashboard
 * shell's project switcher also routes its "New project" item here, so a
 * caller with existing projects can reach it too — routing is derived from
 * the projects list either way (no `/me` route).
 */
export default async function NewProjectPage() {
  const { getToken } = await auth()

  let projects: ProjectSummary[] = []
  let loadFailed = false
  try {
    ;({ projects } = await dashboardApi.listProjects(await getToken()))
  } catch (error) {
    console.error('Failed to load projects', error)
    loadFailed = true
  }

  const user = await currentUser()
  const email =
    user?.primaryEmailAddress?.emailAddress ??
    user?.emailAddresses[0]?.emailAddress ??
    ''

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="sticky top-0 z-10 border-b border-border bg-bg-glass backdrop-blur-header backdrop-saturate-[140%]">
        <div className="mx-auto flex min-h-15 max-w-5xl items-center justify-between gap-4 px-6 py-3">
          <Logo />
          <div className="flex items-center gap-3">
            {email ? (
              <span className="text-sm text-text-faint">{email}</span>
            ) : null}
            <SignOutButton size="sm" />
          </div>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-6 py-16">
        {loadFailed ? (
          <ApiErrorState />
        ) : (
          <CreateProjectFlow hasExistingProjects={projects.length > 0} />
        )}
      </main>
    </div>
  )
}
