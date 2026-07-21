import type { HTMLAttributes, ReactNode } from 'react'
import { CardHead } from './card'
import { cn } from './cn'

export type RecordCardStepTone = 'accent' | 'success'

const STEP_TONE_CLASSES: Record<RecordCardStepTone, string> = {
  accent: 'bg-[var(--accent-soft)] text-[color:var(--accent)]',
  success: 'bg-[var(--success-soft)] text-[color:var(--success)]',
}

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
        'overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)]',
        className,
      )}
      {...props}
    >
      {title ? (
        <CardHead>
          <div className="flex items-start gap-[var(--space-3)]">
            {step != null ? (
              <span
                className={cn(
                  'mt-px inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-[5px] font-mono text-[length:var(--text-2xs)] font-[var(--font-weight-bold)]',
                  STEP_TONE_CLASSES[stepTone],
                )}
              >
                {step}
              </span>
            ) : null}
            <div className="text-[length:var(--text-base)] font-[var(--font-weight-heading)]">
              <div>{title}</div>
              {sub ? (
                <div className="mt-[2px] text-[length:var(--text-sm)] font-[var(--font-weight-medium)] text-[color:var(--text-faint)]">
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
