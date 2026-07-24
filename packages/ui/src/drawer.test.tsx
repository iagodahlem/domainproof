import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
} from './drawer'

function ControlledDrawer({ onOpenChange }: { onOpenChange?: () => void }) {
  const [open, setOpen] = useState(true)
  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        onOpenChange?.()
      }}
    >
      <DrawerContent>
        <DrawerHeader title="Add a domain" />
        <DrawerBody>
          <p>Body content</p>
        </DrawerBody>
        <DrawerFooter>
          <button type="button" onClick={() => setOpen(false)}>
            Cancel
          </button>
          <button type="button">Add domain</button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

describe('Drawer', () => {
  it('renders as a labelled dialog with its title, body, and footer', () => {
    render(<ControlledDrawer />)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeTruthy()
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(screen.getByText('Add a domain')).toBeTruthy()
    expect(screen.getByText('Body content')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Add domain' })).toBeTruthy()
  })

  it('closes on the header close button', async () => {
    const user = userEvent.setup()
    render(<ControlledDrawer />)
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('closes on Escape', async () => {
    const user = userEvent.setup()
    render(<ControlledDrawer />)
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('closes via the footer Cancel action', async () => {
    const user = userEvent.setup()
    render(<ControlledDrawer />)
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('calls onOpenChange for every dismiss path', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(<ControlledDrawer onOpenChange={onOpenChange} />)
    await user.keyboard('{Escape}')
    expect(onOpenChange).toHaveBeenCalledOnce()
  })

  it('renders nothing when closed', () => {
    render(
      <Drawer open={false} onOpenChange={() => {}}>
        <DrawerContent>
          <DrawerHeader title="Add a domain" />
          <DrawerBody>Body content</DrawerBody>
        </DrawerContent>
      </Drawer>,
    )
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
