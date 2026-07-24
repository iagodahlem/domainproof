'use client'

import { forwardRef } from 'react'
import type { ComponentPropsWithoutRef, ElementRef, ReactNode } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from './cn'

/**
 * Side-sheet primitive on the same Radix Dialog `Root` as `dialog.tsx`'s
 * centered modal — a right-side panel on desktop, a bottom sheet on
 * mobile, purely via responsive classes (no JS breakpoint check, so no
 * hydration mismatch). Reserved for create flows with a natural trigger
 * button (add-domain, add-webhook); destructive confirmations stay on
 * `ConfirmDialog`/`ConfirmBar`.
 */
export const Drawer = DialogPrimitive.Root
export const DrawerTrigger = DialogPrimitive.Trigger
export const DrawerClose = DialogPrimitive.Close

export type DrawerContentProps = ComponentPropsWithoutRef<
  typeof DialogPrimitive.Content
>

export const DrawerContent = forwardRef<
  ElementRef<typeof DialogPrimitive.Content>,
  DrawerContentProps
>(function DrawerContent({ className, children, ...props }, ref) {
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
        aria-modal="true"
        // No DrawerDescription in this anatomy (Header carries just a
        // title) — an explicit `undefined` here tells Radix that's
        // intentional, instead of it warning about a dangling
        // aria-describedby with nothing to point at.
        aria-describedby={undefined}
        className={cn(
          'fixed inset-x-0 bottom-0 z-50 flex max-h-[82%] flex-col rounded-t-xl border-t border-border-strong bg-surface shadow-card',
          'sm:inset-x-auto sm:inset-y-0 sm:right-0 sm:left-auto sm:h-full sm:max-h-none sm:max-w-[88%] sm:rounded-none sm:border-t-0 sm:border-l',
          // eslint-disable-next-line better-tailwindcss/no-restricted-classes -- drawer's fixed desktop panel width from the approved mock; no scale/token equivalent
          'sm:w-[440px]',
          'data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom data-[state=open]:sm:slide-in-from-right',
          'data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=closed]:sm:slide-out-to-right',
          className,
        )}
        {...props}
      >
        <div
          aria-hidden="true"
          className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-border-strong sm:hidden"
        />
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
})

export interface DrawerHeaderProps {
  title: ReactNode
  className?: string
}

/**
 * Title + close button. The close button is hidden on the mobile sheet on
 * purpose (grab bar + the form's own Cancel/submit are the only dismiss
 * affordances there) and only appears at the desktop breakpoint.
 */
export function DrawerHeader({ title, className }: DrawerHeaderProps) {
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-between gap-3 border-b border-border py-4 px-5',
        className,
      )}
    >
      <DialogPrimitive.Title className="text-lg font-heading text-foreground">
        {title}
      </DialogPrimitive.Title>
      <DialogPrimitive.Close
        aria-label="Close"
        className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-md text-faint-foreground transition-colors duration-150 hover:bg-surface-2 hover:text-foreground sm:inline-flex"
      >
        <X aria-hidden="true" size={16} />
      </DialogPrimitive.Close>
    </div>
  )
}

export function DrawerBody({
  className,
  ...props
}: ComponentPropsWithoutRef<'div'>) {
  return (
    <div className={cn('flex-1 overflow-y-auto p-6', className)} {...props} />
  )
}

/**
 * Pinned action row. Buttons stretch full-width, evenly split on the
 * mobile sheet (a right-aligned, content-width pair reads too small to
 * hit reliably at that size) and revert to a right-aligned, content-width
 * pair at the desktop breakpoint.
 */
export function DrawerFooter({
  className,
  ...props
}: ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      className={cn(
        'grid shrink-0 grid-cols-2 gap-3 border-t border-border bg-surface py-4 px-5 sm:flex sm:justify-end',
        className,
      )}
      {...props}
    />
  )
}
