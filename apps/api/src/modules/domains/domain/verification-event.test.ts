import { describe, expect, it } from 'vitest'
import {
  DOMAIN_STATUSES,
  transition,
  type DomainStatus,
  type TxtCheckResult,
} from '@domainproof/core'
import { eventForCheckOutcome } from './verification-event'

const OUTCOMES: TxtCheckResult['outcome'][] = [
  'found',
  'wrong_value',
  'not_found',
  'unreachable',
]

describe('eventForCheckOutcome', () => {
  it('never proposes an event transition() rejects, for every (status, outcome) pair', () => {
    for (const status of DOMAIN_STATUSES) {
      for (const outcome of OUTCOMES) {
        const event = eventForCheckOutcome(status, outcome)
        if (event === undefined) {
          continue
        }
        expect(
          transition(status, event),
          `eventForCheckOutcome(${status}, ${outcome}) proposed ${event.type}`,
        ).toEqual({ ok: true, next: expect.any(String) })
      }
    }
  })

  it('unreachable never proposes a transition, for any status', () => {
    for (const status of DOMAIN_STATUSES) {
      expect(eventForCheckOutcome(status, 'unreachable')).toBeUndefined()
    }
  })

  describe('not_started', () => {
    it('never proposes a transition (no active challenge in practice)', () => {
      for (const outcome of OUTCOMES) {
        expect(eventForCheckOutcome('not_started', outcome)).toBeUndefined()
      }
    })
  })

  describe('pending', () => {
    it('found passes verification', () => {
      expect(eventForCheckOutcome('pending', 'found')).toEqual({
        type: 'check_passed',
      })
    })

    it('wrong_value is a hard failure', () => {
      expect(eventForCheckOutcome('pending', 'wrong_value')).toEqual({
        type: 'check_hard_failed',
      })
    })

    it('not_found stays pending (DNS propagation)', () => {
      expect(eventForCheckOutcome('pending', 'not_found')).toBeUndefined()
    })
  })

  describe('verified', () => {
    it('found is a no-op refresh', () => {
      expect(eventForCheckOutcome('verified', 'found')).toEqual({
        type: 'recheck_passed',
      })
    })

    it('wrong_value opens the grace window', () => {
      expect(eventForCheckOutcome('verified', 'wrong_value')).toEqual({
        type: 'recheck_record_lost',
      })
    })

    it('not_found opens the grace window, same as wrong_value', () => {
      expect(eventForCheckOutcome('verified', 'not_found')).toEqual({
        type: 'recheck_record_lost',
      })
    })
  })

  describe('temporarily_failed', () => {
    it('found recovers back to verified', () => {
      expect(eventForCheckOutcome('temporarily_failed', 'found')).toEqual({
        type: 'recheck_passed',
      })
    })

    it('wrong_value stays in the grace window (no grace_expired timer here)', () => {
      expect(
        eventForCheckOutcome('temporarily_failed', 'wrong_value'),
      ).toBeUndefined()
    })

    it('not_found stays in the grace window', () => {
      expect(
        eventForCheckOutcome('temporarily_failed', 'not_found'),
      ).toBeUndefined()
    })
  })

  describe('failed', () => {
    it('never proposes a transition — only challenge_regenerated escapes failed', () => {
      for (const outcome of OUTCOMES) {
        expect(eventForCheckOutcome('failed', outcome)).toBeUndefined()
      }
    })
  })

  it('is exhaustive over every known DomainStatus', () => {
    const covered: DomainStatus[] = [
      'not_started',
      'pending',
      'verified',
      'temporarily_failed',
      'failed',
    ]
    expect(covered.sort()).toEqual([...DOMAIN_STATUSES].sort())
  })
})
