import { forwardRef, useId } from 'react'
import type { SelectHTMLAttributes } from 'react'
import { cn } from './cn'
import { FieldError, FieldLabel } from './field'

export interface SelectOption {
  value: string
  label: string
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  error?: string
  options: SelectOption[]
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  function Select({ label, error, options, id, className, ...props }, ref) {
    const generatedId = useId()
    const selectId = id ?? generatedId
    const errorId = `${selectId}-error`

    return (
      <div className="flex flex-col gap-[var(--space-2)]">
        <FieldLabel htmlFor={selectId}>{label}</FieldLabel>
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            className={cn(
              'w-full appearance-none rounded-[var(--radius-md)] border bg-[var(--bg)] py-[var(--space-2)] pr-[var(--space-8)] pl-[var(--space-3)] text-[length:var(--text-sm)] text-[color:var(--text)] transition-[background-color,border-color] duration-[var(--duration-fast)] disabled:cursor-not-allowed disabled:opacity-50',
              error ? 'border-[var(--danger)]' : 'border-[var(--border)]',
              className,
            )}
            {...props}
          >
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronIcon className="pointer-events-none absolute top-1/2 right-[var(--space-3)] h-3 w-3 -translate-y-1/2 text-[color:var(--text-faint)]" />
        </div>
        {error ? <FieldError id={errorId}>{error}</FieldError> : null}
      </div>
    )
  },
)

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}
