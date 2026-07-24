'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Escalating backoff: quick at first (DNS often propagates in seconds
 * against the `.test` sandbox, minutes against real providers), settling
 * at a steady 30s so a long-lived tab doesn't hammer the API. The last
 * entry repeats once exhausted.
 */
const DEFAULT_INTERVALS_MS = [
  3_000, 5_000, 8_000, 13_000, 20_000, 30_000,
] as const

/** How many ticks run on the ladder above before dropping to the long-tail cadence. */
const DEFAULT_MAX_ATTEMPTS = 40

/**
 * Cadence once `maxAttempts` ticks on the ladder above have fired. A real
 * DNS provider can easily outlast the ladder's ~20 minutes, so polling
 * never stops on its own past this point — it just gets slow enough that a
 * forgotten tab isn't hammering the API. Only a terminal status (via the
 * caller's `enabled` flag) actually stops it.
 */
const DEFAULT_LONG_TAIL_INTERVAL_MS = 60_000

export interface UseBoundedPollOptions {
  /** Backoff ladder in ms. Pass a stable reference (module-level or memoized) — a new array identity every render restarts the schedule. */
  intervalsMs?: readonly number[]
  /** How many ticks run on `intervalsMs` before dropping to `longTailIntervalMs`. */
  maxAttempts?: number
  /** Cadence used once `maxAttempts` ticks have fired — polling then continues indefinitely at this rate (while `enabled`) rather than stopping. */
  longTailIntervalMs?: number
  /** Injected for deterministic tests. Defaults to the global timer functions. */
  setTimeoutFn?: typeof setTimeout
  clearTimeoutFn?: typeof clearTimeout
  /** Injected for deterministic tests. Defaults to `globalThis.document` (`undefined` during SSR, which never counts as hidden). */
  documentRef?: Pick<
    Document,
    'hidden' | 'addEventListener' | 'removeEventListener'
  >
  /** Injected for deterministic tests. Defaults to `globalThis.window` (`undefined` during SSR). Only used for a 'focus' listener — some browsers (notably Safari) don't fire `visibilitychange` as reliably as `focus` when a tab regains attention. */
  windowRef?: Pick<Window, 'addEventListener' | 'removeEventListener'>
}

export interface UseBoundedPollResult {
  /** How many times `callback` has fired so far. */
  attempts: number
  /** Whether a future tick is currently scheduled — `false` once paused (tab hidden) or `enabled` is `false`. Past `maxAttempts` this stays `true`: polling degrades to the long tail rather than stopping. */
  isPolling: boolean
}

/**
 * Bounded, backoff, visibility-aware polling: calls `callback` on the
 * schedule above while `enabled` is `true`, pausing while the tab is
 * hidden and resuming — with an immediate tick, not just picking the
 * normal schedule back up — the moment it's visible or focused again.
 * Past `maxAttempts` it never stops on its own: it just settles onto a
 * slow long-tail cadence, so a claim that's still pending keeps getting
 * checked instead of going deaf. Deliberately just a scheduler — it has no
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
    longTailIntervalMs = DEFAULT_LONG_TAIL_INTERVAL_MS,
    setTimeoutFn = setTimeout,
    clearTimeoutFn = clearTimeout,
    documentRef = typeof document === 'undefined' ? undefined : document,
    windowRef = typeof window === 'undefined' ? undefined : window,
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
    // Guards against `visibilitychange` and `focus` both firing for the
    // same regain (the common case when switching back to a tab) and
    // scheduling two immediate ticks instead of one. Cleared on the next
    // microtask, well before either event's real-world successor could fire.
    let regainInFlight = false

    function delayForAttempt(count: number): number {
      if (count >= maxAttempts) return longTailIntervalMs
      const index = Math.min(count, intervalsMs.length - 1)
      return intervalsMs[index] ?? 0
    }

    function runTick() {
      timeoutId = undefined
      if (cancelled) return
      attemptCount += 1
      setAttempts(attemptCount)
      void Promise.resolve(callbackRef.current()).then(() => {
        if (!cancelled) scheduleNext()
      })
    }

    function scheduleNext() {
      if (cancelled || documentRef?.hidden) {
        setIsPolling(false)
        return
      }
      setIsPolling(true)
      timeoutId = setTimeoutFn(runTick, delayForAttempt(attemptCount))
    }

    /** Re-checks right away instead of waiting out whatever's left of the current tick's delay — a tab that regains attention shouldn't sit on stale status until the schedule catches up on its own. */
    function regain() {
      if (cancelled || documentRef?.hidden || regainInFlight) return
      regainInFlight = true
      Promise.resolve().then(() => {
        regainInFlight = false
      })
      if (timeoutId !== undefined) {
        clearTimeoutFn(timeoutId)
        timeoutId = undefined
      }
      setIsPolling(true)
      timeoutId = setTimeoutFn(runTick, 0)
    }

    function handleVisibilityChange() {
      if (documentRef?.hidden) {
        if (timeoutId !== undefined) {
          clearTimeoutFn(timeoutId)
          timeoutId = undefined
        }
        setIsPolling(false)
        return
      }
      regain()
    }

    function handleWindowFocus() {
      if (documentRef?.hidden) return
      regain()
    }

    documentRef?.addEventListener('visibilitychange', handleVisibilityChange)
    windowRef?.addEventListener('focus', handleWindowFocus)
    scheduleNext()

    return () => {
      cancelled = true
      if (timeoutId !== undefined) clearTimeoutFn(timeoutId)
      documentRef?.removeEventListener(
        'visibilitychange',
        handleVisibilityChange,
      )
      windowRef?.removeEventListener('focus', handleWindowFocus)
    }
  }, [
    enabled,
    intervalsMs,
    maxAttempts,
    longTailIntervalMs,
    setTimeoutFn,
    clearTimeoutFn,
    documentRef,
    windowRef,
  ])

  return { attempts, isPolling }
}
