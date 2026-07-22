import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import * as frontendApi from '../../../lib/frontend-api'
import { TimelineSection } from './timeline-section'

function event(overrides: Partial<frontendApi.VerificationEvent> = {}) {
  return {
    id: '1',
    type: 'domain.claimed',
    mode: 'test' as const,
    createdAt: '2026-07-19T12:00:00.000Z',
    ...overrides,
  }
}

describe('TimelineSection', () => {
  it('renders a friendly summary for each known event type', async () => {
    vi.spyOn(frontendApi, 'listVerificationEvents').mockResolvedValue({
      ok: true,
      data: {
        events: [
          event({ id: '1', type: 'domain.claimed' }),
          event({ id: '2', type: 'domain.verified' }),
        ],
        nextCursor: null,
      },
    })

    render(<TimelineSection token="tok_1" />)

    expect(await screen.findByText(/domain claimed/i)).toBeTruthy()
    expect(screen.getByText(/domain verified\./i)).toBeTruthy()
  })

  it('renders an error state instead of an empty list on a fetch failure', async () => {
    vi.spyOn(frontendApi, 'listVerificationEvents').mockResolvedValue({
      ok: false,
      error: { kind: 'network', message: 'offline' },
    })

    render(<TimelineSection token="tok_1" />)

    expect(
      await screen.findByText(/couldn't load the verification timeline/i),
    ).toBeTruthy()
  })

  it('refetches when refreshKey changes, keeping entries visible without re-flashing loading', async () => {
    vi.spyOn(frontendApi, 'listVerificationEvents')
      .mockResolvedValueOnce({
        ok: true,
        data: { events: [event({ id: '1' })], nextCursor: null },
      })
      .mockResolvedValue({
        ok: true,
        data: {
          events: [
            event({ id: '1' }),
            event({ id: '2', type: 'domain.verified' }),
          ],
          nextCursor: null,
        },
      })

    const { rerender } = render(
      <TimelineSection token="tok_1" refreshKey="2026-07-19T12:00:00.000Z" />,
    )
    expect(await screen.findByText(/domain claimed/i)).toBeTruthy()

    rerender(
      <TimelineSection token="tok_1" refreshKey="2026-07-19T12:05:00.000Z" />,
    )
    expect(await screen.findByText(/domain verified\./i)).toBeTruthy()
    // The first entry stays visible throughout — this never regresses to
    // the loading skeleton on a refresh, only on the very first mount.
    expect(screen.getByText(/domain claimed/i)).toBeTruthy()
  })
})
