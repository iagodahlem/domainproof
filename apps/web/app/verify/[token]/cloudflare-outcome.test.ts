import { describe, expect, it } from 'vitest'
import { describeCloudflareOutcome } from './cloudflare-outcome'

describe('describeCloudflareOutcome', () => {
  it('renders an accent, in-progress message for success', () => {
    expect(describeCloudflareOutcome('success').tone).toBe('accent')
  })

  it.each([
    'denied',
    'no_matching_zone',
    'record_create_failed',
    'exchange_failed',
    'not_found',
  ])('renders a non-accent message for %s', (outcome) => {
    const view = describeCloudflareOutcome(outcome)
    expect(view.tone).not.toBe('accent')
    expect(view.message.length).toBeGreaterThan(0)
  })

  it('falls back gracefully for an unrecognized outcome string', () => {
    const view = describeCloudflareOutcome('something_new')
    expect(view.tone).toBe('neutral')
    expect(view.message.length).toBeGreaterThan(0)
  })
})
