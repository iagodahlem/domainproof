import type { Metadata } from 'next'
import { Logo } from '@domainproof/ui'
import { AuthCta } from '@/components/auth-cta'

export const metadata: Metadata = {
  title: 'DomainProof',
  description: 'Prove ownership of a domain.',
}

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="sticky top-0 z-10 border-b border-border bg-bg-glass backdrop-blur-header backdrop-saturate-[140%]">
        <div className="mx-auto flex min-h-15 max-w-5xl items-center justify-between gap-4 px-6 py-3">
          <Logo />
          <AuthCta size="sm" iconSize={13} />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-6 py-16">
        <div className="max-w-[62ch]">
          <p className="font-mono text-xs font-semibold tracking-widest text-accent uppercase">
            Domain ownership, proven
          </p>
          <h1 className="mt-4 text-4xl leading-heading-tight font-heading text-text">
            Verify domain ownership without building the DNS UX yourself.
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-text-muted">
            Your user adds one DNS record on a page we host — accurate, live,
            and explained in plain language. You get a webhook the moment
            it&rsquo;s true.
          </p>
          <AuthCta className="mt-6" iconSize={15} />
        </div>
      </main>

      <footer className="px-6 py-12 text-center text-sm text-text-faint">
        DomainProof · domain ownership as a service
      </footer>
    </div>
  )
}
