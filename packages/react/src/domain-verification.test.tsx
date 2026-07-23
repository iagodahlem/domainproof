import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DomainVerification } from './domain-verification'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function claimResult(overrides: Record<string, unknown> = {}) {
  return {
    domain: 'acme.test',
    mode: 'test',
    status: 'pending',
    projectName: 'Acme',
    provider: 'unknown',
    records: [
      {
        label: '_acme-challenge.acme.test',
        type: 'TXT',
        value: 'acme-verify=abc123',
      },
    ],
    check: null,
    updatedAt: '2026-07-19T12:00:00.000Z',
    frontendToken: 'ft_123',
    ...overrides,
  }
}

// userEvent.setup() installs its own clipboard stub, so a custom mock must
// be defined after setup() runs or setup() silently overwrites it (same
// note as packages/ui's copy-button.test.tsx).
function setupUserWithClipboard() {
  const user = userEvent.setup()
  const writeText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  })
  return { user, writeText }
}

async function claimDomain(user: ReturnType<typeof userEvent.setup>) {
  const input = screen.getByLabelText('Domain')
  await user.type(input, 'acme.test')
  await user.click(screen.getByRole('button', { name: /claim domain/i }))
}

describe('DomainVerification', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders a domain input form before any claim', () => {
    render(<DomainVerification sessionToken="sess_123" />)
    expect(screen.getByLabelText('Domain')).toBeTruthy()
    const button = screen.getByRole('button', {
      name: /claim domain/i,
    }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
  })

  it('claims a domain and shows the record card with a status badge', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = String(input)
      if (url.includes('/claim')) {
        return Promise.resolve(jsonResponse(claimResult(), 201))
      }
      return Promise.resolve(jsonResponse(claimResult()))
    })

    const user = userEvent.setup()
    render(<DomainVerification sessionToken="sess_123" />)
    await claimDomain(user)

    expect(await screen.findByText('acme.test')).toBeTruthy()
    expect(screen.getByText('_acme-challenge.acme.test')).toBeTruthy()
    expect(screen.getByText('acme-verify=abc123')).toBeTruthy()
    expect(screen.getByText('Pending')).toBeTruthy()
  })

  it('copies a record value to the clipboard', async () => {
    // A fresh Response per call — the component also fires a background
    // GET once claimed, and a Response body can only be read once.
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(jsonResponse(claimResult(), 201)),
    )

    const { user, writeText } = setupUserWithClipboard()
    render(<DomainVerification sessionToken="sess_123" />)
    await claimDomain(user)

    const copyButtons = await screen.findAllByRole('button', {
      name: /copy/i,
    })
    await user.click(copyButtons[0]!)

    expect(writeText).toHaveBeenCalledWith('_acme-challenge.acme.test')
    await waitFor(() =>
      expect(screen.getAllByText('Copied').length).toBeGreaterThan(0),
    )
  })

  it('calls onVerified once the status reaches verified', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = String(input)
      if (url.includes('/claim')) {
        return Promise.resolve(jsonResponse(claimResult(), 201))
      }
      return Promise.resolve(jsonResponse(claimResult({ status: 'verified' })))
    })

    const onVerified = vi.fn()
    const user = userEvent.setup()
    render(
      <DomainVerification sessionToken="sess_123" onVerified={onVerified} />,
    )
    await claimDomain(user)

    // The stepper's last step is always labeled "Verified", even before
    // the domain actually is — wait for the status pill's own "Verified"
    // to join it (2 matches) rather than the stepper's alone (1), or this
    // resolves before the real status transition does.
    await waitFor(() => expect(screen.getAllByText('Verified').length).toBe(2))
    expect(onVerified).toHaveBeenCalledTimes(1)
    expect(onVerified.mock.calls[0]![0]).toMatchObject({ status: 'verified' })
    // No "Check now" button once terminal.
    expect(screen.queryByRole('button', { name: /check now/i })).toBeNull()
  })

  it('shows a terminal message when the claim error is not retryable', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: 'domain_already_claimed',
            message:
              'This domain is already claimed for this project in this mode.',
          },
        },
        409,
      ),
    )

    const user = userEvent.setup()
    render(<DomainVerification sessionToken="sess_123" />)
    await claimDomain(user)

    expect(await screen.findByText(/already been used/i)).toBeTruthy()
    expect(screen.queryByLabelText('Domain')).toBeNull()
  })

  it('keeps the form when the claim error is a rate limit', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(
        { error: { code: 'rate_limited', message: 'Too many' } },
        429,
      ),
    )

    const user = userEvent.setup()
    render(<DomainVerification sessionToken="sess_123" />)
    await claimDomain(user)

    expect(await screen.findByText(/wait a moment/i)).toBeTruthy()
    expect(screen.getByLabelText('Domain')).toBeTruthy()
  })
})
