import { Fragment } from 'react'
import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from './cn'

export type StepperStepStatus = 'done' | 'current' | 'upcoming'

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
        'flex items-start max-[560px]:flex-wrap max-[560px]:gap-x-3 max-[560px]:gap-y-4',
        className,
      )}
      {...props}
    >
      {steps.map((step, index) => (
        <Fragment key={step.id}>
          <div className="flex min-w-0 flex-1 flex-col items-center gap-2 max-[560px]:w-[calc(50%-0.5rem)] max-[560px]:flex-none max-[560px]:flex-row max-[560px]:items-center">
            <span
              className={cn(
                'flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-full border-2 border-border-strong bg-surface text-text-faint',
                step.status === 'done' &&
                  'border-success bg-success text-success-foreground',
                step.status === 'current' &&
                  'border-accent text-accent shadow-current',
              )}
            >
              {step.node}
            </span>
            <span
              className={cn(
                'text-center text-[length:var(--text-xs)] font-heading whitespace-nowrap max-[560px]:text-left max-[560px]:whitespace-normal',
                step.status === 'current' && 'text-accent',
              )}
            >
              {step.label}
              {step.time ? (
                <span className="mt-px block font-mono text-[length:var(--text-2xs)] font-medium text-text-faint">
                  {step.time}
                </span>
              ) : null}
            </span>
          </div>
          {index < steps.length - 1 ? (
            <span
              className={cn(
                'mt-[11px] h-[2px] min-w-[12px] flex-1 bg-border-strong max-[560px]:hidden',
                step.status === 'done' && 'bg-success',
              )}
            />
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
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[length:var(--text-xs)] text-text-faint">
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
