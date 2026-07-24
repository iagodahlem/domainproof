import { describe, expect, it } from 'vitest'
import { formatRelativeTime } from './format-relative-time'

const NOW = new Date('2026-01-15T12:00:00.000Z')

describe('formatRelativeTime', () => {
  it('renders "just now" under 45 seconds', () => {
    expect(formatRelativeTime('2026-01-15T11:59:30.000Z', NOW)).toBe('just now')
  })

  it('renders minutes with a space before "min"', () => {
    expect(formatRelativeTime('2026-01-15T11:57:00.000Z', NOW)).toBe(
      '3 min ago',
    )
  })

  it('renders hours with a space before "hr"', () => {
    expect(formatRelativeTime('2026-01-15T09:00:00.000Z', NOW)).toBe('3 hr ago')
  })

  it('renders days flush against "d", with no space', () => {
    expect(formatRelativeTime('2026-01-13T12:00:00.000Z', NOW)).toBe('2d ago')
  })

  it('renders a future day flush against "d" too', () => {
    expect(formatRelativeTime('2026-01-17T12:00:00.000Z', NOW)).toBe('in ~2d')
  })

  it('renders a future minute with its space intact', () => {
    expect(formatRelativeTime('2026-01-15T12:03:00.000Z', NOW)).toBe(
      'in ~3 min',
    )
  })
})
