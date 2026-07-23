import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AgentReveal } from './agent-reveal'

const RECORDS = [
  {
    label: '_acme-challenge.acme.co',
    type: 'TXT',
    value: 'acme-verify=abc123',
  },
]

describe('AgentReveal', () => {
  it('bakes the real host and value into a copy-ready prompt, no MCP setup step', () => {
    render(<AgentReveal domain="acme.co" records={RECORDS} />)
    expect(
      screen.getByText(
        /Add this TXT record to acme\.co: host _acme-challenge\.acme\.co, value acme-verify=abc123 — use my DNS provider access\./,
      ),
    ).toBeTruthy()
    expect(screen.queryByText(/mcp/i)).toBeNull()
  })

  it('renders nothing when there is no record to compose a prompt from', () => {
    const { container } = render(<AgentReveal domain="acme.co" records={[]} />)
    expect(container.firstChild).toBeNull()
  })
})
