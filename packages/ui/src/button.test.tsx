import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Button } from './button'

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Recheck now</Button>)
    expect(screen.getByRole('button', { name: 'Recheck now' })).toBeTruthy()
  })

  it('defaults to type="button" so it never submits a form by accident', () => {
    render(<Button>Click</Button>)
    expect(screen.getByRole('button').getAttribute('type')).toBe('button')
  })

  it('applies the primary variant classes', () => {
    render(<Button variant="primary">Recheck now</Button>)
    const el = screen.getByRole('button')
    expect(el.className).toContain('bg-[var(--accent)]')
  })

  it('applies the danger-ghost variant classes', () => {
    render(<Button variant="danger-ghost">Remove domain</Button>)
    const el = screen.getByRole('button')
    expect(el.className).toContain('text-[color:var(--danger)]')
  })

  it('applies the sm size classes', () => {
    render(<Button size="sm">Open Cloudflare DNS</Button>)
    const el = screen.getByRole('button')
    expect(el.className).toContain('text-[length:var(--text-xs)]')
  })

  it('applies the pill shape classes', () => {
    render(<Button shape="pill">Recheck now</Button>)
    const el = screen.getByRole('button')
    expect(el.className).toContain('rounded-[var(--radius-full)]')
  })

  it('disables the button and blocks clicks when disabled', () => {
    const onClick = vi.fn()
    render(
      <Button disabled onClick={onClick}>
        Add domain
      </Button>,
    )
    const el = screen.getByRole('button') as HTMLButtonElement
    expect(el.disabled).toBe(true)
  })

  it('disables and marks aria-busy when loading, without needing the disabled prop', () => {
    render(<Button loading>Recheck now</Button>)
    const el = screen.getByRole('button') as HTMLButtonElement
    expect(el.disabled).toBe(true)
    expect(el.getAttribute('aria-busy')).toBe('true')
  })

  it('merges a custom className with the variant classes', () => {
    render(<Button className="my-custom-class">Click</Button>)
    expect(screen.getByRole('button').className).toContain('my-custom-class')
  })
})
