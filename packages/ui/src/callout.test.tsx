import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Callout } from './callout'

describe('Callout', () => {
  it('renders its content', () => {
    render(<Callout>See the guide for your provider</Callout>)
    expect(screen.getByText('See the guide for your provider')).toBeTruthy()
  })

  it('defaults to a solid neutral emphasis', () => {
    render(<Callout>Detail view for acme.co</Callout>)
    const el = screen.getByText('Detail view for acme.co')
    expect(el.className).toContain('bg-surface-2')
    expect(el.className).toContain('rounded-lg')
  })

  it('applies the warning tone fill', () => {
    render(<Callout tone="warning">Field names differ slightly</Callout>)
    expect(screen.getByText('Field names differ slightly').className).toContain(
      'bg-warning-soft',
    )
  })

  it('applies the accent tone fill', () => {
    render(
      <Callout tone="accent">Your nameservers look like Cloudflare</Callout>,
    )
    expect(
      screen.getByText('Your nameservers look like Cloudflare').className,
    ).toContain('bg-accent-soft')
  })

  it('applies the danger tone fill', () => {
    render(<Callout tone="danger">Deleting this domain is permanent</Callout>)
    expect(
      screen.getByText('Deleting this domain is permanent').className,
    ).toContain('bg-danger-soft')
  })

  it('switches to the dashed emphasis with no fill', () => {
    render(<Callout emphasis="dashed">What's happening under the hood</Callout>)
    const el = screen.getByText("What's happening under the hood")
    expect(el.className).toContain('border-dashed')
    expect(el.className).not.toContain('bg-surface-2')
  })
})
