import { forwardRef, useId } from 'react'
import type { InputHTMLAttributes } from 'react'
import { cn } from './cn'
import { FieldError, FieldLabel } from './field'

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  function TextField({ label, error, id, className, ...props }, ref) {
    const generatedId = useId()
    const inputId = id ?? generatedId
    const errorId = `${inputId}-error`

    return (
      <div className="flex flex-col gap-[var(--space-2)]">
        <FieldLabel htmlFor={inputId}>{label}</FieldLabel>
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={cn(
            'rounded-[var(--radius-md)] border bg-[var(--bg)] px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--text-sm)] text-[color:var(--text)] transition-[background-color,border-color] duration-[var(--duration-fast)] placeholder:text-[color:var(--text-faint)] disabled:cursor-not-allowed disabled:opacity-50',
            error ? 'border-[var(--danger)]' : 'border-[var(--border)]',
            className,
          )}
          {...props}
        />
        {error ? <FieldError id={errorId}>{error}</FieldError> : null}
      </div>
    )
  },
)
