import type { HTMLAttributes, ReactNode } from 'react'
import { cva } from 'class-variance-authority'
import { cn } from './cn'

export type TimelineStepStatus = 'done' | 'current' | 'upcoming'

const timelineNodeVariants = cva(
  'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border-2 font-mono text-xs font-bold',
  {
    variants: {
      status: {
        done: 'border-success bg-success text-success-foreground',
        current: 'border-accent bg-surface text-accent shadow-current',
        upcoming: 'border-border-strong bg-surface text-faint-foreground',
      },
    },
  },
)

const timelineConnectorVariants = cva(
  'mt-2 min-h-4 w-0.5 flex-1 bg-border-strong',
  {
    variants: {
      status: {
        done: 'bg-success',
        current: '',
        upcoming: '',
      },
    },
  },
)

const timelineTitleVariants = cva('text-lg font-heading', {
  variants: {
    status: {
      done: '',
      current: 'text-accent',
      upcoming: '',
    },
  },
})

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
            <div className="flex w-7 flex-shrink-0 flex-col items-center">
              <span className={timelineNodeVariants({ status: step.status })}>
                {step.node}
              </span>
              {!isLast ? (
                <span
                  className={timelineConnectorVariants({
                    status: step.status,
                  })}
                />
              ) : null}
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className={timelineTitleVariants({ status: step.status })}>
                {step.title}
              </div>
              {step.meta ? (
                <div className="mt-0.5 font-mono text-2xs text-faint-foreground">
                  {step.meta}
                </div>
              ) : null}
              {step.description ? (
                <div
                  className={cn(
                    'mt-2 max-w-[54ch] text-sm leading-body text-muted-foreground',
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
