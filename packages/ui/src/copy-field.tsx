import { useId } from 'react'
import type { ReactNode } from 'react'
import { CopyButton } from './copy-button'
import { FieldLabel } from './field'
import { cn } from './cn'

export interface CopyFieldProps {
  value: string
  label?: string
  copyLabel?: ReactNode
  className?: string
}

/**
 * A read-only, copy-to-clipboard field — the copy button lives inside the
 * field itself (right edge, same `absolute top-3 right-3` placement
 * `CodePanel`'s own copy button uses), not detached beside it as a second
 * control. Use anywhere a value's whole reason for existing is to be
 * copied verbatim (a hosted link, a token) rather than edited — for an
 * editable field with a copy affordance beside it, `TextField`'s
 * `trailing` slot is the right tool instead.
 */
export function CopyField({
  value,
  label,
  copyLabel = 'Copy',
  className,
}: CopyFieldProps) {
  const generatedId = useId()

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {label ? <FieldLabel htmlFor={generatedId}>{label}</FieldLabel> : null}
      <div className="relative min-w-0">
        <input
          id={generatedId}
          type="text"
          readOnly
          value={value}
          onFocus={(event) => event.currentTarget.select()}
          className="w-full truncate rounded-md border border-border bg-background py-3 pr-22 pl-3 font-mono text-xs text-muted-foreground"
        />
        <CopyButton
          value={value}
          size="sm"
          className="absolute top-1/2 right-3 -translate-y-1/2"
        >
          {copyLabel}
        </CopyButton>
      </div>
    </div>
  )
}
