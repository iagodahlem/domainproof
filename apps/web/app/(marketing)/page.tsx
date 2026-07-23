import type { Metadata } from 'next'
import { auth } from '@clerk/nextjs/server'
import { AuthCta } from '@/components/header/auth-cta'

export const metadata: Metadata = {
  title: 'DomainProof',
  description: 'Prove ownership of a domain.',
}

export default async function LandingPage() {
  const { userId } = await auth()

  return (
    <div
      // eslint-disable-next-line better-tailwindcss/no-restricted-classes -- min-h-[calc(100vh-4rem)] accounts for the 4rem-tall sticky Header the marketing layout renders as a sibling above this page, same treatment as docs-sidebar.tsx's h-[calc(100vh-4rem)]
      className="flex min-h-[calc(100vh-4rem)] flex-col bg-background"
    >
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-6 py-16">
        <div className="flex max-w-[62ch] flex-col gap-4">
          <p className="font-mono text-xs font-semibold tracking-widest text-accent uppercase">
            Domain ownership, proven
          </p>
          <h1 className="text-4xl leading-heading-tight font-heading text-foreground">
            Verify domain ownership without building the DNS UX yourself.
          </h1>
          <div className="flex flex-col gap-6">
            <p className="text-lg leading-relaxed text-muted-foreground">
              Your user adds one DNS record on a page we host — accurate, live,
              and explained in plain language. You get a webhook the moment
              it&rsquo;s true.
            </p>
            <AuthCta
              className="self-start"
              iconSize={15}
              initialIsSignedIn={Boolean(userId)}
            />
          </div>
        </div>
      </main>
    </div>
  )
}
