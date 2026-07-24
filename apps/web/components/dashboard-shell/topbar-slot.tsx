'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import type { Dispatch, ReactNode, SetStateAction } from 'react'

export interface TopbarBackLink {
  href: string
  label: string
}

export interface TopbarSlotContent {
  /** Overrides the route-derived nav title (e.g. a domain's own hostname on its detail page). */
  title?: ReactNode
  /** Renders a back chevron left of the title, linking to `href`. */
  back?: TopbarBackLink
  /** The page's own primary action button, rendered right of the mode toggle. */
  action?: ReactNode
  /** Opts this page out of the dashboard-wide mode toggle even though its route matches `MODE_TOGGLE_SEGMENTS` — e.g. a domain's own detail page, where the mode is a fixed fact about that domain (shown in its meta rail) rather than something to switch. */
  hideModeToggle?: boolean
}

// Split into two contexts rather than one `{ content, setContent }` value:
// `setContent` (from `useState`) is referentially stable across renders, but
// `content` itself changes every time a page registers something. A page
// calling `useTopbarSlot` only ever needs the setter — if it read `content`
// too (a single combined context would force that), every registration
// would re-render the page itself, re-run its effect, and register again:
// an infinite loop. Only `Topbar` needs to react to `content` changing.
const TopbarSlotSetterContext = createContext<Dispatch<
  SetStateAction<TopbarSlotContent | null>
> | null>(null)
const TopbarSlotContentContext = createContext<TopbarSlotContent | null>(null)

/**
 * Mounted once by `ShellBody`, alongside `ModeProvider` — the channel a page
 * pushes its title/back-link/action into the shell's `Topbar` through,
 * without the shell importing anything page-specific (ARCHITECTURE.md's
 * "slots, not page-specific hacks").
 */
export function TopbarSlotProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<TopbarSlotContent | null>(null)
  return (
    <TopbarSlotSetterContext.Provider value={setContent}>
      <TopbarSlotContentContext.Provider value={content}>
        {children}
      </TopbarSlotContentContext.Provider>
    </TopbarSlotSetterContext.Provider>
  )
}

/** `Topbar`'s own read side — the current page's registered override, if any. */
export function useTopbarSlotContent(): TopbarSlotContent | null {
  return useContext(TopbarSlotContentContext)
}

/**
 * A page registers its title/back-link/action here for as long as it stays
 * mounted, and it's cleared automatically on unmount — so navigating away
 * (or a page that never calls this at all) always falls back to `Topbar`'s
 * own route-derived default.
 */
export function useTopbarSlot(content: TopbarSlotContent): void {
  const setContent = useContext(TopbarSlotSetterContext)
  if (!setContent) {
    throw new Error('useTopbarSlot must be used within a TopbarSlotProvider')
  }

  useEffect(() => {
    setContent(content)
    return () => setContent(null)
  })
}
