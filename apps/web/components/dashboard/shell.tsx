import type { ReactNode } from 'react'
import type { ProjectSummary } from '@/lib/api/dashboard'
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
    <div className="flex min-h-screen items-stretch bg-background max-[760px]:flex-col">
      <Sidebar projects={projects} activeProject={activeProject} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar projectId={activeProject.id} email={email} />
        <main className="flex-1 p-6 max-[640px]:p-4">{children}</main>
      </div>
    </div>
  )
}
