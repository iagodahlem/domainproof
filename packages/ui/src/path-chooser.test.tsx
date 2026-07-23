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

  it('stacks into full-width cards under 780px of its own rendered width, not the viewport', () => {
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
    expect(screen.getByTestId('chooser').className).toContain(
      '@max-[780px]:flex-col',
    )
    expect(screen.getByRole('tab', { name: /API/ }).className).toContain(
      '@max-[780px]:w-full',
    )
    // A container query only applies once an ancestor declares the
    // containment context — without this, `@max-[780px]` would never match.
    expect(screen.getByTestId('chooser').parentElement?.className).toContain(
      '@container',
    )
  })

  it('keeps option labels on a single line', () => {
    render(<PathChooser options={OPTIONS} value="api" onChange={() => {}} />)
    expect(screen.getByText('Full control, your UI').className).toContain(
      'truncate',
    )
  })
})
