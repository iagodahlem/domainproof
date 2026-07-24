import type { Metadata } from 'next'
import { SitegradeApp } from './_components/sitegrade-app'

export const metadata: Metadata = {
  title: 'Sitegrade — a DomainProof demo',
  description:
    'A site-scoring demo that gates its full report behind DomainProof domain verification.',
}

export default function DemoPage() {
  return <SitegradeApp />
}
