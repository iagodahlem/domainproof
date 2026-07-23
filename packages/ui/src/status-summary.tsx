import { Fragment } from 'react'
import type { HTMLAttributes, ReactNode } from 'react'
import { cva } from 'class-variance-authority'
import { Check, X } from 'lucide-react'
import { cn } from './cn'

export type StepperStepStatus = 'done' | 'current' | 'upcoming' | 'failed'

// Numbers dropped from the circles on purpose — the connector line already
// carries the order and the label carries the name, so the circle only
// needs to say *how* a step stands: done, being checked right now, not
// there yet, or blocked.
const stepNodeVariants = cva(
  'flex h-5.5 w-5.5 flex-shrink-0 items-center justify-center rounded-full border-2',
  {
    variants: {
      status: {
        done: 'border-success bg-success text-success-foreground',
        current: 'border-accent bg-surface text-accent shadow-current',
        upcoming: 'border-border-strong bg-surface text-faint-foreground',
        // Same soft-tint recipe as badge-danger/callout-danger (border +
        // text from --danger, no fill) rather than a solid fill like
        // `done` — this token set has no --danger-foreground for a
        // guaranteed-legible label on a filled danger surface (see
        // tokens.css's comment on it).
        failed: 'border-danger bg-danger-soft text-danger',
      },
    },
  },
)

const stepLabelVariants = cva(
  'text-center text-xs font-heading whitespace-nowrap',
  {
    variants: {
      status: {
        done: '',
        current: 'text-accent',
        upcoming: '',
        failed: 'text-danger',
      },
    },
  },
)

const stepConnectorVariants = cva(
  'mt-2.75 h-0.5 min-w-3 flex-1 bg-border-strong',
  {
    variants: {
      status: {
        done: 'bg-success',
        current: '',
        upcoming: '',
        failed: '',
      },
    },
  },
)

/** The active step means "we're checking this right now" — the pulse says live-not-stuck. */
function StepNode({ status }: { status: StepperStepStatus }) {
  switch (status) {
    case 'done':
      return <Check aria-hidden="true" size={10} />
    case 'failed':
      return <X aria-hidden="true" size={10} />
    case 'current':
      return (
        <span className="h-2 w-2 rounded-full bg-accent animate-dp-pulse" />
      )
    case 'upcoming':
      return (
        <span className="h-1.5 w-1.5 rounded-full border border-border-strong" />
      )
  }
}

export interface StepperStep {
  id: string
  status: StepperStepStatus
  label: ReactNode
  time?: ReactNode
}

export interface StepperProps extends HTMLAttributes<HTMLDivElement> {
  steps: StepperStep[]
}

export function Stepper({ steps, className, ...props }: StepperProps) {
  return (
    <div
      className={cn(
        'flex items-start overflow-x-auto py-1 -my-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className,
      )}
      {...props}
    >
      {steps.map((step, index) => (
        <Fragment key={step.id}>
          <div className="flex shrink-0 flex-col items-center gap-2">
            <span className={stepNodeVariants({ status: step.status })}>
              <StepNode status={step.status} />
            </span>
            <span className={stepLabelVariants({ status: step.status })}>
              {step.label}
              {step.time ? (
                <span className="mt-px block font-mono text-2xs font-medium text-faint-foreground">
                  {step.time}
                </span>
              ) : null}
            </span>
          </div>
          {index < steps.length - 1 ? (
            <span className={stepConnectorVariants({ status: step.status })} />
          ) : null}
        </Fragment>
      ))}
    </div>
  )
}

export interface StatusSummaryMetaItem {
  label: ReactNode
  value: ReactNode
}

export interface StatusSummaryProps extends HTMLAttributes<HTMLDivElement> {
  /** Omit when the same status is already shown elsewhere on the page (e.g. the domain detail header's own pill) — repeating it inside this box too would just be noise. */
  statusBadge?: ReactNode
  meta?: StatusSummaryMetaItem[]
  steps: StepperStep[]
}

export function StatusSummary({
  statusBadge,
  meta = [],
  steps,
  className,
  ...props
}: StatusSummaryProps) {
  return (
    <div
      className={cn(
        'mb-6 rounded-lg border border-border p-5 max-[640px]:p-5',
        className,
      )}
      {...props}
    >
      {statusBadge || meta.length > 0 ? (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          {statusBadge}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-faint-foreground">
            {meta.map((item, index) => (
              <span key={index}>
                <strong className="font-semibold text-muted-foreground">
                  {item.label}
                </strong>{' '}
                {item.value}
              </span>
            ))}
          </div>
        </div>
      ) : null}
      <Stepper steps={steps} />
    </div>
  )
}
