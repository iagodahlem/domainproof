import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RecordCard } from './record-card'
import { RecordField } from './record-field'
import { Badge } from './badge'

describe('RecordCard', () => {
  it('renders a step chip, title, sub, and trailing content', () => {
    render(
      <RecordCard
        step="1"
        title="Add this DNS record"
        sub="Log in to where you manage acme.co's DNS."
        trailing={<Badge tone="accent">TXT</Badge>}
      >
        <RecordField label="Host" value="acme.co" />
      </RecordCard>,
    )
    expect(screen.getByText('1')).toBeTruthy()
    expect(screen.getByText('Add this DNS record')).toBeTruthy()
    expect(
      screen.getByText("Log in to where you manage acme.co's DNS."),
    ).toBeTruthy()
    expect(screen.getByText('TXT')).toBeTruthy()
  })

  it('renders headless — just field rows — when no title is given', () => {
    render(
      <RecordCard>
        <RecordField label="Host" value="acme.co" />
      </RecordCard>,
    )
    expect(screen.queryByText('Ownership record')).toBeNull()
    expect(screen.getByText('acme.co')).toBeTruthy()
  })

  it('applies the success step tone', () => {
    render(
      <RecordCard step="✓" stepTone="success" title="Ownership record">
        <RecordField label="Host" value="acme.co" />
      </RecordCard>,
    )
    expect(screen.getByText('✓').className).toContain('text-success')
  })
})
