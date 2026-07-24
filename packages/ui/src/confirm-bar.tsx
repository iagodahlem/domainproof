import type { ReactNode } from 'react'
import { TriangleAlert } from 'lucide-react'
import { Button } from './button'
import { Callout } from './callout'
import { cn } from './cn'

export interface ConfirmBarProps {
  message: ReactNode
  confirmLabel: ReactNode
  cancelLabel?: ReactNode
  onConfirm: () => void
  onCancel: () => void
  pending?: boolean
  className?: string
}

/**
 * Inline destructive-action confirmation: a danger callout with the
 * warning message on the left and Cancel/Confirm actions on the right,
 * expanded in place below the control that triggered it — for a control
 * with a natural inline slot to expand into (see `record-field.tsx`'s
 * rotate/revoke call sites). For a trigger with no such slot (an
 * overflow-menu item), or an action weighty enough that interrupting the
 * whole page reads as appropriate, use `ConfirmDialog` instead.
 */
export function ConfirmBar({
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  pending = false,
  className,
}: ConfirmBarProps) {
  return (
    <Callout
      tone="danger"
      className={cn(
        'flex flex-wrap items-start justify-between gap-4',
        className,
      )}
    >
      <div className="flex flex-1 items-start gap-3 text-muted-foreground">
        <TriangleAlert
          aria-hidden="true"
          size={15}
          className="mt-0.5 shrink-0 text-danger"
        />
        <span>{message}</span>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button type="button" size="sm" onClick={onCancel} disabled={pending}>
          {cancelLabel}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="danger-ghost"
          onClick={onConfirm}
          loading={pending}
        >
          {confirmLabel}
        </Button>
      </div>
    </Callout>
  )
}
