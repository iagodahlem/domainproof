import Link from 'next/link'
import { cn } from '@domainproof/ui'
import type { DocsNavGroup } from '../_lib/content'

export interface DocsSidebarProps {
  groups: DocsNavGroup[]
  activeSlug?: string
}

/**
 * Extends the dashboard Sidebar's link-list idiom (active = accent-soft bg +
 * accent text) into a docs-specific tree grouped under section labels — no
 * icons, since 15+ doc rows across 4 groups don't suit them the way the
 * dashboard's 4 top-level items do (see board-docs.html's design notes).
 *
 * Below 900px — the same breakpoint the board eases .docs-content padding
 * at — the vertical grouped tree gives way to a flat horizontally-scrolling
 * strip (the board's own .navlinks idiom, applied to doc links instead of
 * section anchors), mirroring how the real dashboard Sidebar swaps its own
 * layout at a breakpoint rather than hiding navigation on small screens.
 */
export function DocsSidebar({ groups, activeSlug }: DocsSidebarProps) {
  return (
    <>
      <nav
        aria-label="Docs"
        // eslint-disable-next-line better-tailwindcss/no-restricted-classes -- w-[216px] matches board-docs.html's .docs-sidebar width (no spacing/width token this specific); h-[calc(100vh-4rem)]/top-16 pin the rail below the 4rem-tall sticky Header (its min-h-16) so it fills the remaining viewport height and scrolls independently of the page
        className="sticky top-16 h-[calc(100vh-4rem)] w-[216px] flex-shrink-0 overflow-y-auto border-r border-border bg-surface px-4 py-6 max-[900px]:hidden"
      >
        {groups.map((group) => (
          <div key={group.section} className="mb-6 last:mb-0">
            <div className="mb-2 px-3 font-mono text-2xs font-semibold tracking-label text-faint-foreground uppercase">
              {group.section}
            </div>
            <div className="flex flex-col gap-0.5">
              {group.docs.map((doc) => (
                <DocsNavLink
                  key={doc.slug}
                  slug={doc.slug}
                  title={doc.title}
                  active={doc.slug === activeSlug}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <nav
        aria-label="Docs"
        className="hidden min-w-0 gap-1 overflow-x-auto border-b border-border bg-surface px-4 py-3 max-[900px]:flex [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {groups
          .flatMap((group) => group.docs)
          .map((doc) => (
            <DocsNavLink
              key={doc.slug}
              slug={doc.slug}
              title={doc.title}
              active={doc.slug === activeSlug}
              className="whitespace-nowrap"
            />
          ))}
      </nav>
    </>
  )
}

function DocsNavLink({
  slug,
  title,
  active,
  className,
}: {
  slug: string
  title: string
  active: boolean
  className?: string
}) {
  return (
    <Link
      href={`/docs/${slug}`}
      aria-current={active ? 'page' : undefined}
      className={cn(
        // font-weight stays fixed across active/inactive (only color + bg
        // shift) so selecting an item never changes its text metrics and
        // reflows it onto more lines — see docs-toc.tsx's identical note.
        'rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:bg-surface-2 hover:text-foreground',
        active &&
          'bg-accent-soft text-accent hover:bg-accent-soft hover:text-accent',
        className,
      )}
    >
      {title}
    </Link>
  )
}
