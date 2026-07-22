import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getVerification } from '@/lib/api/frontend'
import { VerificationPageClient } from './_components/page-client'

interface VerifyTokenPageProps {
  params: Promise<{ token: string }>
  searchParams: Promise<{ cloudflare?: string | string[] }>
}

export async function generateMetadata({
  params,
}: VerifyTokenPageProps): Promise<Metadata> {
  const { token } = await params
  const result = await getVerification(token)
  if (!result.ok) {
    return { title: 'Verify a domain — DomainProof' }
  }
  return {
    title: `Verify ${result.data.domain} — DomainProof`,
    description: `Prove ownership of ${result.data.domain} for ${result.data.projectName}.`,
  }
}

/**
 * Server shell: resolves the token once for the initial render (so an
 * invalid/unknown token 404s before any client JS ships) and hands the rest
 * off to `VerificationPageClient` for polling/recheck. No auth context
 * anywhere on this route (D-029) — the frontend-plane token in the URL is
 * the only credential, same as every section below it.
 */
export default async function VerifyTokenPage({
  params,
  searchParams,
}: VerifyTokenPageProps) {
  const { token } = await params
  const { cloudflare } = await searchParams
  const result = await getVerification(token)

  if (!result.ok) {
    if (result.error.kind === 'http' && result.error.status === 404) {
      notFound()
    }
    // Any other failure (a non-404 http error, or the fetch never landing
    // at all) is a real error, not "this token doesn't exist" — thrown so
    // the route's error.tsx boundary renders a retry state instead of
    // silently treating a down api as an invalid link.
    throw new Error(
      result.error.kind === 'http'
        ? result.error.message
        : 'Could not reach DomainProof.',
    )
  }

  return (
    <VerificationPageClient
      token={token}
      initialData={result.data}
      cloudflareOutcome={typeof cloudflare === 'string' ? cloudflare : null}
    />
  )
}
