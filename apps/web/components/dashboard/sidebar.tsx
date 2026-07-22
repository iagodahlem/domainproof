'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Logo, cn } from '@domainproof/ui'
import type { ProjectSummary } from '@/lib/api/dashboard'
import { DASHBOARD_NAV_ITEMS } from './nav-items'
import { ProjectSwitcher } from './project-switcher'

export interface SidebarProps {
  projects: ProjectSummary[]
  activeProject: ProjectSummary
}

/**
 * Nav links live directly under the logo so they're never pushed down by
 * project context; the project switcher is pinned to the bottom instead
 * (deviation from the board mock, which puts the switcher at the top —
 * see the PR description). Below 760px it collapses to a horizontal
 * icon-only strip and drops the switcher, matching the board's own stated
 * mobile-nav follow-up.
 */
export function Sidebar({ projects, activeProject }: SidebarProps) {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Dashboard"
      className="flex w-52 shrink-0 flex-col border-r border-border bg-surface p-3 max-[760px]:w-full max-[760px]:flex-row max-[760px]:items-center max-[760px]:gap-4 max-[760px]:overflow-x-auto max-[760px]:border-r-0 max-[760px]:border-b max-[760px]:p-4"
    >
      <Link
        href={`/dashboard/${activeProject.id}/domains`}
        className="mb-5 px-2 max-[760px]:mb-0 max-[760px]:shrink-0 max-[760px]:px-0"
      >
        <Logo />
      </Link>

      <ul className="flex flex-col gap-0.5 max-[760px]:flex-row">
        {DASHBOARD_NAV_ITEMS.map((item) => {
          const href = `/dashboard/${activeProject.id}/${item.segment}`
          const active = pathname.startsWith(href)
          const Icon = item.icon

          return (
            <li key={item.segment}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors duration-150 hover:bg-surface-2 hover:text-foreground',
                  active && 'bg-accent-soft text-accent hover:bg-accent-soft',
                )}
              >
                <Icon
                  aria-hidden="true"
                  size={15}
                  className={cn(
                    'shrink-0 text-faint-foreground',
                    active && 'text-accent',
                  )}
                />
                <span className="max-[760px]:hidden">{item.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>

      <div className="flex-1 max-[760px]:hidden" />

      <div className="max-[760px]:hidden">
        <ProjectSwitcher projects={projects} activeProject={activeProject} />
      </div>
    </nav>
  )
}
