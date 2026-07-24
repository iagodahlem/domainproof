import { Suspense } from 'react'
import type { Metadata } from 'next'
import { SitegradeApp } from './_components/sitegrade-app'

export const metadata: Metadata = {
  title: 'Sitegrade — a DomainProof demo',
  description:
    'A site-scoring demo that gates its full report behind DomainProof domain verification.',
}

export default function DemoPage() {
  // SitegradeApp reads the URL's own `?scan=` param (via `useSearchParams`)
  // to restore a report across a refresh — Next requires a Suspense
  // boundary around any client component that does, so a build doesn't
  // bail this whole page out of static generation.
  return (
    <Suspense fallback={null}>
      <SitegradeApp />
    </Suspense>
  )
}
