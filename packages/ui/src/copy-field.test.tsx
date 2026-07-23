import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CopyField } from './copy-field'

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

describe('CopyField', () => {
  it('renders the value in a read-only field', () => {
    render(<CopyField value="https://domainproof.dev/verify/abc123" />)
    const input = screen.getByDisplayValue(
      'https://domainproof.dev/verify/abc123',
    )
    expect(input).toHaveProperty('readOnly', true)
  })

  it('copies the value via the button inside the field', async () => {
    const { user, writeText } = setupUserWithClipboard()
    render(<CopyField value="acmeapp-verify=8f2c9e1a" />)

    await user.click(screen.getByRole('button', { name: 'Copy' }))

    expect(writeText).toHaveBeenCalledWith('acmeapp-verify=8f2c9e1a')
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy(),
    )
  })

  it('associates an optional label with the field', () => {
    render(<CopyField value="acme.co" label="Hosted link" />)
    expect(screen.getByLabelText('Hosted link')).toBeTruthy()
  })

  it('selects the field contents on focus', async () => {
    const user = userEvent.setup()
    render(<CopyField value="acme.co" label="Hosted link" />)
    const input = screen.getByLabelText('Hosted link') as HTMLInputElement
    await user.click(input)
    expect(input.selectionStart).toBe(0)
    expect(input.selectionEnd).toBe(input.value.length)
  })
})
