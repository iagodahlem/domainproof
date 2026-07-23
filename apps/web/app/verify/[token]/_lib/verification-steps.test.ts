import { describe, expect, it } from 'vitest'
import { verificationSteps } from './verification-steps'

function check(
  outcome: string,
  extra: Partial<{ expected: string; detected: string[] }> = {},
) {
  return { outcome, checkedAt: '2026-07-19T12:00:00.000Z', ...extra }
}

function statusesOf(steps: ReturnType<typeof verificationSteps>) {
  return steps.map((step) => step.status)
}

describe('verificationSteps', () => {
  it('marks only "record added" current for a fresh pending domain with no check yet', () => {
    const steps = verificationSteps({ status: 'pending', check: null })
    expect(statusesOf(steps)).toEqual([
      'done',
      'current',
      'upcoming',
      'upcoming',
    ])
  })

  it('marks "record added" current for pending + not_found', () => {
    const steps = verificationSteps({
      status: 'pending',
      check: check('not_found'),
    })
    expect(statusesOf(steps)).toEqual([
      'done',
      'current',
      'upcoming',
      'upcoming',
    ])
  })

  it('marks "record added" done and "propagated" current once detected is non-empty but outcome is not yet found', () => {
    const steps = verificationSteps({
      status: 'pending',
      check: check('unreachable', { detected: ['some-other-value'] }),
    })
    expect(statusesOf(steps)).toEqual(['done', 'done', 'current', 'upcoming'])
  })

  it('marks the first three steps done and "verified" upcoming right after a found check, before the status flips', () => {
    // Defensive only — in practice `found` transitions status to `verified`
    // in the same operation, but the derivation should still hold if ever
    // observed mid-transition.
    const steps = verificationSteps({
      status: 'pending',
      check: check('found'),
    })
    expect(statusesOf(steps)).toEqual(['done', 'done', 'done', 'current'])
  })

  it('marks every step done once verified', () => {
    const steps = verificationSteps({
      status: 'verified',
      check: check('found'),
    })
    expect(statusesOf(steps)).toEqual(['done', 'done', 'done', 'done'])
  })

  it('treats a recovering (temporarily_failed) domain as having added/propagated the record, with "verified" active again', () => {
    const steps = verificationSteps({
      status: 'temporarily_failed',
      check: check('not_found'),
    })
    expect(statusesOf(steps)).toEqual(['done', 'done', 'done', 'current'])
  })

  it('marks "record added" done but "propagated" failed for a hard wrong_value failure', () => {
    const steps = verificationSteps({
      status: 'failed',
      check: check('wrong_value', { expected: 'a', detected: ['b'] }),
    })
    expect(statusesOf(steps)).toEqual(['done', 'done', 'failed', 'upcoming'])
  })

  it('marks "record added" failed for a domain that expired without ever finding a record', () => {
    const steps = verificationSteps({
      status: 'failed',
      check: check('expired'),
    })
    expect(statusesOf(steps)).toEqual([
      'done',
      'failed',
      'upcoming',
      'upcoming',
    ])
  })

  it('never marks more than one step "current" at once', () => {
    const cases: Array<Parameters<typeof verificationSteps>[0]> = [
      { status: 'not_started', check: null },
      { status: 'pending', check: null },
      { status: 'pending', check: check('not_found') },
      { status: 'temporarily_failed', check: check('not_found') },
      { status: 'failed', check: check('expired') },
      { status: 'verified', check: check('found') },
    ]
    for (const input of cases) {
      const currentCount = statusesOf(verificationSteps(input)).filter(
        (status) => status === 'current',
      ).length
      expect(currentCount).toBeLessThanOrEqual(1)
    }
  })

  it('never marks more than one step "failed" at once', () => {
    const cases: Array<Parameters<typeof verificationSteps>[0]> = [
      { status: 'failed', check: check('expired') },
      { status: 'failed', check: check('wrong_value') },
      { status: 'failed', check: null },
    ]
    for (const input of cases) {
      const failedCount = statusesOf(verificationSteps(input)).filter(
        (status) => status === 'failed',
      ).length
      expect(failedCount).toBeLessThanOrEqual(1)
    }
  })
})
