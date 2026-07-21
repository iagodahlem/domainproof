'use client'

import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Copy } from 'lucide-react'
import { Button, type ButtonProps } from './button'
import { cn } from './cn'

const COPIED_CLASSES =
  'border-[color-mix(in_oklab,var(--success)_var(--alpha-border-strong),transparent)] bg-[var(--success-soft)] text-[color:var(--success)] hover:bg-[var(--success-soft)]'

export interface CopyButtonProps extends Omit<ButtonProps, 'onClick'> {
  value: string
  copiedLabel?: ReactNode
  resetAfter?: number
}

export function CopyButton({
  value,
  children,
  copiedLabel = 'Copied',
  resetAfter = 1500,
  size = 'sm',
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
      {copied ? copiedLabel : children}
    </Button>
  )
}
