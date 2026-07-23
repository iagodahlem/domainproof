import Link from 'next/link'
import { BookOpen } from 'lucide-react'
import { Button, type ButtonProps } from '@domainproof/ui'

export interface DocsLinkProps extends Pick<ButtonProps, 'size' | 'className'> {
  iconSize?: number
  /** Hides the label below the `sm` breakpoint, leaving only the icon — matches the toggle and CTA beside it in the marketing header's actions cluster, so the group stays on one row down to the smallest screens. The label stays in the DOM as `sr-only`, so the accessible name is unaffected. */
  compact?: boolean
}

/**
 * A quiet link to the docs site, styled as the ghost sibling next to the
 * marketing header's primary CTA — same footprint, none of the emphasis.
 */
export function DocsLink({
  size,
  className,
  iconSize = 13,
  compact = false,
}: DocsLinkProps) {
  const labelClassName = compact ? 'sr-only sm:not-sr-only' : undefined

  return (
    <Button asChild size={size} variant="ghost" className={className}>
      <Link href="/docs">
        <BookOpen aria-hidden="true" size={iconSize} />
        <span className={labelClassName}>Docs</span>
      </Link>
    </Button>
  )
}
