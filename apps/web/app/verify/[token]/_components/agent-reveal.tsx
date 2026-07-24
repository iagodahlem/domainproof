import { ChevronDown, Sparkles } from 'lucide-react'
import type { Provider } from '@domainproof/core'
import { CopyButton } from '@domainproof/ui'
import type { VerificationRecord } from '@/lib/api/frontend'
import { absoluteGuideUrl, guideForProvider } from '../_lib/provider-guide'

export interface AgentRevealProps {
  domain: string
  records: VerificationRecord[]
  provider: Provider
}

/**
 * A collapsible "have an AI agent do it" reveal — deliberately MCP-free.
 * This audience has no DomainProof account or API key to hand an agent, and
 * our MCP server can't write DNS on anyone's behalf, so the only honest
 * on-ramp is a copy-ready prompt with this claim's real record values, its
 * detected DNS provider, and that provider's own setup guide baked in — for
 * an agent that already has the visitor's own DNS provider access, so it has
 * everything it needs without a back-and-forth. Native `<details>`/`<summary>`
 * needs no JS to open and is keyboard-operable out of the box.
 */
export function AgentReveal({ domain, records, provider }: AgentRevealProps) {
  const record = records[0]
  if (!record) return null

  const guide = guideForProvider(provider)
  const providerNote = guide.name
    ? ` DNS for ${domain} is on ${guide.name} — use my ${guide.name} access to add it.`
    : ' Use my DNS provider access to add it.'
  const prompt = `Add this TXT record to ${domain} to verify domain ownership: host ${record.label}, value ${record.value}.${providerNote} Steps: ${absoluteGuideUrl(guide)}`

  return (
    <details className="group overflow-hidden rounded-lg border border-border bg-surface">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 text-sm font-semibold [&::-webkit-details-marker]:hidden">
        <Sparkles
          aria-hidden="true"
          size={16}
          className="shrink-0 text-accent"
        />
        Have an AI agent do it
        <ChevronDown
          aria-hidden="true"
          size={14}
          className="ml-auto shrink-0 text-faint-foreground transition-transform duration-150 group-open:rotate-180"
        />
      </summary>
      <div className="flex flex-col gap-3 border-t border-border px-5 pt-4 pb-5">
        <div className="overflow-hidden rounded-md border border-border bg-background">
          <div className="border-b border-border bg-surface-2 px-3 py-2 font-mono text-2xs text-faint-foreground">
            Copy-ready prompt
          </div>
          <div className="relative p-4 pr-16">
            <p className="font-mono text-xs leading-code whitespace-pre-wrap break-words text-muted-foreground">
              {prompt}
            </p>
            <CopyButton
              value={prompt}
              size="icon"
              iconOnly
              aria-label="Copy prompt"
              className="absolute top-3 right-3"
            >
              Copy
            </CopyButton>
          </div>
        </div>
        <p className="text-2xs text-faint-foreground">
          Paste this to any AI agent or assistant that already has access to{' '}
          {domain}&apos;s DNS provider. It only shares the record above — not
          your DomainProof account.
        </p>
      </div>
    </details>
  )
}
