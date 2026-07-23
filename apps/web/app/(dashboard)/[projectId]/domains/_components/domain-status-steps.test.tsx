import { describe, expect, it } from 'vitest'
import type {
  DomainCheck,
  DomainDetail,
  DomainStatus,
} from '@/lib/api/dashboard'
import { domainStatusSteps } from './domain-status-steps'

function fakeDomain(overrides: Partial<DomainDetail> = {}): DomainDetail {
  return {
    id: 'dom_1',
    domain: 'acme.co',
    mode: 'test',
    status: 'pending',
    method: 'dns_txt',
    createdAt: '2026-07-23T09:41:00.000Z',
    updatedAt: '2026-07-23T09:41:00.000Z',
    verifiedAt: null,
    verificationUrl: 'https://domainproof.dev/verify/tok_1',
    records: [
      {
        type: 'TXT',
        name: '_acme-challenge.acme.co',
        value: 'acme-verify=abc',
        status: 'pending',
      },
    ],
    ...overrides,
  }
}

function check(
  outcome: string,
  extra: Partial<{ expected: string; detected: string[] }> = {},
): DomainCheck {
  return { outcome, checkedAt: '2026-07-23T09:52:00.000Z', ...extra }
}

function statusesOf(steps: ReturnType<typeof domainStatusSteps>) {
  return steps.map((step) => step.status)
}

describe('domainStatusSteps', () => {
  it('marks only "record added" current for a fresh pending domain with no check yet', () => {
    const steps = domainStatusSteps(fakeDomain(), null)
    expect(statusesOf(steps)).toEqual([
      'done',
      'current',
      'upcoming',
      'upcoming',
    ])
  })

  it('marks "record added" done and "propagated" current once detected is non-empty but outcome is not yet found', () => {
    const steps = domainStatusSteps(
      fakeDomain(),
      check('unreachable', { detected: ['some-other-value'] }),
    )
    expect(statusesOf(steps)).toEqual(['done', 'done', 'current', 'upcoming'])
  })

  it('marks every step done once verified', () => {
    const steps = domainStatusSteps(
      fakeDomain({
        status: 'verified',
        verifiedAt: '2026-07-23T09:58:00.000Z',
      }),
      check('found'),
    )
    expect(statusesOf(steps)).toEqual(['done', 'done', 'done', 'done'])
  })

  it('treats a recovering (temporarily_failed) domain as having added/propagated the record, with "verified" active again', () => {
    const steps = domainStatusSteps(
      fakeDomain({
        status: 'temporarily_failed',
        verifiedAt: '2026-07-23T09:58:00.000Z',
      }),
      check('not_found'),
    )
    expect(statusesOf(steps)).toEqual(['done', 'done', 'done', 'current'])
  })

  it('marks a stalled step "failed" (not merely upcoming) for a hard wrong_value failure', () => {
    const steps = domainStatusSteps(
      fakeDomain({ status: 'failed' }),
      check('wrong_value', { expected: 'a', detected: ['b'] }),
    )
    expect(statusesOf(steps)).toEqual(['done', 'done', 'failed', 'upcoming'])
  })

  it('marks "record added" failed for a domain that expired without ever finding a record', () => {
    const steps = domainStatusSteps(
      fakeDomain({ status: 'failed' }),
      check('expired'),
    )
    expect(statusesOf(steps)).toEqual([
      'done',
      'failed',
      'upcoming',
      'upcoming',
    ])
  })

  it('never marks more than one step "current" or "failed" at once', () => {
    const cases: Array<[DomainStatus, DomainCheck | null]> = [
      ['pending', null],
      ['pending', check('not_found')],
      ['temporarily_failed', check('not_found')],
      ['failed', check('expired')],
      ['verified', check('found')],
    ]
    for (const [status, checkInput] of cases) {
      const active = statusesOf(
        domainStatusSteps(fakeDomain({ status }), checkInput),
      ).filter((s) => s === 'current' || s === 'failed').length
      expect(active).toBeLessThanOrEqual(1)
    }
  })

  it('only "Claimed" and "Verified" carry a time label', () => {
    const steps = domainStatusSteps(
      fakeDomain({
        status: 'verified',
        verifiedAt: '2026-07-23T09:58:00.000Z',
      }),
      check('found'),
    )
    const times = steps.map((step) => step.time)
    expect(times[0]).toBeTruthy()
    expect(times[1]).toBeUndefined()
    expect(times[2]).toBeUndefined()
    expect(times[3]).toBeTruthy()
  })
})
