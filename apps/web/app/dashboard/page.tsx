import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { auth, currentUser } from '@clerk/nextjs/server'
import { SignOutButton } from '@clerk/nextjs'
import { Button, Card, CardBody, Logo } from '@domainproof/ui'
import { dashboardApi } from '@/lib/api'

export const metadata: Metadata = {
  title: 'Dashboard — DomainProof',
}

/**
 * Minimal placeholder — the real dashboard shell lands in a follow-up PR
 * (FD-022 B1). This exists so post-auth routing has somewhere to land for
 * a caller who already has a project; one with none is sent to `/new`
 * instead (see `app/new/page.tsx`) — routing is derived from the projects
 * list, there's no `/me` route.
 */
export default async function DashboardPage() {
  const { getToken } = await auth()
  const { projects } = await dashboardApi.listProjects(await getToken())

  if (projects.length === 0) {
    redirect('/new')
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

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-16">
        <h1 className="text-2xl font-heading text-text">Your projects</h1>
        <div className="mt-6 flex flex-col gap-3">
          {projects.map((project) => (
            <Card key={project.id}>
              <CardBody>
                <p className="font-heading text-text">{project.name}</p>
                <p className="mt-1 font-mono text-xs text-text-faint">
                  {project.slug}
                </p>
              </CardBody>
            </Card>
          ))}
        </div>
      </main>
    </div>
  )
}
