import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SegmentedControl } from './segmented-control'

const OPTIONS = [
  { value: 'test', label: 'Test', tone: 'warning' as const },
  { value: 'live', label: 'Live', tone: 'success' as const },
]

describe('SegmentedControl', () => {
  it('renders every option as a tab', () => {
    render(
      <SegmentedControl options={OPTIONS} value="test" onChange={() => {}} />,
    )
    expect(screen.getByRole('tab', { name: /Test/ })).toBeTruthy()
    expect(screen.getByRole('tab', { name: /Live/ })).toBeTruthy()
  })

  it('marks the active option as selected', () => {
    render(
      <SegmentedControl options={OPTIONS} value="live" onChange={() => {}} />,
    )
    expect(
      screen.getByRole('tab', { name: /Test/ }).getAttribute('aria-selected'),
    ).toBe('false')
    expect(
      screen.getByRole('tab', { name: /Live/ }).getAttribute('aria-selected'),
    ).toBe('true')
  })

  it('calls onChange with the clicked option value', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <SegmentedControl options={OPTIONS} value="test" onChange={onChange} />,
    )
    await user.click(screen.getByRole('tab', { name: /Live/ }))
    expect(onChange).toHaveBeenCalledWith('live')
  })

  it('renders a decorative dot for a toned option, none for a plain one', () => {
    const options = [...OPTIONS, { value: 'all', label: 'All' }]
    render(
      <SegmentedControl options={options} value="all" onChange={() => {}} />,
    )
    const allTab = screen.getByRole('tab', { name: 'All' })
    expect(allTab.querySelector('[aria-hidden="true"]')).toBeNull()
    const testTab = screen.getByRole('tab', { name: /Test/ })
    expect(testTab.querySelector('[aria-hidden="true"]')).not.toBeNull()
  })
})
