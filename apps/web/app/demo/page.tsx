import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sitegrade — a DomainProof demo',
  description:
    'A site-scoring demo that gates its full report behind DomainProof domain verification.',
}

/**
 * Placeholder only — this PR ships the backend (POST /demo/api/scan,
 * POST /demo/api/claim, GET /demo/api/status) and deliberately no UI. See
 * the feasibility audit in the PR description for which checks shipped and
 * why.
 */
export default function DemoPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-24 text-center">
      <h1 className="text-2xl font-semibold">Sitegrade</h1>
      <p className="mt-4 text-base text-muted-foreground">
        A site-scoring demo built on DomainProof — coming soon.
      </p>
    </main>
  )
}
