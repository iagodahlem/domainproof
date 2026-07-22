import { Callout } from '@domainproof/ui'

/**
 * Renders in place of API-backed content when the dashboard API call in a
 * server component fails — network error, 401, 500, whatever. Keeps the
 * page (header, sign-out) usable instead of letting the exception bubble
 * to Next's generic error boundary.
 */
export function ApiErrorState() {
  return (
    <Callout tone="warning" className="max-w-[54ch]">
      <p>
        <strong>We couldn&rsquo;t load your projects.</strong> This is usually
        temporary — refresh the page in a moment.
      </p>
    </Callout>
  )
}
