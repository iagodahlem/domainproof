import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Header } from './header'

describe('Header', () => {
  it('renders left and right content', () => {
    render(<Header left={<span>Logo</span>} right={<span>Menu</span>} />)
    expect(screen.getByText('Logo')).toBeTruthy()
    expect(screen.getByText('Menu')).toBeTruthy()
  })

  it('renders without right content', () => {
    render(<Header left={<span>Logo</span>} />)
    expect(screen.getByText('Logo')).toBeTruthy()
  })

  it('defaults to the glass variant', () => {
    render(<Header left={<span>Logo</span>} />)
    const header = screen.getByText('Logo').closest('header')
    expect(header?.className).toContain('sticky')
    expect(header?.className).toContain('bg-background-glass')
  })

  it('applies the solid variant classes', () => {
    render(<Header variant="solid" left={<span>Domains</span>} />)
    const header = screen.getByText('Domains').closest('header')
    expect(header?.className).toContain('bg-surface')
    expect(header?.className).not.toContain('sticky')
  })

  it('merges a custom className with the variant classes', () => {
    render(<Header left={<span>Logo</span>} className="my-custom-class" />)
    const header = screen.getByText('Logo').closest('header')
    expect(header?.className).toContain('my-custom-class')
  })
})
