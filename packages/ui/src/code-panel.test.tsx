import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CodePanel, CodeToken } from './code-panel'

const TABS = [
  {
    id: 'curl',
    label: 'cURL',
    code: (
      <>
        <CodeToken kind="comment"># claim a domain</CodeToken>
        {'\n'}
        curl -X POST https://api.domainproof.dev/v1/domains
      </>
    ),
    copyValue: 'curl -X POST https://api.domainproof.dev/v1/domains',
  },
  {
    id: 'node',
    label: 'Node.js',
    code: (
      <>
        <CodeToken kind="keyword">import</CodeToken>{' '}
        <CodeToken kind="string">"domainproof"</CodeToken>
      </>
    ),
    copyValue: 'import "domainproof"',
  },
]

// userEvent.setup() installs its own clipboard stub, so the mock must be
// defined after setup() runs or setup() silently overwrites it.
function setupUserWithClipboard() {
  const user = userEvent.setup()
  const writeText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  })
  return { user, writeText }
}

describe('CodePanel', () => {
  it('shows the first tab active by default', () => {
    render(<CodePanel tabs={TABS} />)
    expect(
      screen.getByRole('tab', { name: 'cURL' }).getAttribute('aria-selected'),
    ).toBe('true')
    expect(
      screen
        .getByRole('tab', { name: 'Node.js' })
        .getAttribute('aria-selected'),
    ).toBe('false')
  })

  it('respects defaultTabId', () => {
    render(<CodePanel tabs={TABS} defaultTabId="node" />)
    expect(
      screen
        .getByRole('tab', { name: 'Node.js' })
        .getAttribute('aria-selected'),
    ).toBe('true')
  })

  it('switches the active tab on click', async () => {
    const { user } = setupUserWithClipboard()
    render(<CodePanel tabs={TABS} />)
    await user.click(screen.getByRole('tab', { name: 'Node.js' }))
    expect(
      screen
        .getByRole('tab', { name: 'Node.js' })
        .getAttribute('aria-selected'),
    ).toBe('true')
  })

  it('copies the active tab raw text, not the highlighted markup', async () => {
    const { user, writeText } = setupUserWithClipboard()
    render(<CodePanel tabs={TABS} />)
    await user.click(screen.getByRole('button', { name: 'Copy' }))
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(TABS[0]!.copyValue),
    )
  })
})
