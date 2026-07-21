import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Select } from './select'

const OPTIONS = [
  { value: 'txt', label: 'TXT record' },
  { value: 'http', label: 'HTTP file' },
]

describe('Select', () => {
  it('associates the label with the select and renders every option', () => {
    render(<Select label="Verification method" options={OPTIONS} />)
    const select = screen.getByLabelText('Verification method')
    expect(screen.getByRole('option', { name: 'TXT record' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'HTTP file' })).toBeTruthy()
    expect(select.tagName).toBe('SELECT')
  })

  it('renders a filled value', () => {
    render(
      <Select
        label="Verification method"
        options={OPTIONS}
        defaultValue="http"
      />,
    )
    expect(screen.getByLabelText('Verification method')).toHaveProperty(
      'value',
      'http',
    )
  })

  it('marks the select disabled', () => {
    render(<Select label="Verification method" options={OPTIONS} disabled />)
    expect(screen.getByLabelText('Verification method')).toHaveProperty(
      'disabled',
      true,
    )
  })

  it('renders an inline error message described by the select', () => {
    render(
      <Select
        label="Verification method"
        options={OPTIONS}
        error="Choose a method"
      />,
    )
    const select = screen.getByLabelText('Verification method')
    expect(select.getAttribute('aria-invalid')).toBe('true')
    const errorId = select.getAttribute('aria-describedby')
    expect(errorId).toBeTruthy()
    expect(screen.getByText('Choose a method').id).toBe(errorId)
  })

  it('merges a custom className', () => {
    render(
      <Select
        label="Verification method"
        options={OPTIONS}
        className="my-custom-class"
      />,
    )
    expect(screen.getByLabelText('Verification method').className).toContain(
      'my-custom-class',
    )
  })
})
