'use client'

import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import { DEFAULT_BASE_URL } from './client'

const BaseUrlContext = createContext<string | undefined>(undefined)

export interface DomainProofProviderProps {
  /** Override the Frontend API host every hook in this tree talks to — defaults to production. Point it at your local API during development, e.g. `http://localhost:3001` (where every plane runs on one origin). */
  baseUrl?: string
  children: ReactNode
}

/**
 * Optional — every hook falls back to the production Frontend API on its
 * own, so this is only needed to point a whole tree at a non-production
 * host (local dev, staging) without threading `baseUrl` through every hook
 * call. A hook's own `baseUrl` option, if passed, still wins over this.
 */
export function DomainProofProvider({
  baseUrl,
  children,
}: DomainProofProviderProps) {
  return (
    <BaseUrlContext.Provider value={baseUrl}>{children}</BaseUrlContext.Provider>
  )
}

/** Resolution order: a hook's own `baseUrl` option, then `DomainProofProvider`'s, then the production default. */
export function useDomainProofBaseUrl(override?: string): string {
  const fromProvider = useContext(BaseUrlContext)
  return override ?? fromProvider ?? DEFAULT_BASE_URL
}
