import { forwardRef, useId } from 'react'
import type { SelectHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'
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
      <div className="flex flex-col gap-2">
        <FieldLabel htmlFor={selectId}>{label}</FieldLabel>
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            className={cn(
              'w-full appearance-none rounded-md border bg-bg py-2 pr-8 pl-3 text-[length:var(--text-sm)] text-text transition-[background-color,border-color] duration-150 disabled:cursor-not-allowed disabled:opacity-50',
              error ? 'border-danger' : 'border-border',
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
          <ChevronDown
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 right-3 h-3 w-3 -translate-y-1/2 text-text-faint"
          />
        </div>
        {error ? <FieldError id={errorId}>{error}</FieldError> : null}
      </div>
    )
  },
)
