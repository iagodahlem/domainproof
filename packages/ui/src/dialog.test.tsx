import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ConfirmDialog } from './dialog'

function ControlledConfirmDialog({
  onConfirm,
  pending = false,
  error,
}: {
  onConfirm: () => void
  pending?: boolean
  error?: string
}) {
  const [open, setOpen] = useState(true)
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={setOpen}
      title="Delete acme.co?"
      description="Deleting acme.co stops all checks and revokes its hosted verification link immediately."
      confirmLabel="Confirm delete"
      onConfirm={onConfirm}
      pending={pending}
      error={error}
    />
  )
}

describe('ConfirmDialog', () => {
  it('renders the title, description, and both actions when open', () => {
    render(<ControlledConfirmDialog onConfirm={() => {}} />)
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByText('Delete acme.co?')).toBeTruthy()
    expect(screen.getByText(/stops all checks and revokes/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Confirm delete' })).toBeTruthy()
  })

  it('calls onConfirm when the confirm action is clicked', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(<ControlledConfirmDialog onConfirm={onConfirm} />)
    await user.click(screen.getByRole('button', { name: 'Confirm delete' }))
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('closes on Cancel', async () => {
    const user = userEvent.setup()
    render(<ControlledConfirmDialog onConfirm={() => {}} />)
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('renders an error message and stays open', () => {
    render(
      <ControlledConfirmDialog
        onConfirm={() => {}}
        error="Something went wrong. Please try again."
      />,
    )
    expect(
      screen.getByText('Something went wrong. Please try again.'),
    ).toBeTruthy()
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('disables Cancel and hides the close button while pending', () => {
    render(<ControlledConfirmDialog onConfirm={() => {}} pending />)
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveProperty(
      'disabled',
      true,
    )
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull()
  })
})
