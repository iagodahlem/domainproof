'use client'

import { useEffect, useState } from 'react'
import { cn } from '@domainproof/ui'
import type { TocEntry } from '../_lib/slug'

export interface DocsTocProps {
  entries: TocEntry[]
}

/**
 * A static right rail with the same type scale and active-state recipe
 * (accent text + accent left-border) as the sidebar nav — the two "current
 * location" indicators read as one family rather than two competing ones.
 * Hidden below 1000px, same as board-docs.html's .docs-toc.
 */
export function DocsToc({ entries }: DocsTocProps) {
  const [activeId, setActiveId] = useState(entries[0]?.id)

  useEffect(() => {
    if (entries.length === 0) return
    const observer = new IntersectionObserver(
      (observed) => {
        const visible = observed.find((entry) => entry.isIntersecting)
        if (visible) setActiveId(visible.target.id)
      },
      { rootMargin: '-96px 0px -70% 0px', threshold: 0 },
    )
    const elements = entries
      .map((entry) => document.getElementById(entry.id))
      .filter((element): element is HTMLElement => element != null)
    elements.forEach((element) => observer.observe(element))
    return () => observer.disconnect()
  }, [entries])

  if (entries.length === 0) return null

  return (
    <nav
      aria-label="On this page"
      // eslint-disable-next-line better-tailwindcss/no-restricted-classes -- w-[188px] matches board-docs.html's .docs-toc width (no spacing/width token this specific); h-[calc(100vh-4rem)]/top-16 pin the rail below the 4rem-tall sticky Header (its min-h-16), same treatment as the sidebar, so it stays put instead of scrolling away with the content
      className="sticky top-16 h-[calc(100vh-4rem)] w-[188px] flex-shrink-0 overflow-y-auto border-l border-border px-5 py-8 max-[1000px]:hidden"
    >
      <div className="mb-3 font-mono text-2xs font-semibold tracking-label text-faint-foreground uppercase">
        On this page
      </div>
      <div className="flex flex-col gap-0.5">
        {entries.map((entry) => (
          <a
            key={entry.id}
            href={`#${entry.id}`}
            className={cn(
              // font-weight stays fixed across active/inactive (only the
              // border + text color shift) — the reference page's endpoint
              // entries are long enough to wrap, and a weight change would
              // reflow them onto a different number of lines on selection,
              // same bug docs-sidebar.tsx's active state had.
              'block border-l-2 border-transparent py-1 pl-3 text-xs leading-caption text-muted-foreground transition-colors duration-150 hover:text-foreground',
              entry.id === activeId && 'border-accent text-accent',
            )}
          >
            {entry.text}
          </a>
        ))}
      </div>
    </nav>
  )
}
