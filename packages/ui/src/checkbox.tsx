import { forwardRef, useId } from 'react'
import type { InputHTMLAttributes } from 'react'
import { cn } from './cn'

export interface CheckboxProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type'
> {
  label: string
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  function Checkbox({ label, id, className, disabled, ...props }, ref) {
    const generatedId = useId()
    const checkboxId = id ?? generatedId

    return (
      <label
        htmlFor={checkboxId}
        className={cn(
          'inline-flex items-center gap-[var(--space-2)] text-[length:var(--text-sm)] text-[color:var(--text)]',
          disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
          className,
        )}
      >
        <span className="relative inline-flex h-4 w-4 shrink-0 items-center justify-center">
          <input
            ref={ref}
            type="checkbox"
            id={checkboxId}
            disabled={disabled}
            className="peer absolute inset-0 h-full w-full appearance-none rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--surface)] transition-[background-color,border-color] duration-[var(--duration-fast)] checked:border-transparent checked:bg-[var(--accent)] disabled:cursor-not-allowed"
            {...props}
          />
          <CheckIcon className="pointer-events-none absolute h-2.5 w-2.5 text-[color:var(--accent-foreground)] opacity-0 peer-checked:opacity-100" />
        </span>
        {label}
      </label>
    )
  },
)

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}
