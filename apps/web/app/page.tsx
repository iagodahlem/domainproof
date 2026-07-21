import Link from 'next/link'
import { Button } from '@domainproof/ui'

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-4xl font-semibold tracking-tight">DomainProof</h1>
      <p className="text-lg text-text-muted">Prove ownership of a domain.</p>
      <p className="text-sm text-text-muted/70">
        under construction — launching this week
      </p>
      <Button asChild variant="primary" className="mt-4">
        <Link href="/docs">Docs</Link>
      </Button>
    </div>
  )
}
