import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RecordField } from './record-field'

describe('RecordField', () => {
  it('renders the label and value', () => {
    render(
      <RecordField label="Host / Name" value="_acmeapp-challenge.acme.co" />,
    )
    expect(screen.getByText('Host / Name')).toBeTruthy()
    expect(screen.getByText('_acmeapp-challenge.acme.co')).toBeTruthy()
  })

  it('does not render a copy button by default', () => {
    render(<RecordField label="Host" value="acme.co" />)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('renders a copy button when copyable', () => {
    render(<RecordField label="Host" value="acme.co" copyable />)
    expect(screen.getByRole('button', { name: 'Copy' })).toBeTruthy()
  })

  it('renders explain text when provided', () => {
    render(
      <RecordField
        label="Value"
        value="acmeapp-verify=8f2c9e1a"
        explain="A one-time token, generated for this request only."
      />,
    )
    expect(
      screen.getByText('A one-time token, generated for this request only.'),
    ).toBeTruthy()
  })

  it('applies the compact padding and smaller value size', () => {
    render(
      <RecordField label="Host" value="acme.co" compact data-testid="field" />,
    )
    const value = screen.getByText('acme.co')
    expect(value.className).toContain('text-sm')
    expect(screen.getByTestId('field').className).toContain('px-4')
  })

  it('collapses the label to an auto width under 560px', () => {
    render(<RecordField label="Value" value="acme.co" />)
    expect(screen.getByText('Value').className).toContain('max-[560px]:w-auto')
  })
})
