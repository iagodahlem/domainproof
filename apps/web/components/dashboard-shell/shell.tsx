'use client'

import type { ReactNode } from 'react'
import { cn } from '@domainproof/ui'
import type { ProjectSummary } from '@/lib/api/dashboard'
import { ModeProvider, useMode } from '@/lib/mode'
import { Sidebar } from './sidebar'
import { Topbar } from './topbar'

export interface DashboardShellProps {
  projects: ProjectSummary[]
  activeProject: ProjectSummary
  email: string
  children: ReactNode
}

export function DashboardShell({
  projects,
  activeProject,
  email,
  children,
}: DashboardShellProps) {
  return (
    <ModeProvider>
      <ShellBody
        projects={projects}
        activeProject={activeProject}
        email={email}
      >
        {children}
      </ShellBody>
    </ModeProvider>
  )
}

/**
 * Split from `DashboardShell` so `useMode()` (needed for the test-mode top
 * border) can run inside the provider it's mounted from, rather than the
 * component that renders that provider.
 */
function ShellBody({
  projects,
  activeProject,
  email,
  children,
}: DashboardShellProps) {
  const { mode } = useMode()

  return (
    <div
      className={cn(
        'flex min-h-screen items-stretch bg-background max-[760px]:flex-col',
        mode === 'test' && 'border-t-2 border-warning',
      )}
    >
      <Sidebar
        projects={projects}
        activeProject={activeProject}
        email={email}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar projectId={activeProject.id} />
        <main className="flex-1 p-6 max-[640px]:p-4">{children}</main>
      </div>
    </div>
  )
}
