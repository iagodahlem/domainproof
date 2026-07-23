import type { Metadata } from 'next'
import { Header, Logo } from '@domainproof/ui'
import { AuthCta } from '@/components/header/auth-cta'
import { MarketingActions } from '@/components/header/marketing-actions'

export const metadata: Metadata = {
  title: 'DomainProof',
  description: 'Prove ownership of a domain.',
}

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header left={<Logo />} right={<MarketingActions />} />

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
            <AuthCta className="self-start" iconSize={15} />
          </div>
        </div>
      </main>

      <footer className="px-6 py-12 text-center text-sm text-faint-foreground">
        DomainProof · domain ownership as a service
      </footer>
    </div>
  )
}
