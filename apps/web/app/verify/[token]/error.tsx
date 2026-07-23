'use client'

import { Button, Card, CardBody, Logo } from '@domainproof/ui'

export default function VerifyTokenError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center gap-6 px-6 py-12 text-center">
      <Logo />
      <Card className="w-full">
        <CardBody className="flex flex-col items-center gap-4">
          <h1 className="text-xl font-heading">Couldn&apos;t load this page</h1>
          <p className="text-sm leading-body text-text-muted">
            Something went wrong reaching DomainProof. This is usually
            temporary.
          </p>
          <Button variant="primary" onClick={reset}>
            Try again
          </Button>
        </CardBody>
      </Card>
    </main>
  )
}
