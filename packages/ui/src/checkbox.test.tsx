import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Checkbox } from './checkbox'

describe('Checkbox', () => {
  it('associates the label with the checkbox', () => {
    render(<Checkbox label="Send me webhook retries" />)
    const checkbox = screen.getByLabelText('Send me webhook retries')
    expect(checkbox.tagName).toBe('INPUT')
    expect(checkbox.getAttribute('type')).toBe('checkbox')
  })

  it('renders unchecked by default', () => {
    render(<Checkbox label="Send me webhook retries" />)
    expect(screen.getByLabelText('Send me webhook retries')).toHaveProperty(
      'checked',
      false,
    )
  })

  it('renders checked', () => {
    render(<Checkbox label="Send me webhook retries" defaultChecked />)
    expect(screen.getByLabelText('Send me webhook retries')).toHaveProperty(
      'checked',
      true,
    )
  })

  it('marks the checkbox disabled', () => {
    render(<Checkbox label="Send me webhook retries" disabled />)
    expect(screen.getByLabelText('Send me webhook retries')).toHaveProperty(
      'disabled',
      true,
    )
  })

  it('merges a custom className onto the label', () => {
    render(
      <Checkbox label="Send me webhook retries" className="my-custom-class" />,
    )
    expect(
      screen.getByText('Send me webhook retries').closest('label')?.className,
    ).toContain('my-custom-class')
  })
})
