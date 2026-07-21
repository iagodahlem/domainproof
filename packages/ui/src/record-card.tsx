import type { HTMLAttributes, ReactNode } from 'react'
import { cva } from 'class-variance-authority'
import { CardHead } from './card'
import { cn } from './cn'

export type RecordCardStepTone = 'accent' | 'success'

const stepChipVariants = cva(
  'mt-px inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-[5px] font-mono text-2xs font-bold',
  {
    variants: {
      tone: {
        accent: 'bg-accent-soft text-accent',
        success: 'bg-success-soft text-success',
      },
    },
    defaultVariants: {
      tone: 'accent',
    },
  },
)

export interface RecordCardProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'title'
> {
  /** Step number or an icon (e.g. a checkmark once complete). Omit to skip the chip. */
  step?: ReactNode
  stepTone?: RecordCardStepTone
  /** Omit title to render a headless card — just the field rows (onboarding inline use). */
  title?: ReactNode
  sub?: ReactNode
  /** Right-aligned head content, e.g. a record-type Badge. */
  trailing?: ReactNode
}

export function RecordCard({
  step,
  stepTone = 'accent',
  title,
  sub,
  trailing,
  children,
  className,
  ...props
}: RecordCardProps) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border border-border',
        className,
      )}
      {...props}
    >
      {title ? (
        <CardHead>
          <div className="flex items-start gap-3">
            {step != null ? (
              <span className={stepChipVariants({ tone: stepTone })}>
                {step}
              </span>
            ) : null}
            <div className="text-lg font-heading">
              <div>{title}</div>
              {sub ? (
                <div className="mt-[2px] text-sm font-medium text-text-faint">
                  {sub}
                </div>
              ) : null}
            </div>
          </div>
          {trailing}
        </CardHead>
      ) : null}
      {children}
    </div>
  )
}
