import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useBoundedPoll } from './use-bounded-poll'

/** A fully controllable fake timer: tests decide exactly when a "tick" fires, independent of real wall-clock time. */
function createFakeTimers() {
  let nextId = 1
  const pending = new Map<number, () => void>()
  const delays: number[] = []

  const setTimeoutFn = ((fn: () => void, delay?: number) => {
    const id = nextId++
    pending.set(id, fn)
    delays.push(delay ?? 0)
    return id as unknown as ReturnType<typeof setTimeout>
  }) as typeof setTimeout

  const clearTimeoutFn = ((id: unknown) => {
    pending.delete(id as number)
  }) as typeof clearTimeout

  async function flush() {
    const next = pending.entries().next()
    if (next.done) return false
    const [id, fn] = next.value
    pending.delete(id)
    await act(async () => {
      fn()
      // Let the hook's `Promise.resolve(callback()).then(...)` chain settle.
      await Promise.resolve()
      await Promise.resolve()
    })
    return true
  }

  return {
    setTimeoutFn,
    clearTimeoutFn,
    flush,
    pendingCount: () => pending.size,
    /** Delay passed to each `setTimeoutFn` call, in scheduling order. */
    delays,
  }
}

/** A fake `window` exposing only what the hook needs from it: a 'focus' listener. */
function createFakeWindow() {
  const listeners = new Set<() => void>()
  return {
    addEventListener: (
      _event: string,
      handler: EventListenerOrEventListenerObject,
    ) => {
      listeners.add(handler as () => void)
    },
    removeEventListener: (
      _event: string,
      handler: EventListenerOrEventListenerObject,
    ) => {
      listeners.delete(handler as () => void)
    },
    dispatchFocus() {
      for (const listener of listeners) listener()
    },
  }
}

function createFakeDocument(initialHidden = false) {
  let hidden = initialHidden
  const listeners = new Set<() => void>()
  return {
    get hidden() {
      return hidden
    },
    addEventListener: (
      _event: string,
      handler: EventListenerOrEventListenerObject,
    ) => {
      listeners.add(handler as () => void)
    },
    removeEventListener: (
      _event: string,
      handler: EventListenerOrEventListenerObject,
    ) => {
      listeners.delete(handler as () => void)
    },
    setHidden(next: boolean) {
      hidden = next
      for (const listener of listeners) listener()
    },
  }
}

describe('useBoundedPoll', () => {
  it('does nothing when disabled', () => {
    const timers = createFakeTimers()
    const callback = vi.fn()
    const { result } = renderHook(() =>
      useBoundedPoll(callback, false, {
        setTimeoutFn: timers.setTimeoutFn,
        clearTimeoutFn: timers.clearTimeoutFn,
      }),
    )
    expect(result.current.isPolling).toBe(false)
    expect(timers.pendingCount()).toBe(0)
    expect(callback).not.toHaveBeenCalled()
  })

  it('schedules and fires callback on each tick, counting attempts', async () => {
    const timers = createFakeTimers()
    const callback = vi.fn()
    const { result } = renderHook(() =>
      useBoundedPoll(callback, true, {
        setTimeoutFn: timers.setTimeoutFn,
        clearTimeoutFn: timers.clearTimeoutFn,
      }),
    )
    expect(result.current.isPolling).toBe(true)

    await timers.flush()
    expect(callback).toHaveBeenCalledTimes(1)
    expect(result.current.attempts).toBe(1)

    await timers.flush()
    expect(callback).toHaveBeenCalledTimes(2)
    expect(result.current.attempts).toBe(2)
  })

  it('drops to the long-tail interval once maxAttempts is reached, instead of stopping', async () => {
    const timers = createFakeTimers()
    const callback = vi.fn()
    // Hoisted so its identity is stable across renders — an inline array
    // literal here would be recreated on every `setAttempts`/`setIsPolling`
    // re-render and restart the whole schedule (see the option's own doc
    // comment on `intervalsMs`).
    const intervalsMs = [10, 20]
    const { result } = renderHook(() =>
      useBoundedPoll(callback, true, {
        intervalsMs,
        maxAttempts: 2,
        longTailIntervalMs: 999,
        setTimeoutFn: timers.setTimeoutFn,
        clearTimeoutFn: timers.clearTimeoutFn,
      }),
    )

    await timers.flush()
    await timers.flush()
    expect(callback).toHaveBeenCalledTimes(2)
    // Still scheduled, still polling — maxAttempts only changes the cadence.
    expect(result.current.isPolling).toBe(true)
    expect(timers.pendingCount()).toBe(1)
    expect(timers.delays.at(-1)).toBe(999)

    await timers.flush()
    expect(callback).toHaveBeenCalledTimes(3)
    expect(result.current.isPolling).toBe(true)
    expect(timers.delays.at(-1)).toBe(999)
  })

  it('pauses while the tab is hidden and never fires the callback', async () => {
    const timers = createFakeTimers()
    const fakeDocument = createFakeDocument(true)
    const callback = vi.fn()
    const { result } = renderHook(() =>
      useBoundedPoll(callback, true, {
        setTimeoutFn: timers.setTimeoutFn,
        clearTimeoutFn: timers.clearTimeoutFn,
        documentRef: fakeDocument,
      }),
    )

    expect(result.current.isPolling).toBe(false)
    expect(timers.pendingCount()).toBe(0)
    expect(callback).not.toHaveBeenCalled()
  })

  it('cancels a pending tick when the tab becomes hidden mid-countdown', () => {
    const timers = createFakeTimers()
    const fakeDocument = createFakeDocument(false)
    const callback = vi.fn()
    const { result } = renderHook(() =>
      useBoundedPoll(callback, true, {
        setTimeoutFn: timers.setTimeoutFn,
        clearTimeoutFn: timers.clearTimeoutFn,
        documentRef: fakeDocument,
      }),
    )

    expect(timers.pendingCount()).toBe(1)
    act(() => {
      fakeDocument.setHidden(true)
    })
    expect(timers.pendingCount()).toBe(0)
    expect(result.current.isPolling).toBe(false)
  })

  it('re-polls immediately (not on the normal schedule) once the tab becomes visible again', async () => {
    const timers = createFakeTimers()
    const fakeDocument = createFakeDocument(false)
    const callback = vi.fn()
    // A large first interval, hoisted for a stable identity (see above),
    // makes it obvious a regain doesn't just wait out (or restart) it.
    const intervalsMs = [50_000]
    const { result } = renderHook(() =>
      useBoundedPoll(callback, true, {
        intervalsMs,
        setTimeoutFn: timers.setTimeoutFn,
        clearTimeoutFn: timers.clearTimeoutFn,
        documentRef: fakeDocument,
      }),
    )

    act(() => {
      fakeDocument.setHidden(true)
    })
    expect(timers.pendingCount()).toBe(0)

    act(() => {
      fakeDocument.setHidden(false)
    })
    expect(timers.pendingCount()).toBe(1)
    expect(timers.delays.at(-1)).toBe(0)
    expect(result.current.isPolling).toBe(true)

    await timers.flush()
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('re-polls immediately when the window regains focus', async () => {
    const timers = createFakeTimers()
    const fakeDocument = createFakeDocument(false)
    const fakeWindow = createFakeWindow()
    const callback = vi.fn()
    const intervalsMs = [50_000]
    renderHook(() =>
      useBoundedPoll(callback, true, {
        intervalsMs,
        setTimeoutFn: timers.setTimeoutFn,
        clearTimeoutFn: timers.clearTimeoutFn,
        documentRef: fakeDocument,
        windowRef: fakeWindow,
      }),
    )

    expect(timers.pendingCount()).toBe(1)
    act(() => {
      fakeWindow.dispatchFocus()
    })
    expect(timers.pendingCount()).toBe(1)
    expect(timers.delays.at(-1)).toBe(0)

    await timers.flush()
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('only re-polls once when visibilitychange and focus both fire for the same regain', async () => {
    const timers = createFakeTimers()
    const fakeDocument = createFakeDocument(true)
    const fakeWindow = createFakeWindow()
    const callback = vi.fn()
    renderHook(() =>
      useBoundedPoll(callback, true, {
        setTimeoutFn: timers.setTimeoutFn,
        clearTimeoutFn: timers.clearTimeoutFn,
        documentRef: fakeDocument,
        windowRef: fakeWindow,
      }),
    )
    expect(timers.pendingCount()).toBe(0)

    act(() => {
      fakeDocument.setHidden(false)
      fakeWindow.dispatchFocus()
    })
    // Both events fired for one regain — exactly one immediate tick, not two.
    expect(timers.pendingCount()).toBe(1)

    await timers.flush()
    expect(callback).toHaveBeenCalledTimes(1)
    expect(timers.pendingCount()).toBe(1)
  })

  it('stops scheduling once disabled mid-flight', () => {
    const timers = createFakeTimers()
    const callback = vi.fn()
    const { result, rerender } = renderHook(
      ({ enabled }) =>
        useBoundedPoll(callback, enabled, {
          setTimeoutFn: timers.setTimeoutFn,
          clearTimeoutFn: timers.clearTimeoutFn,
        }),
      { initialProps: { enabled: true } },
    )

    expect(timers.pendingCount()).toBe(1)
    rerender({ enabled: false })
    expect(timers.pendingCount()).toBe(0)
    expect(result.current.isPolling).toBe(false)
  })
})
