import { forwardRef, useId } from 'react'
import type { InputHTMLAttributes, ReactNode } from 'react'
import { cn } from './cn'
import { FieldError, FieldLabel } from './field'

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
  /** Inline action beside the input (e.g. a Save button) — see the project-settings save flow. Omit for the plain full-width input. */
  trailing?: ReactNode
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  function TextField({ label, error, trailing, id, className, ...props }, ref) {
    const generatedId = useId()
    const inputId = id ?? generatedId
    const errorId = `${inputId}-error`

    return (
      <div className="flex flex-col gap-2">
        <FieldLabel htmlFor={inputId}>{label}</FieldLabel>
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={ref}
            id={inputId}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            className={cn(
              'min-w-45 flex-1 rounded-md border bg-background px-3 py-2 text-sm text-foreground transition-[background-color,border-color] duration-150 placeholder:text-faint-foreground disabled:cursor-not-allowed disabled:opacity-50',
              error ? 'border-danger' : 'border-border',
              className,
            )}
            {...props}
          />
          {trailing}
        </div>
        {error ? <FieldError id={errorId}>{error}</FieldError> : null}
      </div>
    )
  },
)
