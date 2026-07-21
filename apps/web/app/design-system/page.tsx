import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import {
  Badge,
  Callout,
  Card,
  CardBody,
  CardHead,
  CardRow,
  CopyButton,
  ProviderBadge,
  StatusPill,
  Button,
} from '@domainproof/ui'
import { ThemeToggle } from './theme-toggle'

export const metadata: Metadata = {
  title: 'Design system — DomainProof',
  description: 'Design tokens and components used across DomainProof.',
}

const COLOR_GROUPS: { label: string; tokens: string[] }[] = [
  {
    label: 'Surfaces',
    tokens: [
      'bg',
      'surface',
      'surface-2',
      'surface-3',
      'border',
      'border-strong',
    ],
  },
  {
    label: 'Text',
    tokens: ['text', 'text-muted', 'text-faint'],
  },
  {
    label: 'Accent',
    tokens: ['accent', 'accent-strong', 'accent-soft', 'accent-foreground'],
  },
  {
    label: 'Status',
    tokens: [
      'success',
      'success-soft',
      'warning',
      'warning-strong',
      'warning-soft',
      'danger',
      'danger-soft',
    ],
  },
]

const SPACE_TOKENS = [1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24]

const TYPE_TOKENS = [
  '3xs',
  '2xs',
  'xs',
  'sm',
  'md',
  'base',
  'xl',
  '2xl',
  '3xl',
  '4xl',
]

const RADIUS_TOKENS = ['sm', 'md', 'lg', 'xl', 'full']

function SectionHead({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-6 flex flex-col gap-1">
      <span className="font-mono text-xs font-semibold tracking-widest text-accent uppercase">
        {eyebrow}
      </span>
      <h2 className="font-heading text-2xl text-text">{title}</h2>
    </div>
  )
}

function ColorSwatch({ token }: { token: string }) {
  return (
    <div className="flex flex-col gap-2">
      <div
        className="h-14 rounded-[8px] border border-border"
        style={{ background: `var(--${token})` }}
      />
      <span
        className="font-mono text-xs"
        style={{ color: 'var(--text-faint)' }}
      >
        --{token}
      </span>
    </div>
  )
}

function ComponentGroupLabel({ children }: { children: ReactNode }) {
  return (
    <h3
      className="mb-4 text-sm"
      style={{
        fontWeight: 'var(--font-weight-semibold)',
        color: 'var(--text-muted)',
      }}
    >
      {children}
    </h3>
  )
}

function Example({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span
        className="font-mono text-xs"
        style={{ color: 'var(--text-faint)' }}
      >
        {label}
      </span>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  )
}

function GlobeIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </svg>
  )
}

export default function DesignSystemPage() {
  return (
    <div
      data-design-system-root
      className="min-h-screen bg-bg text-text"
      style={{ fontFamily: 'var(--font-sans)' }}
    >
      <header className="sticky top-0 z-10 border-b border-border bg-bg px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <span
            className="text-base"
            style={{ fontWeight: 'var(--font-weight-bold)' }}
          >
            DomainProof design system
          </span>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto flex max-w-5xl flex-col gap-16 px-6 py-12">
        <section id="tokens">
          <SectionHead eyebrow="Foundations" title="Tokens" />

          <div className="flex flex-col gap-10">
            <div>
              <h3
                className="mb-4 text-sm text-text-muted"
                style={{ fontWeight: 'var(--font-weight-semibold)' }}
              >
                Color
              </h3>
              <div className="flex flex-col gap-8">
                {COLOR_GROUPS.map((group) => (
                  <div key={group.label}>
                    <span
                      className="mb-3 block font-mono text-xs tracking-wide uppercase"
                      style={{ color: 'var(--text-faint)' }}
                    >
                      {group.label}
                    </span>
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 md:grid-cols-6">
                      {group.tokens.map((token) => (
                        <ColorSwatch key={token} token={token} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3
                className="mb-4 text-sm"
                style={{
                  fontWeight: 'var(--font-weight-semibold)',
                  color: 'var(--text-muted)',
                }}
              >
                Spacing
              </h3>
              <div className="flex flex-col gap-3">
                {SPACE_TOKENS.map((step) => (
                  <div key={step} className="flex items-center gap-4">
                    <span
                      className="w-20 font-mono text-xs"
                      style={{ color: 'var(--text-faint)' }}
                    >
                      --space-{step}
                    </span>
                    <div
                      className="h-2.5 rounded-sm"
                      style={{
                        width: `var(--space-${step})`,
                        background: 'var(--accent)',
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3
                className="mb-4 text-sm"
                style={{
                  fontWeight: 'var(--font-weight-semibold)',
                  color: 'var(--text-muted)',
                }}
              >
                Type
              </h3>
              <div className="flex flex-col">
                {TYPE_TOKENS.map((step) => (
                  <div
                    key={step}
                    className="flex items-baseline gap-4 border-b py-3 last:border-b-0"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <span
                      className="w-20 flex-shrink-0 font-mono text-xs"
                      style={{ color: 'var(--text-faint)' }}
                    >
                      --text-{step}
                    </span>
                    <span
                      style={{
                        fontSize: `var(--text-${step})`,
                        lineHeight: 'var(--leading-body)',
                      }}
                    >
                      The quick brown fox
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3
                className="mb-4 text-sm"
                style={{
                  fontWeight: 'var(--font-weight-semibold)',
                  color: 'var(--text-muted)',
                }}
              >
                Radius
              </h3>
              <div className="flex flex-wrap items-end gap-6">
                {RADIUS_TOKENS.map((step) => (
                  <div key={step} className="flex flex-col items-center gap-2">
                    <div
                      className="h-14 w-14 border"
                      style={{
                        borderRadius: `var(--radius-${step})`,
                        background: 'var(--surface-2)',
                        borderColor: 'var(--border-strong)',
                      }}
                    />
                    <span
                      className="font-mono text-xs"
                      style={{ color: 'var(--text-faint)' }}
                    >
                      --radius-{step}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="components">
          <SectionHead eyebrow="Primitives" title="Components" />

          <div className="flex flex-col gap-10">
            <div>
              <ComponentGroupLabel>Buttons</ComponentGroupLabel>
              <div className="flex flex-col gap-6">
                <Example label="variant">
                  <Button>Open Cloudflare DNS</Button>
                  <Button variant="primary">Recheck now</Button>
                  <Button variant="ghost">Load more</Button>
                  <Button variant="danger-ghost">Remove domain</Button>
                </Example>
                <Example label="size=sm">
                  <Button size="sm">Open Cloudflare DNS</Button>
                  <Button variant="primary" size="sm">
                    Recheck now
                  </Button>
                </Example>
                <Example label="copy / copied">
                  <CopyButton value="_acmeapp-challenge.acme.co">
                    Copy
                  </CopyButton>
                  <CopyButton value="acmeapp-verify=8f2c9e1a4b7d3f60">
                    Copy value
                  </CopyButton>
                </Example>
                <Example label="disabled">
                  <Button disabled>Open Cloudflare DNS</Button>
                  <Button variant="primary" disabled>
                    Recheck now
                  </Button>
                </Example>
                <Example label="loading">
                  <Button loading>Recheck now</Button>
                  <Button variant="primary" loading>
                    Recheck now
                  </Button>
                </Example>
              </div>
            </div>

            <div>
              <ComponentGroupLabel>Badges &amp; pills</ComponentGroupLabel>
              <div className="flex flex-col gap-6">
                <Example label="tone">
                  <Badge tone="accent">TXT</Badge>
                  <Badge tone="success">Verified</Badge>
                  <Badge tone="warning">Propagating</Badge>
                  <Badge tone="danger">Needs attention</Badge>
                  <Badge tone="neutral">Not found</Badge>
                </Example>
                <Example label="provider badge">
                  <ProviderBadge icon={<GlobeIcon />}>Cloudflare</ProviderBadge>
                  <ProviderBadge>GoDaddy</ProviderBadge>
                </Example>
                <Example label="status pill">
                  <StatusPill tone="success" pulse>
                    Verified
                  </StatusPill>
                  <StatusPill tone="warning">Propagating</StatusPill>
                  <StatusPill tone="neutral" size="small">
                    Not started
                  </StatusPill>
                </Example>
                <Example label="mode pill (badge variant)">
                  <Badge tone="warning" mode>
                    TEST MODE
                  </Badge>
                </Example>
              </div>
            </div>

            <div>
              <ComponentGroupLabel>Callouts</ComponentGroupLabel>
              <div className="flex flex-col gap-4">
                <Example label="tone=warning">
                  <Callout tone="warning" className="max-w-xl">
                    Using Cloudflare, GoDaddy, or Route 53? Field names differ
                    slightly — some call this &quot;Name,&quot; some
                    &quot;Host.&quot;
                  </Callout>
                </Example>
                <Example label="tone=accent">
                  <Callout tone="accent" className="max-w-xl">
                    Your nameservers look like{' '}
                    <strong style={{ color: 'var(--accent)' }}>
                      Cloudflare
                    </strong>{' '}
                    — we can open the record form pre-filled.
                  </Callout>
                </Example>
                <Example label="tone=neutral">
                  <Callout tone="neutral" className="max-w-xl">
                    <strong style={{ color: 'var(--text)' }}>
                      What likely happened:
                    </strong>{' '}
                    the value got truncated or edited when it was pasted.
                  </Callout>
                </Example>
                <Example label="emphasis=dashed">
                  <Callout emphasis="dashed" className="max-w-xl">
                    <div
                      className="mb-2 font-mono text-[length:var(--text-2xs)] tracking-[0.06em] uppercase"
                      style={{ color: 'var(--text-faint)' }}
                    >
                      What&apos;s happening under the hood
                    </div>
                    <p>
                      Your DNS provider published the record. We queried three
                      regions — two saw it immediately, one still has the old
                      cached answer.
                    </p>
                  </Callout>
                </Example>
              </div>
            </div>

            <div>
              <ComponentGroupLabel>Card</ComponentGroupLabel>
              <div className="flex flex-col gap-4">
                <Example label="head + body + row composition">
                  <Card className="w-full max-w-xl">
                    <CardHead>
                      <span
                        className="text-[length:var(--text-base)]"
                        style={{
                          fontWeight: 'var(--font-weight-heading)',
                          color: 'var(--text)',
                        }}
                      >
                        Ownership record
                      </span>
                      <Badge tone="accent">TXT</Badge>
                    </CardHead>
                    <CardBody>
                      <div className="flex flex-col gap-0">
                        <CardRow>
                          <div className="flex flex-wrap items-center gap-4">
                            <span
                              className="w-20 shrink-0 font-mono text-[length:var(--text-2xs)] tracking-[0.06em] uppercase"
                              style={{ color: 'var(--text-faint)' }}
                            >
                              Host
                            </span>
                            <span
                              className="font-mono text-[length:var(--text-md)]"
                              style={{ color: 'var(--text)' }}
                            >
                              _acmeapp-challenge.acme.co
                            </span>
                          </div>
                        </CardRow>
                        <CardRow>
                          <div className="flex flex-wrap items-center gap-4">
                            <span
                              className="w-20 shrink-0 font-mono text-[length:var(--text-2xs)] tracking-[0.06em] uppercase"
                              style={{ color: 'var(--text-faint)' }}
                            >
                              Value
                            </span>
                            <span
                              className="font-mono text-[length:var(--text-md)]"
                              style={{ color: 'var(--text)' }}
                            >
                              acmeapp-verify=8f2c9e1a4b7d3f60
                            </span>
                          </div>
                        </CardRow>
                      </div>
                    </CardBody>
                  </Card>
                </Example>
                <Example label="body only, no head">
                  <Card className="w-full max-w-xl">
                    <CardBody>
                      <p style={{ color: 'var(--text-muted)' }}>
                        A panel that only needs the surface, border, and padding
                        — no head or rows.
                      </p>
                    </CardBody>
                  </Card>
                </Example>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
