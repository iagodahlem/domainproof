import { describe, expect, it } from 'vitest'
import { withTimeout } from './timeout'

describe('withTimeout', () => {
  it('resolves with the wrapped value when it settles in time', async () => {
    await expect(withTimeout(Promise.resolve('ok'), 100)).resolves.toBe('ok')
  })

  it('rejects with the original error when it rejects in time', async () => {
    await expect(
      withTimeout(Promise.reject(new Error('boom')), 100),
    ).rejects.toThrow('boom')
  })

  it('rejects with a timeout error when the promise never settles', async () => {
    const neverSettles = new Promise<never>(() => undefined)
    await expect(withTimeout(neverSettles, 5)).rejects.toThrow('timed out')
  })
})
