'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Mirrored from the hosted verification page's own
 * `app/verify/[token]/_lib/use-bounded-poll.ts` — can't import a
 * route-private module across routes (same reasoning as
 * `lib/query/domains.ts`'s mirrored `POLL_INTERVALS_MS`), so the scheduler
 * itself is duplicated here rather than shared. Drives this page's active
 * auto-verify while a domain is `pending` (see `domain-detail-client.tsx`):
 * quick at first (DNS often propagates in seconds against the sandbox,
 * minutes against real providers), settling at a steady 30s so a long-lived
 * tab doesn't hammer the api. The last entry repeats once exhausted.
 */
export const DEFAULT_INTERVALS_MS = [
  3_000, 5_000, 8_000, 13_000, 20_000, 30_000,
] as const

/** ~20 minutes at the steady 30s rung — long enough for a real demo session, bounded so an abandoned tab doesn't poll forever. */
const DEFAULT_MAX_ATTEMPTS = 40

export interface UseBoundedPollOptions {
  /** Backoff ladder in ms. Pass a stable reference (module-level or memoized) — a new array identity every render restarts the schedule. */
  intervalsMs?: readonly number[]
  /** Hard cap on how many times `callback` fires before polling stops for good. */
  maxAttempts?: number
  /** Injected for deterministic tests. Defaults to the global timer functions. */
  setTimeoutFn?: typeof setTimeout
  clearTimeoutFn?: typeof clearTimeout
  /** Injected for deterministic tests. Defaults to `globalThis.document` (`undefined` during SSR, which never counts as hidden). */
  documentRef?: Pick<
    Document,
    'hidden' | 'addEventListener' | 'removeEventListener'
  >
}

export interface UseBoundedPollResult {
  /** How many times `callback` has fired so far. */
  attempts: number
  /** Whether a future tick is currently scheduled — `false` once paused (tab hidden) or stopped (`maxAttempts` reached, or `enabled` is `false`). */
  isPolling: boolean
}

/**
 * Bounded, backoff, visibility-aware polling: calls `callback` on the
 * schedule above while `enabled` is `true`, pausing while the tab is
 * hidden and resuming the moment it's visible again, and stopping for good
 * once `maxAttempts` fires. Deliberately just a scheduler — it has no
 * opinion on what `callback` does (fetch, update state, whatever the
 * caller needs); that split keeps this hook testable with a fake callback
 * and injected fake timers, independent of any real network call.
 */
export function useBoundedPoll(
  callback: () => void | Promise<void>,
  enabled: boolean,
  options: UseBoundedPollOptions = {},
): UseBoundedPollResult {
  const {
    intervalsMs = DEFAULT_INTERVALS_MS,
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
    setTimeoutFn = setTimeout,
    clearTimeoutFn = clearTimeout,
    documentRef = typeof document === 'undefined' ? undefined : document,
  } = options

  const callbackRef = useRef(callback)
  callbackRef.current = callback

  const [attempts, setAttempts] = useState(0)
  const [isPolling, setIsPolling] = useState(false)

  useEffect(() => {
    if (!enabled) {
      setIsPolling(false)
      return
    }

    let cancelled = false
    let attemptCount = 0
    let timeoutId: ReturnType<typeof setTimeout> | undefined

    function delayForAttempt(count: number): number {
      const index = Math.min(count, intervalsMs.length - 1)
      return intervalsMs[index] ?? 0
    }

    function scheduleNext() {
      if (cancelled || attemptCount >= maxAttempts || documentRef?.hidden) {
        setIsPolling(false)
        return
      }
      setIsPolling(true)
      timeoutId = setTimeoutFn(() => {
        timeoutId = undefined
        if (cancelled) return
        attemptCount += 1
        setAttempts(attemptCount)
        void Promise.resolve(callbackRef.current()).then(() => {
          if (!cancelled) scheduleNext()
        })
      }, delayForAttempt(attemptCount))
    }

    function handleVisibilityChange() {
      if (documentRef?.hidden) {
        if (timeoutId !== undefined) {
          clearTimeoutFn(timeoutId)
          timeoutId = undefined
        }
        setIsPolling(false)
      } else if (timeoutId === undefined) {
        scheduleNext()
      }
    }

    documentRef?.addEventListener('visibilitychange', handleVisibilityChange)
    scheduleNext()

    return () => {
      cancelled = true
      if (timeoutId !== undefined) clearTimeoutFn(timeoutId)
      documentRef?.removeEventListener(
        'visibilitychange',
        handleVisibilityChange,
      )
    }
  }, [
    enabled,
    intervalsMs,
    maxAttempts,
    setTimeoutFn,
    clearTimeoutFn,
    documentRef,
  ])

  return { attempts, isPolling }
}
