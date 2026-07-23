import { Badge, dotVariants } from '@domainproof/ui'

/**
 * Marks a walkthrough surface as a real, live embed (the hosted-page
 * iframe, the actual `<DomainVerification />`) rather than a static mock —
 * shared so both read as one consistent "this one's real" signal instead
 * of each tab inventing its own label.
 */
export function LiveBadge() {
  return (
    <Badge tone="success" className="w-fit gap-1.5">
      <span className={dotVariants({ tone: 'success' })} />
      Live
    </Badge>
  )
}
