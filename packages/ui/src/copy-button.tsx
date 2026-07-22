'use client'

import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Copy } from 'lucide-react'
import { Button, type ButtonProps } from './button'
import { cn } from './cn'

const COPIED_CLASSES =
  'border-success-tint-strong bg-success-soft text-success hover:bg-success-soft'

export interface CopyButtonProps extends Omit<ButtonProps, 'onClick'> {
  value: string
  copiedLabel?: ReactNode
  resetAfter?: number
  /** Hides the label, leaving just the copy icon — pass `aria-label` for the accessible name and `size="icon"` to match another icon button beside it (e.g. a Reveal action). The label still renders `sr-only` so the copied-state change is announced. */
  iconOnly?: boolean
}

export function CopyButton({
  value,
  children,
  copiedLabel = 'Copied',
  resetAfter = 1500,
  size = 'sm',
  iconOnly = false,
  className,
  ...props
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  async function handleClick() {
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      return
    }
    setCopied(true)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => setCopied(false), resetAfter)
  }

  return (
    <Button
      type="button"
      size={size}
      onClick={handleClick}
      aria-live="polite"
      className={cn(copied && COPIED_CLASSES, className)}
      {...props}
    >
      <Copy aria-hidden="true" size={13} />
      {iconOnly ? (
        <span className="sr-only">{copied ? copiedLabel : children}</span>
      ) : copied ? (
        copiedLabel
      ) : (
        children
      )}
    </Button>
  )
}
