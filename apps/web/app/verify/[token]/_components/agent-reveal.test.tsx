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
    render(
      <AgentReveal domain="acme.co" records={RECORDS} provider="unknown" />,
    )
    expect(
      screen.getByText(
        /host _acme-challenge\.acme\.co, value acme-verify=abc123/,
      ),
    ).toBeTruthy()
    expect(screen.queryByText(/mcp/i)).toBeNull()
  })

  it('names the detected provider and links its setup guide', () => {
    render(
      <AgentReveal domain="acme.co" records={RECORDS} provider="cloudflare" />,
    )
    expect(
      screen.getByText(/DNS for acme\.co is on Cloudflare/),
    ).toBeTruthy()
    expect(
      screen.getByText(
        /https:\/\/domainproof\.dev\/docs\/add-txt-record-cloudflare/,
      ),
    ).toBeTruthy()
  })

  it('falls back to the generic guide and no provider name when unknown', () => {
    render(
      <AgentReveal domain="acme.co" records={RECORDS} provider="unknown" />,
    )
    expect(screen.getByText(/Use my DNS provider access to add it\./)).toBeTruthy()
    expect(
      screen.getByText(/https:\/\/domainproof\.dev\/docs\/add-txt-record\b/),
    ).toBeTruthy()
  })

  it('renders nothing when there is no record to compose a prompt from', () => {
    const { container } = render(
      <AgentReveal domain="acme.co" records={[]} provider="unknown" />,
    )
    expect(container.firstChild).toBeNull()
  })
})
