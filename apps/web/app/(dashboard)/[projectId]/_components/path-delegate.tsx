'use client'

import { ChevronDown } from 'lucide-react'
import { CopyButton } from '@domainproof/ui'

export interface PathDelegateProps {
  /** The copy-ready agent prompt for this integration path. */
  prompt: string
}

/**
 * The quiet "hand this path to your agent" disclosure beside a path's own
 * one-line description — a plain `<details>/<summary>` (same mechanism as
 * `VerificationLog`'s technical-detail toggle), deliberately text-only and
 * borderless when closed so it doesn't compete with the path chooser above
 * it for attention. Not rendered on the Agents & CLI tab, which already
 * *is* the delegation path.
 */
export function PathDelegate({ prompt }: PathDelegateProps) {
  return (
    <details className="group flex-shrink-0">
      <summary className="flex cursor-pointer list-none items-center gap-2 py-1 text-xs font-semibold whitespace-nowrap text-faint-foreground transition-colors duration-150 hover:text-muted-foreground [&::-webkit-details-marker]:hidden">
        Prefer to delegate? Hand this path to your agent
        <ChevronDown
          aria-hidden="true"
          size={13}
          className="transition-transform duration-150 group-open:rotate-180"
        />
      </summary>
      <div className="mt-3 max-w-[54ch] border-t border-dashed border-border-strong pt-4">
        <pre className="overflow-x-auto rounded-md border border-border bg-background p-4 font-mono text-xs leading-code break-words whitespace-pre-wrap">
          {prompt}
        </pre>
        <CopyButton value={prompt} size="sm" className="mt-3">
          Copy prompt
        </CopyButton>
      </div>
    </details>
  )
}
