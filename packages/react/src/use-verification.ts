'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { checkVerification, fetchVerification } from './client'
import type { FetchResult } from './client'
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
 * An initial passive read establishes the current status; from there, an
 * embedded end-user must never depend on the api's own (much slower)
 * background recheck scheduler to see progress, so this hook drives its
 * own checks instead of just re-reading — an optimistic first check the
 * moment that initial read comes back non-terminal, then a real check
 * (not a passive read) on every bounded-backoff poll tick while still
 * pending, the same active-checking shape the dashboard's domain detail
 * page and onboarding walkthrough already use. Polling stops once
 * `status` reaches a terminal state (`verified`/`failed`); `verify()`
 * remains as an escape hatch for an explicit "check now" action.
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

  // Fires exactly once per token — reset alongside the rest of this hook's
  // state whenever `token` changes (see the mount/reset effect below).
  const optimisticCheckRequested = useRef(false)

  const applyResult = useCallback(
    (result: FetchResult<Verification>) => {
      if (tokenRef.current !== token) return
      if (result.ok) {
        setVerification(result.data)
        setStatus('success')
        setError(null)
      } else {
        setStatus('error')
        setError(result.error)
      }
    },
    [token],
  )

  const load = useCallback(async () => {
    if (!token) return
    applyResult(await fetchVerification(baseUrl, token))
  }, [baseUrl, token, applyResult])

  /**
   * Runs the actual DNS check rather than a passive status read — used for
   * both the optimistic first check and every subsequent poll tick, so a
   * claim only ever sits unchanged for as long as the check itself takes,
   * not until the api's background scheduler gets around to it. The check
   * route is rate limited per token (1 per 15s); a 429 here means an
   * optimistic or overlapping check already spent this tick's window, so
   * this tick just falls back to a plain status read instead of surfacing
   * the rate limit as an error.
   */
  const runCheck = useCallback(async () => {
    if (!token) return
    const result = await checkVerification(baseUrl, token)
    if (
      !result.ok &&
      result.error.kind === 'http' &&
      result.error.status === 429
    ) {
      applyResult(await fetchVerification(baseUrl, token))
      return
    }
    applyResult(result)
  }, [baseUrl, token, applyResult])

  useEffect(() => {
    optimisticCheckRequested.current = false
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

  // Optimistic first check: the initial read above is passive, so a still-
  // pending claim would otherwise sit unchanged until either the poll
  // loop's own first tick or the api's slow background scheduler — run one
  // real check as soon as that initial read confirms there's something to
  // check. Gated on `autoPoll` the same as the poll loop below — `autoPoll:
  // false` means "fetch once and rely on verify() alone," and this counts
  // as auto-driven checking. `optimisticCheckRequested` re-fires this at
  // most once per token, regardless of how many times `verification`
  // itself updates afterward (every poll tick replaces it with a new
  // object).
  useEffect(() => {
    if (
      !autoPoll ||
      !token ||
      !verification ||
      optimisticCheckRequested.current ||
      TERMINAL_STATUSES.has(verification.status)
    ) {
      return
    }
    optimisticCheckRequested.current = true
    void runCheck()
  }, [autoPoll, token, verification, runCheck])

  const shouldPoll =
    autoPoll &&
    token !== null &&
    verification !== null &&
    !TERMINAL_STATUSES.has(verification.status)

  const { isPolling } = useBoundedPoll(runCheck, shouldPoll, {
    intervalsMs,
    maxAttempts,
  })

  const verify = useCallback(async () => {
    if (!token) return
    setIsVerifying(true)
    applyResult(await checkVerification(baseUrl, token))
    setIsVerifying(false)
  }, [baseUrl, token, applyResult])

  return { verification, status, error, isPolling, isVerifying, verify }
}
