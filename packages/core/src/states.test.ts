import { describe, expect, it } from 'vitest'

import {
  DOMAIN_STATUSES,
  type DomainStatus,
  transition,
  type VerificationEvent,
} from './states'

const EVENT_TYPES: VerificationEvent['type'][] = [
  'verification_started',
  'check_passed',
  'check_hard_failed',
  'recheck_passed',
  'recheck_record_lost',
  'grace_expired',
  'challenge_regenerated',
]

/**
 * The full (status, event) transition matrix. `null` means the transition
 * is invalid; a status means it's valid and transitions to that status.
 * Every status x event pair (5 x 7 = 35) is listed explicitly so adding a
 * status or event without updating this table fails the test, not just the
 * typecheck.
 */
const MATRIX: Record<
  DomainStatus,
  Record<VerificationEvent['type'], DomainStatus | null>
> = {
  not_started: {
    verification_started: 'pending',
    check_passed: null,
    check_hard_failed: null,
    recheck_passed: null,
    recheck_record_lost: null,
    grace_expired: null,
    challenge_regenerated: null,
  },
  pending: {
    verification_started: null,
    check_passed: 'verified',
    check_hard_failed: 'failed',
    recheck_passed: null,
    recheck_record_lost: null,
    grace_expired: null,
    challenge_regenerated: 'pending',
  },
  verified: {
    verification_started: null,
    check_passed: null,
    check_hard_failed: null,
    recheck_passed: 'verified',
    recheck_record_lost: 'temporarily_failed',
    grace_expired: null,
    challenge_regenerated: null,
  },
  temporarily_failed: {
    verification_started: null,
    check_passed: null,
    check_hard_failed: null,
    recheck_passed: 'verified',
    recheck_record_lost: null,
    grace_expired: 'failed',
    challenge_regenerated: null,
  },
  failed: {
    verification_started: null,
    check_passed: null,
    check_hard_failed: null,
    recheck_passed: null,
    recheck_record_lost: null,
    grace_expired: null,
    challenge_regenerated: 'pending',
  },
}

describe('transition', () => {
  for (const status of DOMAIN_STATUSES) {
    for (const eventType of EVENT_TYPES) {
      const expected = MATRIX[status][eventType]
      const label = expected === null ? 'is invalid' : `-> ${expected}`

      it(`${status} + ${eventType} ${label}`, () => {
        const result = transition(status, { type: eventType })

        if (expected === null) {
          expect(result).toEqual({ ok: false, error: 'invalid_transition' })
        } else {
          expect(result).toEqual({ ok: true, next: expected })
        }
      })
    }
  }

  it('covers every status', () => {
    expect(Object.keys(MATRIX).sort()).toEqual([...DOMAIN_STATUSES].sort())
  })

  it('covers every event for every status', () => {
    for (const status of DOMAIN_STATUSES) {
      expect(Object.keys(MATRIX[status]).sort()).toEqual(
        [...EVENT_TYPES].sort(),
      )
    }
  })
})
