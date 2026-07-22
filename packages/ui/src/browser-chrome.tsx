import type { HTMLAttributes, ReactNode } from 'react'
import { Lock } from 'lucide-react'
import { Card } from './card'

export interface BrowserChromeProps extends HTMLAttributes<HTMLDivElement> {
  /** Rendered mono in the pill-shaped address bar, next to a padlock icon. */
  url: ReactNode
}

export function BrowserChrome({ url, children, ...props }: BrowserChromeProps) {
  return (
    <Card {...props}>
      <div className="flex items-center gap-3 border-b border-border bg-surface-2 px-4 py-3">
        <div className="flex shrink-0 gap-1.5" aria-hidden="true">
          <span className="h-2.5 w-2.5 rounded-full bg-border-strong" />
          <span className="h-2.5 w-2.5 rounded-full bg-border-strong" />
          <span className="h-2.5 w-2.5 rounded-full bg-border-strong" />
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full bg-surface-3 px-4 py-1.5">
          <Lock
            aria-hidden="true"
            size={12}
            className="shrink-0 text-success"
          />
          <span className="truncate font-mono text-xs text-faint-foreground">
            {url}
          </span>
        </div>
      </div>
      {children}
    </Card>
  )
}
