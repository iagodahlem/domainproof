'use client'

import { cloneElement, forwardRef, isValidElement } from 'react'
import type { ComponentPropsWithoutRef, ElementRef, ReactNode } from 'react'
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'
import { Check } from 'lucide-react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from './cn'

/**
 * Generic dropdown-menu primitive on Radix's DropdownMenu — trigger +
 * portal-rendered content + items, with keyboard nav/focus/dismissal
 * handled by Radix. Two call sites need this shape (project switcher,
 * account menu); domain-specific styling lives on each trigger, not here.
 */
export const Menu = DropdownMenuPrimitive.Root
export const MenuTrigger = DropdownMenuPrimitive.Trigger

export type MenuContentProps = ComponentPropsWithoutRef<
  typeof DropdownMenuPrimitive.Content
>

export const MenuContent = forwardRef<
  ElementRef<typeof DropdownMenuPrimitive.Content>,
  MenuContentProps
>(function MenuContent(
  { className, sideOffset = 6, align = 'start', ...props },
  ref,
) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        align={align}
        className={cn(
          'z-50 w-52 rounded-lg border border-border-strong bg-surface p-2 shadow-card',
          className,
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  )
})

const menuItemVariants = cva(
  'group flex cursor-pointer items-center rounded-md text-left text-sm font-semibold text-muted-foreground outline-none transition-colors duration-150',
  {
    variants: {
      tone: {
        default:
          'data-[highlighted]:bg-surface-2 data-[highlighted]:text-foreground',
        accent:
          'text-accent data-[highlighted]:bg-surface-2 data-[highlighted]:text-foreground',
        danger:
          'data-[highlighted]:bg-danger-soft data-[highlighted]:text-danger',
      },
      active: {
        true: 'bg-surface-2 text-foreground',
        false: '',
      },
      // Compact square item for icon-only controls; currently unused, kept
      // for the planned account-menu redesign. Still a real
      // DropdownMenuPrimitive.Item under the hood, so it stays in Radix's
      // roving-focus/arrow-key collection rather than becoming an
      // unreachable orphan (the menu swallows Tab).
      iconOnly: {
        true: 'h-8 w-8 shrink-0 justify-center border border-border-strong bg-surface p-0',
        false: 'w-full gap-3 px-3 py-2',
      },
    },
    defaultVariants: {
      tone: 'default',
      active: false,
      iconOnly: false,
    },
  },
)

export interface MenuItemProps
  extends
    ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item>,
    VariantProps<typeof menuItemVariants> {
  icon?: ReactNode
}

export const MenuItem = forwardRef<
  ElementRef<typeof DropdownMenuPrimitive.Item>,
  MenuItemProps
>(function MenuItem(
  {
    className,
    tone = 'default',
    active = false,
    iconOnly = false,
    icon,
    children,
    asChild = false,
    ...props
  },
  ref,
) {
  const iconEl = icon ? (
    <span
      aria-hidden="true"
      className={cn(
        'shrink-0',
        tone === 'accent'
          ? 'text-accent'
          : tone === 'danger'
            ? 'text-faint-foreground group-data-[highlighted]:text-danger'
            : 'text-faint-foreground',
      )}
    >
      {icon}
    </span>
  ) : null
  const checkEl = active ? (
    <Check aria-hidden="true" size={14} className="shrink-0 text-accent" />
  ) : null

  // Radix's Slot (used under `asChild`) requires exactly one element
  // child — so the icon/label/check can't be siblings of that element
  // the way they are in the non-asChild case below. Instead they're
  // spliced into the single child's own children (e.g. a Link's content).
  const content = iconOnly ? (
    iconEl
  ) : asChild && isValidElement<{ children?: ReactNode }>(children) ? (
    cloneElement(
      children,
      undefined,
      <>
        {iconEl}
        <span className="flex-1 truncate">{children.props.children}</span>
        {checkEl}
      </>,
    )
  ) : (
    <>
      {iconEl}
      <span className="flex-1 truncate">{children}</span>
      {checkEl}
    </>
  )

  return (
    <DropdownMenuPrimitive.Item
      ref={ref}
      asChild={asChild}
      className={cn(menuItemVariants({ tone, active, iconOnly }), className)}
      {...props}
    >
      {content}
    </DropdownMenuPrimitive.Item>
  )
})

export function MenuSeparator({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>) {
  return (
    <DropdownMenuPrimitive.Separator
      className={cn('my-2 border-t border-border', className)}
      {...props}
    />
  )
}
