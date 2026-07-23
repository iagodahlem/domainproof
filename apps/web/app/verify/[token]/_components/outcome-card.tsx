import { AlertCircle, Check } from 'lucide-react'
import { Callout, cn, type CalloutTone } from '@domainproof/ui'

export interface OutcomeCardCheck {
  expected?: string
  detected?: string[]
}

export interface OutcomeCardProps {
  /** 'pending' has no boxed rendering — callers only mount this once something notable (resolved or needing attention) has happened. */
  tone: Exclude<CalloutTone, 'accent' | 'neutral'>
  heading: string
  body: string
  /** Pass the check only when the view calls for the expected/found diff — omit otherwise. */
  check: OutcomeCardCheck | null
}

const ICON_WRAP_CLASS_BY_TONE: Record<OutcomeCardProps['tone'], string> = {
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning-strong',
  danger: 'bg-danger-soft text-danger',
}

export function OutcomeCard({ tone, heading, body, check }: OutcomeCardProps) {
  const Icon = tone === 'success' ? Check : AlertCircle
  return (
    <Callout tone={tone} className="flex flex-col items-start">
      <span
        className={cn(
          'mb-4 flex h-8.5 w-8.5 items-center justify-center rounded-full',
          ICON_WRAP_CLASS_BY_TONE[tone],
        )}
      >
        <Icon aria-hidden="true" size={17} />
      </span>
      <h3 className="mb-2 text-xl leading-heading-loose font-heading text-foreground">
        {heading}
      </h3>
      <p className="max-w-[50ch] text-sm text-muted-foreground">{body}</p>
      {check ? (
        <div className="mt-4 flex w-full flex-col gap-2 rounded-md border border-border bg-background p-4 font-mono text-xs">
          <div className="flex gap-2">
            <span className="w-17 flex-shrink-0 text-faint-foreground">
              Expected
            </span>
            <span className="break-all text-muted-foreground">
              {check.expected}
            </span>
          </div>
          <div className="flex gap-2">
            <span className="w-17 flex-shrink-0 text-faint-foreground">
              Found
            </span>
            <span className="break-all text-danger">
              {check.detected && check.detected.length > 0
                ? check.detected.join(', ')
                : '—'}
            </span>
          </div>
        </div>
      ) : null}
    </Callout>
  )
}
