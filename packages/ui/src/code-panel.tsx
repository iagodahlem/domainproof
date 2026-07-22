'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import { cva } from 'class-variance-authority'
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
        'min-w-0 overflow-hidden rounded-lg border border-border bg-background',
        className,
      )}
    >
      <div className="flex items-center gap-1 overflow-x-auto border-b border-border bg-surface-2 px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={tab.id === active?.id}
            onClick={() => setActiveId(tab.id)}
            className={cn(
              'rounded-full px-3 py-1 font-mono text-xs font-semibold whitespace-nowrap text-faint-foreground transition-colors duration-150 hover:text-foreground',
              tab.id === active?.id && 'bg-surface-3 text-foreground',
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
              'm-0 overflow-x-auto p-4 pr-22 font-mono text-xs leading-code break-words whitespace-pre-wrap max-[480px]:pr-13',
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
            className="absolute top-3 right-3"
          >
            <span className="max-[480px]:hidden">Copy</span>
          </CopyButton>
        ) : null}
      </div>
    </div>
  )
}

export type CodeTokenKind = 'comment' | 'string' | 'keyword'

const codeTokenVariants = cva('', {
  variants: {
    kind: {
      comment: 'text-faint-foreground',
      string: 'text-success',
      keyword: 'text-accent',
    },
  },
})

export function CodeToken({
  kind,
  children,
}: {
  kind: CodeTokenKind
  children: ReactNode
}) {
  return <span className={codeTokenVariants({ kind })}>{children}</span>
}
