import { Card, CardBody, Logo } from '@domainproof/ui'

export interface ExpiredLinkCardProps {
  projectName: string
}

/**
 * Same shape as the route's own not-found/error screens — an expired
 * verification window means there's no live claim left to anchor a context
 * header or stepper to, so this skips both entirely rather than showing a
 * "record added" progress bar for a link that can no longer progress.
 */
export function ExpiredLinkCard({ projectName }: ExpiredLinkCardProps) {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center gap-6 px-6 py-12 text-center">
      <Logo />
      <Card className="w-full">
        <CardBody className="flex flex-col items-center gap-4">
          <h1 className="text-xl font-heading">
            This verification link expired
          </h1>
          <p className="text-sm leading-body text-muted-foreground">
            Ask {projectName} to send a new verification link to try again.
          </p>
        </CardBody>
      </Card>
    </main>
  )
}
