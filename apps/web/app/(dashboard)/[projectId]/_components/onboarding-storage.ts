'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { DomainStatus } from '@/lib/api/dashboard'

export type IntegrationPath = 'api' | 'hosted' | 'components' | 'agents'

const INTEGRATION_PATHS: readonly IntegrationPath[] = [
  'api',
  'hosted',
  'components',
  'agents',
]

const DEFAULT_PATH: IntegrationPath = 'api'

function isIntegrationPath(value: string | null): value is IntegrationPath {
  return (
    value !== null && (INTEGRATION_PATHS as readonly string[]).includes(value)
  )
}

function tabStorageKey(projectId: string): string {
  return `dp_onboarding_tab_${projectId}`
}

function collapsedStorageKey(projectId: string): string {
  return `dp_onboarding_collapsed_${projectId}`
}

/**
 * Which integration-path tab (API / hosted page / React components /
 * agents & CLI) the "First run" step last showed for this project —
 * persisted so a reload (or a trip to another route and back) doesn't
 * reset a builder back to the first tab. Same default-then-sync-from-
 * storage pattern as the theme/mode toggles: the lazy render always
 * starts on `DEFAULT_PATH` (SSR-safe), then an effect reads the stored
 * value once mounted.
 */
export function useOnboardingTab(
  projectId: string,
): [IntegrationPath, (path: IntegrationPath) => void] {
  const [path, setPathState] = useState<IntegrationPath>(DEFAULT_PATH)

  useEffect(() => {
    const stored = window.localStorage.getItem(tabStorageKey(projectId))
    if (isIntegrationPath(stored)) setPathState(stored)
  }, [projectId])

  function setPath(next: IntegrationPath) {
    setPathState(next)
    window.localStorage.setItem(tabStorageKey(projectId), next)
  }

  return [path, setPath]
}

/**
 * Whether the "Get started" checklist shows as the full card or the
 * collapsed strip. Defaults to `autoCollapse` (true once the required
 * steps are done — see `deriveChecklistProgress`), but a builder can
 * expand or collapse it by hand at any point, and that explicit choice is
 * what gets persisted from then on, overriding the data-derived default.
 */
export function useChecklistCollapsed(
  projectId: string,
  autoCollapse: boolean,
): [boolean, (next: boolean) => void] {
  const [override, setOverride] = useState<boolean | null>(null)

  useEffect(() => {
    const stored = window.localStorage.getItem(collapsedStorageKey(projectId))
    if (stored === 'true') setOverride(true)
    else if (stored === 'false') setOverride(false)
    else setOverride(null)
  }, [projectId])

  function setCollapsed(next: boolean) {
    setOverride(next)
    window.localStorage.setItem(collapsedStorageKey(projectId), String(next))
  }

  return [override ?? autoCollapse, setCollapsed]
}

/**
 * The "Get started" checklist's done/current state is derived server-side
 * (`deriveChecklistProgress`, computed in `page.tsx` and handed down as a
 * prop) — a client-only poll noticing a domain reach `verified` has no
 * other way to tell that computation to re-run. `router.refresh()` re-runs
 * the server component tree on the current route without discarding this
 * client tree's state (tab selection, claimed-domain state), so the
 * checklist advances — and, once both required steps are done, collapses —
 * without the visitor needing to reload by hand. Fires once per
 * newly-observed `verified` status, not on every render a poll happens to
 * still see it.
 */
export function useRefreshOnVerified(status: DomainStatus | undefined): void {
  const router = useRouter()
  const firedRef = useRef(false)

  useEffect(() => {
    if (status === 'verified' && !firedRef.current) {
      firedRef.current = true
      router.refresh()
    }
  }, [status, router])
}
