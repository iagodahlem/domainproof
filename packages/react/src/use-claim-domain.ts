'use client'

import { useCallback, useState } from 'react'
import { claimComponentSession } from './client'
import { useDomainProofBaseUrl } from './provider'
import type { ClaimResult, DomainProofError } from './types'

export type UseClaimDomainStatus = 'idle' | 'claiming' | 'success' | 'error'

export interface UseClaimDomainOptions {
  /** Overrides `DomainProofProvider`'s `baseUrl` for this hook instance. */
  baseUrl?: string
}

export interface UseClaimDomainResult {
  status: UseClaimDomainStatus
  /** The spent session's claim, once `claim` succeeds — `null` before that, and again after `reset`. */
  data: ClaimResult | null
  error: DomainProofError | null
  /**
   * Spends the session to claim `domain` — same validation and
   * conflict/sandbox rules as the public API's `POST /v1/domains`. Resolves
   * to the {@link ClaimResult} on success (also reflected in `data`) or
   * `null` on failure (reflected in `error`) — a session is single-use, so
   * calling this again after either outcome re-hits an already-spent token
   * and 404s.
   */
  claim: (domain: string) => Promise<ClaimResult | null>
  reset: () => void
}

/**
 * Spends a component session (minted server-side via
 * `@domainproof/sdk`'s `componentSessions.create`) to claim one domain —
 * `POST /frontend/component-sessions/:sessionToken/claim`. `data.frontendToken`
 * is what {@link useVerification} needs from here on; `sessionToken` itself
 * is spent the moment `claim` resolves, successfully or not.
 */
export function useClaimDomain(
  sessionToken: string,
  options: UseClaimDomainOptions = {},
): UseClaimDomainResult {
  const baseUrl = useDomainProofBaseUrl(options.baseUrl)

  const [status, setStatus] = useState<UseClaimDomainStatus>('idle')
  const [data, setData] = useState<ClaimResult | null>(null)
  const [error, setError] = useState<DomainProofError | null>(null)

  const claim = useCallback(
    async (domain: string) => {
      setStatus('claiming')
      setError(null)
      const result = await claimComponentSession(baseUrl, sessionToken, domain)
      if (result.ok) {
        setData(result.data)
        setStatus('success')
        return result.data
      }
      setError(result.error)
      setStatus('error')
      return null
    },
    [baseUrl, sessionToken],
  )

  const reset = useCallback(() => {
    setStatus('idle')
    setData(null)
    setError(null)
  }, [])

  return { status, data, error, claim, reset }
}
