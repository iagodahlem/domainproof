'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Header, Logo, cn } from '@domainproof/ui'
import type { ProjectSummary } from '@/lib/api/dashboard'
import { DASHBOARD_NAV_ITEMS } from './nav-items'
import { ProjectSwitcher } from './project-switcher'
import { UserMenu } from './user-menu'

export interface SidebarProps {
  projects: ProjectSummary[]
  activeProject: ProjectSummary
  email: string
}

/**
 * Board-conformant order: project switcher at the top, nav links below it,
 * account menu pinned to the bottom. The switcher sits in a `Header`
 * (`variant="solid"`, same as the topbar) rather than hand-rolled markup,
 * so its height and bottom border line up exactly with the topbar's —
 * together they read as one continuous header band across the page.
 * Below 760px this collapses to a horizontal icon-only strip and drops the
 * switcher, matching the board's own stated mobile-nav follow-up; the
 * account menu stays visible there (end of the strip) since it's the only
 * sign-out affordance now that the topbar no longer carries one.
 */
export function Sidebar({ projects, activeProject, email }: SidebarProps) {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Dashboard"
      className="flex w-52 shrink-0 flex-col border-r border-border bg-surface max-[760px]:w-full max-[760px]:flex-row max-[760px]:items-center max-[760px]:gap-4 max-[760px]:overflow-x-auto max-[760px]:border-r-0 max-[760px]:border-b max-[760px]:p-4"
    >
      <div className="max-[760px]:hidden">
        <Header
          variant="solid"
          left={
            <ProjectSwitcher
              projects={projects}
              activeProject={activeProject}
              className="w-full"
            />
          }
        />
      </div>
      <Link
        href={`/dashboard/${activeProject.id}/domains`}
        className="hidden shrink-0 max-[760px]:flex"
      >
        <Logo />
      </Link>

      <ul className="flex flex-col gap-0.5 p-3 max-[760px]:flex-row max-[760px]:p-0">
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

      <div className="border-t border-border p-3 max-[760px]:ml-auto max-[760px]:border-t-0 max-[760px]:p-0">
        <UserMenu email={email} />
      </div>
    </nav>
  )
}
