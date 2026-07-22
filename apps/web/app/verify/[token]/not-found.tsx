import Link from 'next/link'
import { Button, Card, CardBody, Logo } from '@domainproof/ui'

export default function VerifyTokenNotFound() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center gap-6 px-6 py-12 text-center">
      <Logo />
      <Card className="w-full">
        <CardBody className="flex flex-col items-center gap-4">
          <h1 className="text-xl font-heading">
            This verification link isn&apos;t valid
          </h1>
          <p className="text-sm leading-body text-text-muted">
            It may have been mistyped, or the domain claim it pointed to no
            longer exists. Ask whoever sent you this link for a fresh one.
          </p>
          <Button asChild variant="primary">
            <Link href="/">Go to DomainProof</Link>
          </Button>
        </CardBody>
      </Card>
    </main>
  )
}
