import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ConfirmBar } from './confirm-bar'

describe('ConfirmBar', () => {
  it('renders the message and both actions', () => {
    render(
      <ConfirmBar
        message="This can't be undone."
        confirmLabel="Confirm rotate"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    )
    expect(screen.getByText("This can't be undone.")).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Confirm rotate' })).toBeTruthy()
  })

  it('calls onConfirm and onCancel', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(
      <ConfirmBar
        message="Revoking can't be undone."
        confirmLabel="Confirm revoke"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Confirm revoke' }))
    expect(onConfirm).toHaveBeenCalledOnce()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('disables both actions while pending', () => {
    render(
      <ConfirmBar
        message="Rotating…"
        confirmLabel="Confirm rotate"
        onConfirm={() => {}}
        onCancel={() => {}}
        pending
      />,
    )
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveProperty(
      'disabled',
      true,
    )
    expect(
      screen.getByRole('button', { name: 'Confirm rotate' }),
    ).toHaveProperty('disabled', true)
  })
})
