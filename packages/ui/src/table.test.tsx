import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Table, TableBody, TableCell, TableHeader, TableRow } from './table'

describe('Table composition', () => {
  it('renders a header and rows together', () => {
    render(
      <Table>
        <TableHeader>
          <span>Name</span>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Acme Inc.</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    )

    expect(screen.getByText('Name')).toBeTruthy()
    expect(screen.getByText('Acme Inc.')).toBeTruthy()
  })

  it('gives the table the border/radius treatment', () => {
    render(<Table data-testid="table">content</Table>)
    const el = screen.getByTestId('table')
    expect(el.className).toContain('rounded-lg')
    expect(el.className).toContain('border-border')
  })

  it('gives the header a raised surface and bottom border', () => {
    render(<TableHeader data-testid="header">Name</TableHeader>)
    const el = screen.getByTestId('header')
    expect(el.className).toContain('bg-surface-2')
    expect(el.className).toContain('border-b')
  })

  it('gives rows a hover treatment and drops the border on the last one', () => {
    render(
      <TableBody>
        <TableRow data-testid="row-1">First</TableRow>
        <TableRow data-testid="row-2">Second</TableRow>
      </TableBody>,
    )
    expect(screen.getByTestId('row-1').className).toContain(
      'hover:bg-surface-2',
    )
    expect(screen.getByTestId('row-2').className).toContain('last:border-b-0')
  })

  it('merges a custom className onto a cell', () => {
    render(<TableCell className="max-[760px]:order-1">Value</TableCell>)
    expect(screen.getByText('Value').className).toContain('max-[760px]:order-1')
  })
})
