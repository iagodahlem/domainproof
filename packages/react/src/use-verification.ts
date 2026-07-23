'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { checkVerification, fetchVerification } from './client'
import { useDomainProofBaseUrl } from './provider'
import { useBoundedPoll } from './use-bounded-poll'
import type { DomainProofError, Verification } from './types'

/** No further status change is possible without external action this hook can't take on its own (the project regenerating the challenge) — polling stops here. */
const TERMINAL_STATUSES = new Set<Verification['status']>([
  'verified',
  'failed',
])

export type UseVerificationFetchStatus =
  'idle' | 'loading' | 'success' | 'error'

export interface UseVerificationOptions {
  /** Overrides `DomainProofProvider`'s `baseUrl` for this hook instance. */
  baseUrl?: string
  /** Auto-poll while the status isn't terminal. Defaults to `true` — set `false` to fetch once and rely on `verify()` alone. */
  autoPoll?: boolean
  /** Forwarded to the underlying backoff scheduler — see `useBoundedPoll`. */
  intervalsMs?: readonly number[]
  maxAttempts?: number
}

export interface UseVerificationResult {
  verification: Verification | null
  /** Tracks the initial read and every background poll tick — not `verify()`, which has its own `isVerifying` flag. */
  status: UseVerificationFetchStatus
  error: DomainProofError | null
  /** Whether a background poll is currently scheduled — surface this as a subtle "checking automatically…" indicator. */
  isPolling: boolean
  /** Whether a manual `verify()` call is in flight. */
  isVerifying: boolean
  /** Runs the DNS check immediately (`POST /frontend/verifications/:token/check`) instead of waiting for the next poll tick. Rate limited by the API: 1 per 15s, 20 per hour, per token. */
  verify: () => Promise<void>
}

/**
 * Reads, and by default polls, one domain claim's verification status by
 * its `frontendToken` — pass `null` before a claim exists (e.g. before
 * {@link useClaimDomain}'s `claim` resolves) and this hook does nothing.
 * Mirrors the hosted verification page's own pattern: an initial read,
 * then bounded backoff polling that stops once `status` reaches a terminal
 * state (`verified`/`failed`), plus a `verify()` escape hatch for an
 * explicit "check now" action.
 */
export function useVerification(
  token: string | null,
  options: UseVerificationOptions = {},
): UseVerificationResult {
  const { autoPoll = true, intervalsMs, maxAttempts } = options
  const baseUrl = useDomainProofBaseUrl(options.baseUrl)

  const [verification, setVerification] = useState<Verification | null>(null)
  const [status, setStatus] = useState<UseVerificationFetchStatus>('idle')
  const [error, setError] = useState<DomainProofError | null>(null)
  const [isVerifying, setIsVerifying] = useState(false)

  // Guards against a response for a since-changed `token` overwriting this
  // hook's state — the effect below already resets everything on a token
  // change, but a fetch that was already in flight when it changed would
  // otherwise land after and clobber that reset.
  const tokenRef = useRef(token)
  tokenRef.current = token

  const load = useCallback(async () => {
    if (!token) return
    const result = await fetchVerification(baseUrl, token)
    if (tokenRef.current !== token) return
    if (result.ok) {
      setVerification(result.data)
      setStatus('success')
      setError(null)
    } else {
      setStatus('error')
      setError(result.error)
    }
  }, [baseUrl, token])

  useEffect(() => {
    if (!token) {
      setVerification(null)
      setStatus('idle')
      setError(null)
      setIsVerifying(false)
      return
    }
    setStatus('loading')
    setIsVerifying(false)
    void load()
  }, [token, load])

  const shouldPoll =
    autoPoll &&
    token !== null &&
    verification !== null &&
    !TERMINAL_STATUSES.has(verification.status)

  const { isPolling } = useBoundedPoll(load, shouldPoll, {
    intervalsMs,
    maxAttempts,
  })

  const verify = useCallback(async () => {
    if (!token) return
    setIsVerifying(true)
    const result = await checkVerification(baseUrl, token)
    if (tokenRef.current === token) {
      if (result.ok) {
        setVerification(result.data)
        setStatus('success')
        setError(null)
      } else {
        setStatus('error')
        setError(result.error)
      }
    }
    setIsVerifying(false)
  }, [baseUrl, token])

  return { verification, status, error, isPolling, isVerifying, verify }
}
