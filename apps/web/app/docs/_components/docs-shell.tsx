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
 * composes below the shared DocsHeader. */
export function DocsShell({
  groups,
  activeSlug,
  toc,
  children,
}: DocsShellProps) {
  return (
    <div className="mx-auto flex w-full min-w-0 max-w-7xl items-stretch max-[900px]:flex-col">
      <DocsSidebar groups={groups} activeSlug={activeSlug} />
      <main className="min-w-0 flex-1 px-10 py-8 max-[900px]:px-6">
        {children}
      </main>
      {toc}
    </div>
  )
}
