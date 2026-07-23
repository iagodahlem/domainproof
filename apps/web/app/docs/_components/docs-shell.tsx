import type { ReactNode } from 'react'
import { DocsSidebar } from './docs-sidebar'
import type { DocsNavGroup } from '../_lib/content'

export interface DocsShellProps {
  groups: DocsNavGroup[]
  activeSlug?: string
  toc?: ReactNode
  children: ReactNode
}

/** Sidebar + content (+ optional on-page TOC), the row every /docs page
 * composes below the shared DocsHeader. Edge-to-edge — the sidebar and TOC
 * rails sit flush against the true viewport edges (see their own sticky
 * full-height treatment), while the content column recenters itself in the
 * space between them rather than inheriting a page-wide centered cap. */
export function DocsShell({
  groups,
  activeSlug,
  toc,
  children,
}: DocsShellProps) {
  return (
    <div className="flex w-full min-w-0 items-stretch max-[900px]:flex-col">
      <DocsSidebar groups={groups} activeSlug={activeSlug} />
      <div className="flex min-w-0 flex-1 justify-center">
        <main
          // eslint-disable-next-line better-tailwindcss/no-restricted-classes -- preserves the content column's previous effective width (the old max-w-7xl shell cap minus the sidebar's 216px + the TOC's 188px), now centered explicitly since the rails no longer share that cap
          className="w-full min-w-0 max-w-[876px] px-10 py-8 max-[900px]:px-6"
        >
          {children}
        </main>
      </div>
      {toc}
    </div>
  )
}
