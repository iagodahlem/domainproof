import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { auth, currentUser } from '@clerk/nextjs/server'
import { SignOutButton } from '@clerk/nextjs'
import { Button, Logo } from '@domainproof/ui'
import { dashboardApi } from '@/lib/api'
import { CreateProjectFlow } from '@/components/create-project-flow'

export const metadata: Metadata = {
  title: 'Create your project — DomainProof',
}

/**
 * Locked create-project screen (D-045): a fresh account has no project yet,
 * so it lands here and stays here — no nav, nothing else to click. Routing
 * is derived from the projects list (no `/me` route): a caller who already
 * has one is sent straight to `/dashboard` instead.
 */
export default async function NewProjectPage() {
  const { getToken } = await auth()
  const { projects } = await dashboardApi.listProjects(await getToken())

  if (projects.length > 0) {
    redirect('/dashboard')
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
            <SignOutButton redirectUrl="/">
              <Button size="sm">Sign out</Button>
            </SignOutButton>
          </div>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-6 py-16">
        <CreateProjectFlow />
      </main>
    </div>
  )
}
