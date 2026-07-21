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
        'flex items-start max-[560px]:flex-wrap max-[560px]:gap-x-[var(--space-3)] max-[560px]:gap-y-[var(--space-4)]',
        className,
      )}
      {...props}
    >
      {steps.map((step, index) => (
        <Fragment key={step.id}>
          <div className="flex min-w-0 flex-1 flex-col items-center gap-[var(--space-2)] max-[560px]:w-[calc(50%-var(--space-2))] max-[560px]:flex-none max-[560px]:flex-row max-[560px]:items-center">
            <span
              className={cn(
                'flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-full border-2 border-[var(--border-strong)] bg-[var(--surface)] text-[color:var(--text-faint)]',
                step.status === 'done' &&
                  'border-[var(--success)] bg-[var(--success)] text-[color:var(--success-foreground)]',
                step.status === 'current' &&
                  'border-[var(--accent)] text-[color:var(--accent)] shadow-[0_0_0_4px_var(--accent-soft)]',
              )}
            >
              {step.node}
            </span>
            <span
              className={cn(
                'text-center text-[length:var(--text-xs)] font-[var(--font-weight-heading)] whitespace-nowrap max-[560px]:text-left max-[560px]:whitespace-normal',
                step.status === 'current' && 'text-[color:var(--accent)]',
              )}
            >
              {step.label}
              {step.time ? (
                <span className="mt-px block font-mono text-[length:var(--text-2xs)] font-[var(--font-weight-medium)] text-[color:var(--text-faint)]">
                  {step.time}
                </span>
              ) : null}
            </span>
          </div>
          {index < steps.length - 1 ? (
            <span
              className={cn(
                'mt-[11px] h-[2px] min-w-[12px] flex-1 bg-[var(--border-strong)] max-[560px]:hidden',
                step.status === 'done' && 'bg-[var(--success)]',
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
        'mb-[var(--space-6)] rounded-[var(--radius-lg)] border border-[var(--border)] p-[var(--pad-card)] max-[640px]:p-[var(--space-5)]',
        className,
      )}
      {...props}
    >
      <div className="mb-[var(--space-6)] flex flex-wrap items-center justify-between gap-[var(--space-3)]">
        {statusBadge}
        <div className="flex flex-wrap items-center gap-x-[var(--space-5)] gap-y-[var(--space-2)] text-[length:var(--text-xs)] text-[color:var(--text-faint)]">
          {meta.map((item, index) => (
            <span key={index}>
              <strong className="font-[var(--font-weight-semibold)] text-[color:var(--text-muted)]">
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
