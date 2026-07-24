import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PathChooser } from './path-chooser'

const OPTIONS = [
  {
    id: 'api',
    icon: <svg data-testid="icon-api" />,
    label: 'API',
    sub: 'Full control, your UI',
  },
  {
    id: 'hosted',
    icon: <svg data-testid="icon-hosted" />,
    label: 'Hosted page',
    sub: 'We host the UI',
  },
]

describe('PathChooser', () => {
  it('renders every option as a tab', () => {
    render(<PathChooser options={OPTIONS} value="api" onChange={() => {}} />)
    expect(screen.getByRole('tab', { name: /API/ })).toBeTruthy()
    expect(screen.getByRole('tab', { name: /Hosted page/ })).toBeTruthy()
  })

  it('marks the active option as selected', () => {
    render(<PathChooser options={OPTIONS} value="hosted" onChange={() => {}} />)
    expect(
      screen.getByRole('tab', { name: /API/ }).getAttribute('aria-selected'),
    ).toBe('false')
    expect(
      screen
        .getByRole('tab', { name: /Hosted page/ })
        .getAttribute('aria-selected'),
    ).toBe('true')
  })

  it('calls onChange with the clicked option id', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<PathChooser options={OPTIONS} value="api" onChange={onChange} />)
    await user.click(screen.getByRole('tab', { name: /Hosted page/ }))
    expect(onChange).toHaveBeenCalledWith('hosted')
  })

  it('never wraps or stacks — stays one row and scrolls horizontally instead', () => {
    render(
      <PathChooser
        options={OPTIONS}
        value="api"
        onChange={() => {}}
        data-testid="chooser"
      />,
    )
    expect(screen.getByTestId('chooser').className).toContain('flex-nowrap')
    expect(screen.getByTestId('chooser').className).not.toContain('flex-wrap')
    expect(screen.getByTestId('chooser').className).not.toContain('flex-col')
    expect(screen.getByTestId('chooser').className).toContain('overflow-x-auto')
    // Fixed-width, non-shrinking cards — the row scrolls instead of
    // squeezing cards down to nothing at narrow widths.
    expect(screen.getByRole('tab', { name: /API/ }).className).toContain(
      'shrink-0',
    )
  })

  it('keeps option labels on a single line', () => {
    render(<PathChooser options={OPTIONS} value="api" onChange={() => {}} />)
    expect(screen.getByText('Full control, your UI').className).toContain(
      'truncate',
    )
  })
})
