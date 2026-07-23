import { describe, expect, it } from 'vitest'
import { describeStatus } from './status-view'

const DOMAIN = 'acme.co'
const PROJECT_NAME = 'Acme'

function check(
  outcome: string,
  extra: Partial<{ expected: string; detected: string[] }> = {},
) {
  return { outcome, checkedAt: '2026-07-19T12:00:00.000Z', ...extra }
}

describe('describeStatus', () => {
  it('renders "not started" for a fresh not_started domain', () => {
    const view = describeStatus({
      status: 'not_started',
      check: null,
      domain: DOMAIN,
      projectName: PROJECT_NAME,
    })
    expect(view.tone).toBe('pending')
    expect(view.showRecheck).toBe(true)
    expect(view.showDiff).toBe(false)
  })

  it('renders "waiting for your record" for pending with no check yet', () => {
    const view = describeStatus({
      status: 'pending',
      check: null,
      domain: DOMAIN,
      projectName: PROJECT_NAME,
    })
    expect(view.tone).toBe('pending')
    expect(view.heading).toMatch(/waiting/i)
    expect(view.showRecheck).toBe(true)
  })

  it('renders pending propagation guidance for a not_found check', () => {
    const view = describeStatus({
      status: 'pending',
      check: check('not_found'),
      domain: DOMAIN,
      projectName: PROJECT_NAME,
    })
    expect(view.tone).toBe('pending')
    expect(view.body).toContain(DOMAIN)
    expect(view.showDiff).toBe(false)
  })

  it('renders an unreachable note without changing the pending tone', () => {
    const view = describeStatus({
      status: 'pending',
      check: check('unreachable'),
      domain: DOMAIN,
      projectName: PROJECT_NAME,
    })
    expect(view.tone).toBe('pending')
    expect(view.unreachableNote).toContain(DOMAIN)
  })

  it('shows the diff and a warning tone for temporarily_failed with wrong_value', () => {
    const view = describeStatus({
      status: 'temporarily_failed',
      check: check('wrong_value', { detected: ['nope'] }),
      domain: DOMAIN,
      projectName: PROJECT_NAME,
    })
    expect(view.tone).toBe('warning')
    expect(view.showDiff).toBe(true)
    expect(view.showRecheck).toBe(true)
    expect(view.body).toContain('72 hours')
  })

  it('renders temporarily_failed with not_found without the diff', () => {
    const view = describeStatus({
      status: 'temporarily_failed',
      check: check('not_found'),
      domain: DOMAIN,
      projectName: PROJECT_NAME,
    })
    expect(view.tone).toBe('warning')
    expect(view.showDiff).toBe(false)
  })

  it('renders an unreachable note alongside temporarily_failed', () => {
    const view = describeStatus({
      status: 'temporarily_failed',
      check: check('unreachable'),
      domain: DOMAIN,
      projectName: PROJECT_NAME,
    })
    expect(view.tone).toBe('warning')
    expect(view.unreachableNote).not.toBeNull()
  })

  it('renders success and hides recheck once verified', () => {
    const view = describeStatus({
      status: 'verified',
      check: check('found'),
      domain: DOMAIN,
      projectName: PROJECT_NAME,
    })
    expect(view.tone).toBe('success')
    expect(view.showRecheck).toBe(false)
    expect(view.unreachableNote).toBeNull()
  })

  it('keeps the success tone but surfaces an unreachable note when a background recheck was inconclusive', () => {
    const view = describeStatus({
      status: 'verified',
      check: check('unreachable'),
      domain: DOMAIN,
      projectName: PROJECT_NAME,
    })
    expect(view.tone).toBe('success')
    expect(view.unreachableNote).not.toBeNull()
  })

  it('renders a danger tone with the diff and no recheck for a failed wrong_value', () => {
    const view = describeStatus({
      status: 'failed',
      check: check('wrong_value', { detected: ['nope'] }),
      domain: DOMAIN,
      projectName: PROJECT_NAME,
    })
    expect(view.tone).toBe('danger')
    expect(view.showDiff).toBe(true)
    expect(view.showRecheck).toBe(false)
    expect(view.body).toContain(PROJECT_NAME)
  })

  it('renders an expired explanation for a failed expired check', () => {
    const view = describeStatus({
      status: 'failed',
      check: check('expired'),
      domain: DOMAIN,
      projectName: PROJECT_NAME,
    })
    expect(view.tone).toBe('danger')
    expect(view.heading).toMatch(/expired/i)
    expect(view.showDiff).toBe(false)
  })

  it('renders the grace-window-closed explanation for a failed domain with no expired/wrong_value outcome', () => {
    const view = describeStatus({
      status: 'failed',
      check: check('not_found'),
      domain: DOMAIN,
      projectName: PROJECT_NAME,
    })
    expect(view.tone).toBe('danger')
    expect(view.heading).toMatch(/72-hour/i)
  })

  it('falls back gracefully for a defensive pending+wrong_value combination the state machine should never produce', () => {
    const view = describeStatus({
      status: 'pending',
      check: check('wrong_value', { detected: ['nope'] }),
      domain: DOMAIN,
      projectName: PROJECT_NAME,
    })
    expect(view.showDiff).toBe(true)
    expect(view.showRecheck).toBe(true)
  })

  it('falls back gracefully for an unrecognized outcome string', () => {
    const view = describeStatus({
      status: 'pending',
      check: check('some_future_outcome'),
      domain: DOMAIN,
      projectName: PROJECT_NAME,
    })
    expect(view.tone).toBe('pending')
    expect(view.unreachableNote).toBeNull()
  })
})
