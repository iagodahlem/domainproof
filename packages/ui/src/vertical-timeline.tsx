import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from './cn'

export type TimelineStepStatus = 'done' | 'current' | 'upcoming'

export interface VerticalTimelineStep {
  id: string
  status: TimelineStepStatus
  /** Number or icon rendered inside the node — callers decide (e.g. a checkmark once done). */
  node: ReactNode
  title: ReactNode
  meta?: ReactNode
  description?: ReactNode
  /** Extra content indented under the step, e.g. a code sample or action button. */
  content?: ReactNode
}

export interface VerticalTimelineProps extends HTMLAttributes<HTMLDivElement> {
  steps: VerticalTimelineStep[]
}

export function VerticalTimeline({
  steps,
  className,
  ...props
}: VerticalTimelineProps) {
  return (
    <div className={cn('flex flex-col', className)} {...props}>
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1
        return (
          <div
            key={step.id}
            className={cn('relative flex gap-4', !isLast && 'pb-8')}
          >
            <div className="flex w-[28px] flex-shrink-0 flex-col items-center">
              <span
                className={cn(
                  'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border-2 border-border-strong bg-surface font-mono text-[length:var(--text-xs)] font-bold text-text-faint',
                  step.status === 'done' &&
                    'border-success bg-success text-success-foreground',
                  step.status === 'current' &&
                    'border-accent text-accent shadow-current',
                )}
              >
                {step.node}
              </span>
              {!isLast ? (
                <span
                  className={cn(
                    'mt-2 min-h-[16px] w-[2px] flex-1 bg-border-strong',
                    step.status === 'done' && 'bg-success',
                  )}
                />
              ) : null}
            </div>
            <div className="min-w-0 flex-1 pt-[2px]">
              <div
                className={cn(
                  'text-[length:var(--text-base)] font-heading',
                  step.status === 'current' && 'text-accent',
                )}
              >
                {step.title}
              </div>
              {step.meta ? (
                <div className="mt-[2px] font-mono text-[length:var(--text-2xs)] text-text-faint">
                  {step.meta}
                </div>
              ) : null}
              {step.description ? (
                <div
                  className={cn(
                    'mt-2 max-w-[54ch] text-[length:var(--text-sm)] leading-body text-text-muted',
                    !isLast && 'mb-4',
                  )}
                >
                  {step.description}
                </div>
              ) : null}
              {step.content ? (
                <div className="flex flex-col gap-3">{step.content}</div>
              ) : null}
            </div>
          </div>
        )
      })}
    </div>
  )
}
