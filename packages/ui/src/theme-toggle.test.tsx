import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { ThemeToggle } from './theme-toggle'

beforeEach(() => {
  window.localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
})

describe('ThemeToggle', () => {
  it('defaults to dark theme', () => {
    render(<ThemeToggle />)
    expect(screen.getByRole('button', { name: /dark theme/i })).toBeTruthy()
  })

  it('hydrates from a stored theme', () => {
    window.localStorage.setItem('theme', 'light')
    render(<ThemeToggle />)
    expect(screen.getByRole('button', { name: /light theme/i })).toBeTruthy()
  })

  it('toggles theme on click and persists it', async () => {
    const user = userEvent.setup()
    render(<ThemeToggle />)

    await user.click(screen.getByRole('button', { name: /dark theme/i }))

    expect(screen.getByRole('button', { name: /light theme/i })).toBeTruthy()
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    expect(window.localStorage.getItem('theme')).toBe('light')
  })
})
