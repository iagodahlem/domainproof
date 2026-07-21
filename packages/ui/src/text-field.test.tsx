import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TextField } from './text-field'

describe('TextField', () => {
  it('associates the label with the input', () => {
    render(<TextField label="Domain" placeholder="acme.co" />)
    const input = screen.getByLabelText('Domain')
    expect(input.getAttribute('placeholder')).toBe('acme.co')
  })

  it('renders a filled value', () => {
    render(<TextField label="Domain" defaultValue="acme.co" />)
    expect(screen.getByLabelText('Domain')).toHaveProperty('value', 'acme.co')
  })

  it('marks the input disabled', () => {
    render(<TextField label="Domain" disabled />)
    expect(screen.getByLabelText('Domain')).toHaveProperty('disabled', true)
  })

  it('renders an inline error message described by the input', () => {
    render(<TextField label="Webhook URL" error="Must be a valid URL" />)
    const input = screen.getByLabelText('Webhook URL')
    expect(input.getAttribute('aria-invalid')).toBe('true')
    const errorId = input.getAttribute('aria-describedby')
    expect(errorId).toBeTruthy()
    expect(screen.getByText('Must be a valid URL').id).toBe(errorId)
  })

  it('has no invalid state or description when there is no error', () => {
    render(<TextField label="Domain" />)
    const input = screen.getByLabelText('Domain')
    expect(input.getAttribute('aria-invalid')).toBeNull()
    expect(input.getAttribute('aria-describedby')).toBeNull()
  })

  it('merges a custom className', () => {
    render(<TextField label="Domain" className="my-custom-class" />)
    expect(screen.getByLabelText('Domain').className).toContain(
      'my-custom-class',
    )
  })

  it('renders a trailing action beside the input', () => {
    render(
      <TextField
        label="Project name"
        trailing={<button type="button">Save</button>}
      />,
    )
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy()
  })
})
