import { Fragment } from 'react'
import type { HTMLAttributes, ReactNode } from 'react'
import { cva } from 'class-variance-authority'
import { cn } from './cn'

export type StepperStepStatus = 'done' | 'current' | 'upcoming'

const stepNodeVariants = cva(
  'flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-full border-2 font-sans text-2xs leading-none font-heading',
  {
    variants: {
      status: {
        done: 'border-success bg-success text-success-foreground',
        current: 'border-accent bg-surface text-accent shadow-current',
        upcoming: 'border-border-strong bg-surface text-text-faint',
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
      },
    },
  },
)

const stepConnectorVariants = cva(
  'mt-[11px] h-[2px] min-w-[12px] flex-1 bg-border-strong',
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

export interface StepperStep {
  id: string
  status: StepperStepStatus
  node: ReactNode
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
        'flex items-start overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className,
      )}
      {...props}
    >
      {steps.map((step, index) => (
        <Fragment key={step.id}>
          <div className="flex shrink-0 flex-col items-center gap-2">
            <span className={stepNodeVariants({ status: step.status })}>
              {step.node}
            </span>
            <span className={stepLabelVariants({ status: step.status })}>
              {step.label}
              {step.time ? (
                <span className="mt-px block font-mono text-2xs font-medium text-text-faint">
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
  statusBadge: ReactNode
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
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        {statusBadge}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-text-faint">
          {meta.map((item, index) => (
            <span key={index}>
              <strong className="font-semibold text-text-muted">
                {item.label}
              </strong>{' '}
              {item.value}
            </span>
          ))}
        </div>
      </div>
      <Stepper steps={steps} />
    </div>
  )
}
