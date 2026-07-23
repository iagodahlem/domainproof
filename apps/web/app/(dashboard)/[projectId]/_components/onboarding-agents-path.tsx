'use client'

import { useState } from 'react'
import { Bot } from 'lucide-react'
import { Badge, CopyButton, Select } from '@domainproof/ui'
import type { VerticalTimelineStep } from '@domainproof/ui'
import { domainStatusPresentation } from '@/lib/domain-status'
import { formatRelativeTime } from '@/lib/format-relative-time'
import { useWatchDomainsList } from '@/lib/query/domains'
import { SANDBOX_DOMAIN } from './onboarding-constants'
import { useRefreshOnVerified } from './onboarding-storage'

type AgentClient = 'claude' | 'cursor' | 'generic'

const AGENT_OPTIONS = [
  { value: 'claude', label: 'Claude Code' },
  { value: 'cursor', label: 'Cursor' },
  { value: 'generic', label: 'Generic MCP client' },
]

const AGENT_TARGET_LABEL: Record<AgentClient, string> = {
  claude: 'Terminal',
  cursor: '~/.cursor/mcp.json',
  generic: 'mcp.json',
}

const MCP_JSON_CONFIG = `{
  "mcpServers": {
    "domainproof": {
      "command": "npx",
      "args": ["-y", "@domainproof/mcp"],
      "env": {
        "DOMAINPROOF_API_KEY": "dp_test_••••…"
      }
    }
  }
}`

const AGENT_SNIPPETS: Record<AgentClient, string> = {
  claude:
    'claude mcp add domainproof -e DOMAINPROOF_API_KEY=dp_test_••••… -- npx -y @domainproof/mcp',
  cursor: MCP_JSON_CONFIG,
  generic: MCP_JSON_CONFIG,
}

const ASK_AGENT_PROMPT = `Claim and verify ${SANDBOX_DOMAIN} with DomainProof, then show me the events`

/**
 * Step 1's body — an agent-client picker driving a single relabeled code
 * block, not a tab strip (that's `CodePanel`'s job elsewhere): only one
 * config is ever "the" one for whichever client is selected, there's no
 * reason to compare two side by side. The MCP server is a stdio process
 * (`npx -y @domainproof/mcp`, authenticated via an env var), not an HTTP
 * endpoint — matching `packages/mcp`'s actual README, not the
 * `https://mcp.domainproof.dev/mcp` HTTP-transport shape an earlier
 * design pass sketched before the server shipped as a stdio wrapper
 * around `@domainproof/sdk` instead.
 */
function McpConnectStep() {
  const [agent, setAgent] = useState<AgentClient>('claude')
  const snippet = AGENT_SNIPPETS[agent]

  return (
    <>
      <div className="max-w-80">
        <Select
          label="Agent"
          options={AGENT_OPTIONS}
          value={agent}
          onChange={(event) => setAgent(event.target.value as AgentClient)}
        />
      </div>
      <div className="overflow-hidden rounded-md border border-border bg-background">
        <div className="flex items-center justify-between gap-3 border-b border-border bg-surface-2 px-3 py-2 font-mono text-2xs text-faint-foreground">
          {AGENT_TARGET_LABEL[agent]}
        </div>
        <div className="relative">
          <pre className="overflow-x-auto p-4 pr-22 font-mono text-xs leading-code break-words whitespace-pre-wrap">
            {snippet}
          </pre>
          <CopyButton
            value={snippet}
            size="sm"
            className="absolute top-3 right-3"
          >
            Copy
          </CopyButton>
        </div>
      </div>
    </>
  )
}

/** Step 2's body — the one-line prompt that does the whole job, ready to paste into any agent chat. */
function AskAgentStep() {
  return (
    <>
      <div className="flex min-w-0 items-center gap-2 rounded-md border border-border bg-background px-3 py-2 font-mono text-2xs text-muted-foreground">
        <Bot aria-hidden="true" size={13} className="shrink-0" />
        <span className="min-w-0 flex-1 truncate">{ASK_AGENT_PROMPT}</span>
        <CopyButton
          value={ASK_AGENT_PROMPT}
          size="sm"
          iconOnly
          aria-label="Copy prompt"
          className="shrink-0"
        >
          Copy prompt
        </CopyButton>
      </div>
      <p className="text-2xs text-faint-foreground">
        Scoped to your test key — the agent can&rsquo;t touch real DNS or real
        domains from here.
      </p>
    </>
  )
}

/**
 * Step 3's body — polls the domains list (bounded, same interval ladder as
 * the rest of the dashboard's live queries) for as long as this component
 * stays mounted, i.e. for as long as the Agents & CLI tab is the active
 * one; switching tabs unmounts it and the polling stops with it. Shows
 * whichever domain is most recently touched — the natural real-data
 * signal for "the agent's claim landed," with no separate flag to track.
 */
function WatchItLandStep({ projectId }: { projectId: string }) {
  const { data: domains } = useWatchDomainsList(projectId, 'test', true)
  const mostRecent = domains?.[0]
  const presentation = mostRecent
    ? domainStatusPresentation(mostRecent.status)
    : null
  useRefreshOnVerified(mostRecent?.status)

  return (
    <>
      {mostRecent && presentation ? (
        <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface-2 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">
              {mostRecent.domain}
            </p>
            <p className="text-xs text-faint-foreground">
              {formatRelativeTime(mostRecent.updatedAt)}
            </p>
          </div>
          <Badge tone={presentation.tone} className="shrink-0">
            {presentation.label}
          </Badge>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Watching for a domain claim — this updates the moment your agent makes
          one, no reload needed.
        </p>
      )}
      <p className="text-2xs text-faint-foreground">
        Ask the agent to check status, or open{' '}
        <a href={`/${projectId}/domains`} className="text-accent underline">
          Domains
        </a>{' '}
        yourself — same data either way.
      </p>
    </>
  )
}

export interface AgentsPathStepsInput {
  projectId: string
}

/**
 * The Agents & CLI tab's own 3 steps — connect, instruct, confirm — rather
 * than inheriting "claim your first domain" from the other three tabs: the
 * agent claims the domain itself once connected, so a human-facing curl
 * example was never the right step 1 here.
 */
export function buildAgentsPathSteps({
  projectId,
}: AgentsPathStepsInput): VerticalTimelineStep[] {
  return [
    {
      id: 'connect-mcp',
      status: 'current',
      node: '1',
      title: 'Connect the MCP',
      description:
        'Add the DomainProof MCP server to your agent or terminal — pick your client below.',
      content: <McpConnectStep />,
    },
    {
      id: 'ask-agent',
      status: 'upcoming',
      node: '2',
      title: 'Ask your agent',
      description:
        'One prompt does the whole job — claim the domain, add the record, and verify it.',
      content: <AskAgentStep />,
    },
    {
      id: 'watch-it-land',
      status: 'upcoming',
      node: '3',
      title: 'Watch it land',
      description:
        "The agent's already checking — Overview reflects it live, no dashboard trip required.",
      content: <WatchItLandStep projectId={projectId} />,
    },
  ]
}
