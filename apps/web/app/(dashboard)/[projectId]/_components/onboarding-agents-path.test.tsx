import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { buildAgentsPathSteps } from './onboarding-agents-path'

function renderConnectStep() {
  const steps = buildAgentsPathSteps({ projectId: 'proj_1' })
  const step = steps[0]
  if (!step) throw new Error('expected a connect-mcp step')
  render(step.content)
}

describe('McpConnectStep', () => {
  it('leads with the hosted HTTP transport for Claude Code, stdio as a one-line alternative', () => {
    renderConnectStep()
    expect(
      screen.getByText(/claude mcp add --transport http domainproof/),
    ).toBeTruthy()
    expect(screen.getByText(/mcp\.domainproof\.dev\/mcp/)).toBeTruthy()
    expect(
      screen.getByText(
        /claude mcp add domainproof -e DOMAINPROOF_API_KEY=.* -- npx -y @domainproof\/mcp/,
      ),
    ).toBeTruthy()
  })

  it('leads with the hosted HTTP JSON config for Cursor, stdio as a one-line alternative', async () => {
    const user = userEvent.setup()
    renderConnectStep()
    await user.selectOptions(screen.getByLabelText('Agent'), 'cursor')

    expect(screen.getByText(/"type": "http"/)).toBeTruthy()
    expect(screen.getByText(/mcp\.domainproof\.dev\/mcp/)).toBeTruthy()
    expect(screen.getByText('npx -y @domainproof/mcp')).toBeTruthy()
  })
})
