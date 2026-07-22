import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CenteredMain } from './centered-main'

describe('CenteredMain', () => {
  it('renders children inside a main element', () => {
    render(
      <CenteredMain>
        <span>Content</span>
      </CenteredMain>,
    )
    const main = screen.getByText('Content').closest('main')
    expect(main).toBeTruthy()
  })

  it('applies the centered max-width column classes', () => {
    render(
      <CenteredMain>
        <span>Content</span>
      </CenteredMain>,
    )
    const main = screen.getByText('Content').closest('main')
    expect(main?.className).toContain('max-w-5xl')
    expect(main?.className).toContain('items-center')
    expect(main?.className).toContain('justify-center')
  })

  it('merges a custom className', () => {
    render(
      <CenteredMain className="my-custom-class">
        <span>Content</span>
      </CenteredMain>,
    )
    const main = screen.getByText('Content').closest('main')
    expect(main?.className).toContain('my-custom-class')
  })
})
