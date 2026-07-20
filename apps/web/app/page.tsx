import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-4xl font-semibold tracking-tight">DomainProof</h1>
      <p className="text-lg text-muted-foreground">
        Prove ownership of a domain.
      </p>
      <p className="text-sm text-muted-foreground/70">
        under construction — launching this week
      </p>
      <Button asChild className="mt-4">
        <Link href="/docs">Docs</Link>
      </Button>
    </div>
  )
}
