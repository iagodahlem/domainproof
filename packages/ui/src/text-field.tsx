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
      <div className="flex flex-col gap-2">
        <FieldLabel htmlFor={inputId}>{label}</FieldLabel>
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={cn(
            'rounded-md border bg-bg px-3 py-2 text-sm text-text transition-[background-color,border-color] duration-150 placeholder:text-text-faint disabled:cursor-not-allowed disabled:opacity-50',
            error ? 'border-danger' : 'border-border',
            className,
          )}
          {...props}
        />
        {error ? <FieldError id={errorId}>{error}</FieldError> : null}
      </div>
    )
  },
)
