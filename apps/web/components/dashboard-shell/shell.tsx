'use client'

import type { ReactNode } from 'react'
import type { ProjectSummary } from '@/lib/api/dashboard'
import { ModeProvider } from '@/lib/mode'
import { Sidebar } from './sidebar'
import { Topbar } from './topbar'
import { TopbarSlotProvider } from './topbar-slot'

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
      <TopbarSlotProvider>
        <div className="flex min-h-screen items-stretch bg-background max-[760px]:flex-col">
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
      </TopbarSlotProvider>
    </ModeProvider>
  )
}
