'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import { CopyButton } from './copy-button'
import { cn } from './cn'

export interface CodePanelTab {
  id: string
  label: ReactNode
  /** Rendered code, optionally with <CodeToken> spans for syntax color. */
  code: ReactNode
  /** Raw text copied to the clipboard — kept separate since `code` may carry markup. */
  copyValue: string
}

export interface CodePanelProps {
  tabs: CodePanelTab[]
  defaultTabId?: string
  className?: string
}

export function CodePanel({ tabs, defaultTabId, className }: CodePanelProps) {
  const [activeId, setActiveId] = useState(defaultTabId ?? tabs[0]?.id)
  const active = tabs.find((tab) => tab.id === activeId) ?? tabs[0]

  return (
    <div
      className={cn(
        'min-w-0 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg)]',
        className,
      )}
    >
      <div className="flex items-center gap-[var(--space-1)] overflow-x-auto border-b border-[var(--border)] bg-[var(--surface-2)] px-[var(--space-3)] py-[var(--space-2)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={tab.id === active?.id}
            onClick={() => setActiveId(tab.id)}
            className={cn(
              'rounded-[var(--radius-full)] px-[var(--space-3)] py-[var(--space-1)] font-mono text-[length:var(--text-xs)] font-[var(--font-weight-semibold)] whitespace-nowrap text-[color:var(--text-faint)] transition-colors duration-[var(--duration-fast)] hover:text-[color:var(--text)]',
              tab.id === active?.id &&
                'bg-[var(--surface-3)] text-[color:var(--text)]',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="relative">
        {tabs.map((tab) => (
          <pre
            key={tab.id}
            className={cn(
              'm-0 overflow-x-auto p-[var(--space-4)] pr-[calc(var(--space-4)+4.5rem)] font-mono text-[length:var(--text-xs)] leading-[var(--leading-code)] break-words whitespace-pre-wrap max-[480px]:pr-[calc(var(--space-4)+2.25rem)]',
              tab.id !== active?.id && 'hidden',
            )}
          >
            {tab.code}
          </pre>
        ))}
        {active ? (
          <CopyButton
            value={active.copyValue}
            size="sm"
            className="absolute top-[var(--space-3)] right-[var(--space-3)]"
          >
            <span className="max-[480px]:hidden">Copy</span>
          </CopyButton>
        ) : null}
      </div>
    </div>
  )
}

export type CodeTokenKind = 'comment' | 'string' | 'keyword'

const TOKEN_TONE_CLASSES: Record<CodeTokenKind, string> = {
  comment: 'text-[color:var(--text-faint)]',
  string: 'text-[color:var(--success)]',
  keyword: 'text-[color:var(--accent)]',
}

export function CodeToken({
  kind,
  children,
}: {
  kind: CodeTokenKind
  children: ReactNode
}) {
  return <span className={TOKEN_TONE_CLASSES[kind]}>{children}</span>
}
