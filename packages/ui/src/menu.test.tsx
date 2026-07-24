import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Folder } from 'lucide-react'
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from './menu'

function renderMenu(onSelect = vi.fn()) {
  return render(
    <Menu>
      <MenuTrigger>Acme App</MenuTrigger>
      <MenuContent>
        <MenuItem active icon={<span>icon</span>}>
          Acme App
        </MenuItem>
        <MenuItem onSelect={onSelect}>Beta Labs</MenuItem>
        <MenuSeparator />
        <MenuItem tone="accent">New project</MenuItem>
        <MenuItem tone="danger">Delete domain</MenuItem>
      </MenuContent>
    </Menu>,
  )
}

describe('Menu', () => {
  it('renders a real button trigger, closed by default', () => {
    renderMenu()
    expect(screen.getByRole('button', { name: 'Acme App' })).toBeTruthy()
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('opens the menu and shows every item on trigger click', async () => {
    const user = userEvent.setup()
    renderMenu()
    await user.click(screen.getByRole('button', { name: 'Acme App' }))
    expect(screen.getByRole('menu')).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: 'Beta Labs' })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: 'New project' })).toBeTruthy()
  })

  it('marks the active item with a check and calls onSelect for others', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    renderMenu(onSelect)
    await user.click(screen.getByRole('button', { name: 'Acme App' }))

    const active = screen.getByRole('menuitem', { name: 'Acme App' })
    expect(active.className).toContain('bg-surface-2')

    await user.click(screen.getByRole('menuitem', { name: 'Beta Labs' }))
    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it('applies the accent tone classes to a tinted item', async () => {
    const user = userEvent.setup()
    renderMenu()
    await user.click(screen.getByRole('button', { name: 'Acme App' }))
    const item = screen.getByRole('menuitem', { name: 'New project' })
    expect(item.className).toContain('text-accent')
  })

  it('applies the danger tone classes to a destructive item', async () => {
    const user = userEvent.setup()
    renderMenu()
    await user.click(screen.getByRole('button', { name: 'Acme App' }))
    const item = screen.getByRole('menuitem', { name: 'Delete domain' })
    expect(item.className).toContain('text-danger')
  })

  it('renders an asChild item with an icon and active check without crashing (Radix Slot requires a single element child)', async () => {
    const user = userEvent.setup()
    render(
      <Menu>
        <MenuTrigger>Acme App</MenuTrigger>
        <MenuContent>
          <MenuItem asChild active icon={<Folder />}>
            <a href="/projects/1">Acme App</a>
          </MenuItem>
        </MenuContent>
      </Menu>,
    )
    await user.click(screen.getByRole('button', { name: 'Acme App' }))
    const link = screen.getByRole('menuitem', { name: 'Acme App' })
    expect(link.tagName).toBe('A')
    expect(link.getAttribute('href')).toBe('/projects/1')
  })

  it('renders secondary text as its own element, alongside a truncating label rather than nested inside it', async () => {
    const user = userEvent.setup()
    render(
      <Menu>
        <MenuTrigger>Projects</MenuTrigger>
        <MenuContent>
          <MenuItem asChild secondary="acme-x7k9p2">
            <a href="/projects/2">Acme</a>
          </MenuItem>
        </MenuContent>
      </Menu>,
    )
    await user.click(screen.getByRole('button', { name: 'Projects' }))
    const item = screen.getByRole('menuitem')
    expect(item.textContent).toContain('Acme')
    expect(item.textContent).toContain('acme-x7k9p2')
  })
})
