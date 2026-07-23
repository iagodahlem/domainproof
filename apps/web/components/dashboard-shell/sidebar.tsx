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
 * Board-conformant order: logo, then project switcher at the top, nav links
 * below that, account menu pinned to the bottom. The test/live mode switch
 * lives in the shell's topbar instead (each page's own header, next to that
 * page's action button) — the board's own placement, not a sidebar
 * deviation. The logo and switcher each sit in their own `Header`
 * (`variant="solid"`, same as the topbar) rather than hand-rolled markup, so
 * their height and bottom border line up exactly with the topbar's —
 * together they read as one continuous header band across the page.
 *
 * Below 760px this collapses to a 3-column grid strip (`1fr auto 1fr`) so
 * the nav icons stay truly centered regardless of how wide the flanking
 * content is: logo (icon-only, no wordmark) + a compact project switcher
 * on the left, nav icons centered, account menu (icon-only) on the right —
 * opposite the logo. The account menu stays visible there since it's the
 * only sign-out affordance now that the topbar no longer carries one; the
 * switcher reappearing here is a proposal beyond the board's own stated
 * mobile-nav follow-up (see the PR description).
 */
export function Sidebar({ projects, activeProject, email }: SidebarProps) {
  const pathname = usePathname()
  const domainsHref = `/dashboard/${activeProject.id}/domains`

  return (
    <nav
      aria-label="Dashboard"
      className="sticky top-0 flex h-screen w-52 shrink-0 flex-col self-start overflow-y-auto border-r border-border bg-surface max-[760px]:static max-[760px]:h-auto max-[760px]:w-full max-[760px]:grid max-[760px]:grid-cols-[1fr_auto_1fr] max-[760px]:items-center max-[760px]:gap-4 max-[760px]:overflow-x-auto max-[760px]:overflow-y-visible max-[760px]:border-r-0 max-[760px]:border-b max-[760px]:p-4"
    >
      <div className="max-[760px]:hidden">
        <Header
          variant="solid"
          left={
            <Link href={domainsHref} className="shrink-0">
              <Logo />
            </Link>
          }
        />
      </div>
      <div className="max-[760px]:hidden">
        <Header
          variant="solid"
          contentClassName="px-3 max-[640px]:px-3"
          left={
            <ProjectSwitcher
              projects={projects}
              activeProject={activeProject}
              className="w-full"
            />
          }
        />
      </div>

      <div className="hidden items-center gap-2 max-[760px]:flex max-[760px]:justify-self-start">
        <Link href={domainsHref} className="shrink-0">
          <Logo iconOnly />
        </Link>
        <ProjectSwitcher
          projects={projects}
          activeProject={activeProject}
          compact
        />
      </div>

      <ul className="flex flex-col gap-0.5 p-3 max-[760px]:flex-row max-[760px]:justify-self-center max-[760px]:p-0">
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

      <div className="border-t border-border p-3 max-[760px]:justify-self-end max-[760px]:border-t-0 max-[760px]:p-0">
        <UserMenu email={email} className="max-[760px]:hidden" />
        <UserMenu email={email} iconOnly className="hidden max-[760px]:flex" />
      </div>
    </nav>
  )
}
