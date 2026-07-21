import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CopyButton } from './copy-button'

// userEvent.setup() installs its own clipboard stub, so the mock must be
// defined after setup() runs or setup() silently overwrites it.
function setupUserWithClipboard(
  options?: Parameters<typeof userEvent.setup>[0],
) {
  const user = userEvent.setup(options)
  const writeText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  })
  return { user, writeText }
}

describe('CopyButton', () => {
  it('renders the initial label', () => {
    render(<CopyButton value="acme.co">Copy</CopyButton>)
    expect(screen.getByRole('button', { name: 'Copy' })).toBeTruthy()
  })

  it('copies the value to the clipboard and shows the copied label', async () => {
    const { user, writeText } = setupUserWithClipboard()
    render(
      <CopyButton value="acmeapp-verify=8f2c9e1a4b7d3f60">Copy</CopyButton>,
    )

    await user.click(screen.getByRole('button', { name: 'Copy' }))

    expect(writeText).toHaveBeenCalledWith('acmeapp-verify=8f2c9e1a4b7d3f60')
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy(),
    )
  })

  it('reverts to the original label after resetAfter elapses', async () => {
    const { user } = setupUserWithClipboard()
    render(
      <CopyButton value="acme.co" resetAfter={30}>
        Copy
      </CopyButton>,
    )

    await user.click(screen.getByRole('button'))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy(),
    )

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Copy' })).toBeTruthy(),
    )
  })

  it('accepts a custom copied label', async () => {
    const { user } = setupUserWithClipboard()
    render(
      <CopyButton value="acme.co" copiedLabel="Done">
        Copy link
      </CopyButton>,
    )

    await user.click(screen.getByRole('button', { name: 'Copy link' }))

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Done' })).toBeTruthy(),
    )
  })
})
