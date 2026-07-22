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

  it('sizes the label to content when labelWidth is content', () => {
    render(
      <RecordField
        label="Live key"
        value="dp_live_...ab12"
        labelWidth="content"
      />,
    )
    const label = screen.getByText('Live key')
    expect(label.className).not.toContain('w-23')
    expect(label.className).toContain('w-auto')
  })

  it('truncates the value to a single line when truncateValue is set, keeping the full value in title and copy', () => {
    const fullValue = 'dp_test_v2gdk3kr4nm7_yij25nsgbvw3vsz5pwyyliavwa'
    render(
      <RecordField label="Test key" value={fullValue} truncateValue copyable />,
    )
    const value = screen.getByText(fullValue)
    expect(value.className).toContain('truncate')
    expect(value.className).not.toContain('break-all')
    expect(value.getAttribute('title')).toBe(fullValue)
  })

  it('renders a custom action instead of the copy button', () => {
    render(
      <RecordField
        label="Live key"
        value="dp_live_...ab12"
        copyable
        action={<button type="button">Reveal</button>}
      />,
    )
    expect(screen.getByRole('button', { name: 'Reveal' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Copy' })).toBeNull()
  })
})
