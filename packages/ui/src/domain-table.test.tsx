import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import {
  DomainTable,
  DomainTableHead,
  DomainTableRow,
  DomainTableRowSkeleton,
} from './domain-table'
import { ProviderBadge } from './badge'

describe('DomainTableHead', () => {
  it('renders the column labels and hides under the collapse breakpoint', () => {
    render(<DomainTableHead data-testid="head" />)
    expect(screen.getByText('Domain')).toBeTruthy()
    expect(screen.getByText('Provider')).toBeTruthy()
    expect(screen.getByText('Status')).toBeTruthy()
    expect(screen.getByText('Last checked')).toBeTruthy()
    expect(screen.getByTestId('head').className).toContain('max-[760px]:hidden')
  })
})

describe('DomainTableRow', () => {
  it('renders name, status, and last-checked time', () => {
    render(
      <DomainTable>
        <DomainTableRow
          statusTone="success"
          statusLabel="Verified"
          name="acme.co"
          provider={<ProviderBadge>Cloudflare</ProviderBadge>}
          lastChecked="2 min ago"
        />
      </DomainTable>,
    )
    expect(screen.getByText('acme.co')).toBeTruthy()
    expect(screen.getAllByText('Verified').length).toBeGreaterThan(0)
    expect(screen.getByText('Cloudflare')).toBeTruthy()
  })

  it('falls back to an em dash when no provider is given', () => {
    render(
      <DomainTableRow
        statusTone="neutral"
        statusLabel="Not found"
        name="nxdomain.test"
        lastChecked="1 hour ago"
      />,
    )
    expect(screen.getByText('—')).toBeTruthy()
  })

  it('applies the active-row treatment and keeps it under hover', () => {
    render(
      <DomainTableRow
        statusTone="success"
        statusLabel="Verified"
        name="acme.co"
        lastChecked="2 min ago"
        active
        data-testid="row"
      />,
    )
    const row = screen.getByTestId('row')
    expect(row.className).toContain('bg-[var(--accent-soft)]')
    expect(row.className).toContain('hover:bg-[var(--accent-soft)]')
  })

  it('reorders columns and hides the chevron under the collapse breakpoint', () => {
    render(
      <DomainTableRow
        statusTone="success"
        statusLabel="Verified"
        name="acme.co"
        lastChecked="2 min ago"
        data-testid="row"
      />,
    )
    expect(screen.getByTestId('row').className).toContain('max-[760px]:flex')
  })

  it('calls onSelect on click and on Enter/Space keydown', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(
      <DomainTableRow
        statusTone="success"
        statusLabel="Verified"
        name="acme.co"
        lastChecked="2 min ago"
        onSelect={onSelect}
      />,
    )
    const row = screen.getByRole('button')
    await user.click(row)
    expect(onSelect).toHaveBeenCalledTimes(1)

    row.focus()
    await user.keyboard('{Enter}')
    expect(onSelect).toHaveBeenCalledTimes(2)

    await user.keyboard(' ')
    expect(onSelect).toHaveBeenCalledTimes(3)
  })
})

describe('DomainTableRowSkeleton', () => {
  it('renders placeholder bars without any text content', () => {
    render(<DomainTableRowSkeleton data-testid="skeleton" />)
    const el = screen.getByTestId('skeleton')
    expect(el.textContent).toBe('')
    expect(el.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
  })
})
