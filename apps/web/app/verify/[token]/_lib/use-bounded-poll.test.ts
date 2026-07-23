import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useBoundedPoll } from './use-bounded-poll'

/** A fully controllable fake timer: tests decide exactly when a "tick" fires, independent of real wall-clock time. */
function createFakeTimers() {
  let nextId = 1
  const pending = new Map<number, () => void>()

  const setTimeoutFn = ((fn: () => void) => {
    const id = nextId++
    pending.set(id, fn)
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

  it('stops for good once maxAttempts is reached', async () => {
    const timers = createFakeTimers()
    const callback = vi.fn()
    const { result } = renderHook(() =>
      useBoundedPoll(callback, true, {
        maxAttempts: 2,
        setTimeoutFn: timers.setTimeoutFn,
        clearTimeoutFn: timers.clearTimeoutFn,
      }),
    )

    await timers.flush()
    await timers.flush()
    expect(callback).toHaveBeenCalledTimes(2)
    expect(result.current.isPolling).toBe(false)
    expect(timers.pendingCount()).toBe(0)
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

  it('resumes polling as soon as the tab becomes visible again', async () => {
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

    act(() => {
      fakeDocument.setHidden(true)
    })
    expect(timers.pendingCount()).toBe(0)

    act(() => {
      fakeDocument.setHidden(false)
    })
    expect(timers.pendingCount()).toBe(1)
    expect(result.current.isPolling).toBe(true)

    await timers.flush()
    expect(callback).toHaveBeenCalledTimes(1)
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
