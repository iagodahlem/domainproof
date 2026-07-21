import { describe, expect, it } from 'vitest'
import {
  computeRecheckSchedule,
  firstPendingCheckAt,
  GRACE_WINDOW_MS,
} from './recheck-schedule'

const HOUR = 60 * 60 * 1000
const MINUTE = 60 * 1000
const checkedAt = new Date('2026-01-01T00:00:00.000Z')

describe('firstPendingCheckAt', () => {
  it('schedules the first check 1 minute after claim', () => {
    const claimedAt = new Date('2026-01-01T00:00:00.000Z')
    expect(firstPendingCheckAt(claimedAt).getTime()).toBe(
      claimedAt.getTime() + MINUTE,
    )
  })
})

describe('computeRecheckSchedule', () => {
  describe('pending backoff ladder', () => {
    it('rung 0 -> 1: still pending after the first check schedules +5m', () => {
      const result = computeRecheckSchedule({
        previousStatus: 'pending',
        nextStatus: 'pending',
        checkedAt,
        previousCheckAttempts: 0,
      })
      expect(result.checkAttempts).toBe(1)
      expect(result.nextCheckAt?.getTime()).toBe(
        checkedAt.getTime() + 5 * MINUTE,
      )
    })

    it('rung 1 -> 2: schedules +15m', () => {
      const result = computeRecheckSchedule({
        previousStatus: 'pending',
        nextStatus: 'pending',
        checkedAt,
        previousCheckAttempts: 1,
      })
      expect(result.checkAttempts).toBe(2)
      expect(result.nextCheckAt?.getTime()).toBe(
        checkedAt.getTime() + 15 * MINUTE,
      )
    })

    it('rung 2 -> 3: schedules +1h', () => {
      const result = computeRecheckSchedule({
        previousStatus: 'pending',
        nextStatus: 'pending',
        checkedAt,
        previousCheckAttempts: 2,
      })
      expect(result.checkAttempts).toBe(3)
      expect(result.nextCheckAt?.getTime()).toBe(checkedAt.getTime() + HOUR)
    })

    it('rung 3 -> 4: schedules +6h', () => {
      const result = computeRecheckSchedule({
        previousStatus: 'pending',
        nextStatus: 'pending',
        checkedAt,
        previousCheckAttempts: 3,
      })
      expect(result.checkAttempts).toBe(4)
      expect(result.nextCheckAt?.getTime()).toBe(checkedAt.getTime() + 6 * HOUR)
    })

    it('caps at +6h beyond rung 4', () => {
      const result = computeRecheckSchedule({
        previousStatus: 'pending',
        nextStatus: 'pending',
        checkedAt,
        previousCheckAttempts: 40,
      })
      expect(result.checkAttempts).toBe(41)
      expect(result.nextCheckAt?.getTime()).toBe(checkedAt.getTime() + 6 * HOUR)
    })

    it('does not touch graceExpiresAt while still pending', () => {
      const result = computeRecheckSchedule({
        previousStatus: 'pending',
        nextStatus: 'pending',
        checkedAt,
        previousCheckAttempts: 0,
      })
      expect(result.graceExpiresAt).toBeUndefined()
    })
  })

  it('pending -> verified: schedules the 24h continuous recheck and resets checkAttempts', () => {
    const result = computeRecheckSchedule({
      previousStatus: 'pending',
      nextStatus: 'verified',
      checkedAt,
      previousCheckAttempts: 3,
    })
    expect(result.checkAttempts).toBe(0)
    expect(result.nextCheckAt?.getTime()).toBe(checkedAt.getTime() + 24 * HOUR)
    expect(result.graceExpiresAt).toBeUndefined()
  })

  it('pending -> failed (challenge expiry): clears the schedule (no more automatic checks)', () => {
    const result = computeRecheckSchedule({
      previousStatus: 'pending',
      nextStatus: 'failed',
      checkedAt,
      previousCheckAttempts: 5,
    })
    expect(result.checkAttempts).toBe(0)
    expect(result.nextCheckAt).toBeNull()
    expect(result.graceExpiresAt).toBeUndefined()
  })

  it('verified stays verified: schedules another 24h out', () => {
    const result = computeRecheckSchedule({
      previousStatus: 'verified',
      nextStatus: 'verified',
      checkedAt,
      previousCheckAttempts: 0,
    })
    expect(result.nextCheckAt?.getTime()).toBe(checkedAt.getTime() + 24 * HOUR)
  })

  it('verified -> temporarily_failed: opens the 72h grace window and schedules a 15m recheck', () => {
    const result = computeRecheckSchedule({
      previousStatus: 'verified',
      nextStatus: 'temporarily_failed',
      checkedAt,
      previousCheckAttempts: 0,
    })
    expect(result.nextCheckAt?.getTime()).toBe(
      checkedAt.getTime() + 15 * MINUTE,
    )
    expect(result.graceExpiresAt?.getTime()).toBe(
      checkedAt.getTime() + GRACE_WINDOW_MS,
    )
  })

  it('temporarily_failed stays temporarily_failed: reschedules +15m but leaves graceExpiresAt untouched', () => {
    const result = computeRecheckSchedule({
      previousStatus: 'temporarily_failed',
      nextStatus: 'temporarily_failed',
      checkedAt,
      previousCheckAttempts: 0,
    })
    expect(result.nextCheckAt?.getTime()).toBe(
      checkedAt.getTime() + 15 * MINUTE,
    )
    expect(result.graceExpiresAt).toBeUndefined()
  })

  it('temporarily_failed -> verified: recovers, clears graceExpiresAt, resumes the 24h cadence', () => {
    const result = computeRecheckSchedule({
      previousStatus: 'temporarily_failed',
      nextStatus: 'verified',
      checkedAt,
      previousCheckAttempts: 0,
    })
    expect(result.nextCheckAt?.getTime()).toBe(checkedAt.getTime() + 24 * HOUR)
    expect(result.graceExpiresAt).toBeNull()
  })

  it('temporarily_failed -> failed (grace_expired): clears both the schedule and graceExpiresAt', () => {
    const result = computeRecheckSchedule({
      previousStatus: 'temporarily_failed',
      nextStatus: 'failed',
      checkedAt,
      previousCheckAttempts: 0,
    })
    expect(result.nextCheckAt).toBeNull()
    expect(result.graceExpiresAt).toBeNull()
  })
})
