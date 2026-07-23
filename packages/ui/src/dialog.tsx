'use client'

import { forwardRef } from 'react'
import type { ComponentPropsWithoutRef, ElementRef, ReactNode } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { Button } from './button'
import { Callout } from './callout'
import { cn } from './cn'

/**
 * Generic modal-dialog primitive on Radix's Dialog — the first modal in
 * this design system. Every other confirmation so far expands inline
 * (`ConfirmBar`, the webhooks endpoint row, the add-domain panel); this is
 * reserved for actions triggered somewhere with no natural inline slot to
 * expand into (an overflow-menu item) or weighty enough that interrupting
 * the whole page reads as appropriate rather than alarming — see
 * `ConfirmDialog` below, the only shape this ships with today.
 */
export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close

export type DialogContentProps = ComponentPropsWithoutRef<
  typeof DialogPrimitive.Content
> & {
  /** Hides the built-in corner close button — for a dialog whose only dismissal is its own Cancel/Confirm actions (e.g. mid-request, see `ConfirmDialog`). */
  hideClose?: boolean
}

export const DialogContent = forwardRef<
  ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(function DialogContent(
  { className, children, hideClose = false, ...props },
  ref,
) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        className={cn(
          'fixed inset-0 z-50 bg-black/50',
          'data-[state=open]:animate-in data-[state=open]:fade-in-0',
          'data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
        )}
      />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          // eslint-disable-next-line better-tailwindcss/no-restricted-classes -- viewport-safe width floor (100% minus a 2rem gutter) has no mapped token equivalent; standard modal-sizing idiom
          'fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2',
          'rounded-lg border border-border-strong bg-surface p-6 shadow-card',
          'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
          'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
          className,
        )}
        {...props}
      >
        {children}
        {hideClose ? null : (
          <DialogPrimitive.Close
            aria-label="Close"
            className="absolute top-4 right-4 rounded-md text-faint-foreground transition-colors duration-150 hover:text-foreground"
          >
            <X aria-hidden="true" size={16} />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
})

export const DialogTitle = forwardRef<
  ElementRef<typeof DialogPrimitive.Title>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(function DialogTitle({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Title
      ref={ref}
      className={cn('text-lg font-heading text-foreground', className)}
      {...props}
    />
  )
})

export const DialogDescription = forwardRef<
  ElementRef<typeof DialogPrimitive.Description>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(function DialogDescription({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Description
      ref={ref}
      className={cn('mt-2 text-sm text-muted-foreground', className)}
      {...props}
    />
  )
})

export interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description: ReactNode
  confirmLabel: ReactNode
  cancelLabel?: ReactNode
  onConfirm: () => void
  pending?: boolean
  /** A failed attempt's message — rendered between the description and the actions, dialog stays open so the caller can retry. */
  error?: ReactNode
}

/**
 * Destructive-action confirmation as a modal — the `ConfirmBar` of dialogs.
 * Its actions are exactly Cancel and the destructive confirm button, so the
 * corner close button never renders, pending or not. Dismissal (Escape,
 * overlay click, Cancel) is additionally disabled outright while `pending`,
 * same reasoning as `ConfirmBar` disabling both its actions: a request in
 * flight shouldn't be walked away from mid-flight.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  onConfirm,
  pending = false,
  error,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) onOpenChange(next)
      }}
    >
      <DialogContent
        hideClose
        onEscapeKeyDown={(event) => {
          if (pending) event.preventDefault()
        }}
        onPointerDownOutside={(event) => {
          if (pending) event.preventDefault()
        }}
      >
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
        {error ? (
          <Callout tone="warning" className="mt-4">
            {error}
          </Callout>
        ) : null}
        <div className="mt-6 flex justify-end gap-2">
          <DialogClose asChild>
            <Button type="button" disabled={pending}>
              {cancelLabel}
            </Button>
          </DialogClose>
          <Button
            type="button"
            variant="danger-ghost"
            onClick={onConfirm}
            loading={pending}
          >
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
