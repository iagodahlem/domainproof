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
  RecordCard,
  RecordField,
  DomainTable,
  DomainTableHead,
  DomainTableRow,
  DomainTableRowSkeleton,
  VerticalTimeline,
  StatusSummary,
  Stepper,
  CodePanel,
  CodeToken,
  VerificationLog,
  VerificationLogStatus,
} from '@domainproof/ui'
import { ThemeToggle } from './theme-toggle'
import { PathChooserDemo } from './path-chooser-demo'

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

function CloudIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17.5 19a4.5 4.5 0 0 0 0-9 6 6 0 0 0-11.3-2A5 5 0 0 0 6 18h11.5Z" />
    </svg>
  )
}

function WorldIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.3 2.4 3.6 5.6 3.6 9s-1.3 6.6-3.6 9c-2.3-2.4-3.6-5.6-3.6-9s1.3-6.6 3.6-9Z" />
    </svg>
  )
}

function CheckIcon({ size = 11 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

const CURL_SNIPPET = `curl -X POST https://api.domainproof.dev/v1/domains \\
  -H "Authorization: Bearer dp_test_51H8..." \\
  -H "Content-Type: application/json" \\
  -d '{"domain":"acme.co"}'`

const NODE_SNIPPET = `import { DomainProof } from "domainproof";

const dp = new DomainProof("dp_test_51H8...");
const { data, error } = await dp.domains.create({
  domain: "acme.co",
});`

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

        <section id="data-components">
          <SectionHead eyebrow="Composed" title="Data &amp; flow" />

          <div className="flex flex-col gap-10">
            <div>
              <ComponentGroupLabel>Record card &amp; field</ComponentGroupLabel>
              <div className="flex flex-col gap-6">
                <Example label="full — step chip, explain text, copy buttons">
                  <RecordCard
                    step="1"
                    title="Add this DNS record"
                    sub="Log in to where you manage acme.co's DNS."
                    trailing={<Badge tone="accent">TXT</Badge>}
                    className="w-full max-w-xl"
                  >
                    <RecordField
                      label="Host / Name"
                      value="_acmeapp-challenge.acme.co"
                      copyable
                      explain="This subdomain is unique to this request. It doesn't touch your existing DNS, mail, or website."
                    />
                    <RecordField
                      label="Value"
                      value="acmeapp-verify=8f2c9e1a4b7d3f60"
                      copyable
                      explain="A one-time token, generated for this request only. Paste it exactly."
                    />
                  </RecordCard>
                </Example>
                <Example label="compact — dashboard detail, success step, no copy/explain">
                  <RecordCard
                    step={<CheckIcon size={10} />}
                    stepTone="success"
                    title="Ownership record"
                    trailing={<Badge tone="accent">TXT</Badge>}
                    className="w-full max-w-xl"
                  >
                    <RecordField
                      label="Host / Name"
                      value="_acmeapp-challenge.acme.co"
                      compact
                    />
                    <RecordField
                      label="Value"
                      value="acmeapp-verify=8f2c9e1a4b7d3f60"
                      compact
                    />
                  </RecordCard>
                </Example>
                <Example label="headless — onboarding inline, compact + copy, no head">
                  <RecordCard className="w-full max-w-xl">
                    <RecordField
                      label="Host"
                      value="_acmeapp-challenge.acme.co"
                      compact
                      copyable
                    />
                    <RecordField
                      label="Value"
                      value="acmeapp-verify=8f2c9e1a4b7d3f60"
                      compact
                      copyable
                    />
                  </RecordCard>
                </Example>
              </div>
            </div>

            <div>
              <ComponentGroupLabel>Domain table</ComponentGroupLabel>
              <p
                className="mb-4 text-xs"
                style={{ color: 'var(--text-faint)' }}
              >
                Header hides and rows stack into cards below 760px wide — see
                the mobile screenshot capture for the collapsed layout.
              </p>
              <div className="flex flex-col gap-6">
                <Example label="all six status combinations">
                  <DomainTable className="w-full">
                    <DomainTableHead />
                    <DomainTableRow
                      statusTone="success"
                      statusLabel="Verified"
                      name="acme.co"
                      provider={
                        <ProviderBadge icon={<CloudIcon />}>
                          Cloudflare
                        </ProviderBadge>
                      }
                      lastChecked="2 min ago"
                      active
                    />
                    <DomainTableRow
                      statusTone="warning"
                      statusLabel="Propagating"
                      name="pending-then-verified.test"
                      provider={
                        <ProviderBadge style={{ color: 'var(--text-faint)' }}>
                          Sandbox
                        </ProviderBadge>
                      }
                      lastChecked="just now"
                    />
                    <DomainTableRow
                      statusTone="danger"
                      statusLabel="Needs attention"
                      name="wrong-value.test"
                      provider={
                        <ProviderBadge icon={<WorldIcon />}>
                          GoDaddy
                        </ProviderBadge>
                      }
                      lastChecked="4 min ago"
                    />
                    <DomainTableRow
                      statusTone="warning"
                      statusLabel="Recovering"
                      name="flaky.test"
                      provider={
                        <ProviderBadge icon={<WorldIcon />}>
                          Route 53
                        </ProviderBadge>
                      }
                      lastChecked="6 min ago"
                    />
                    <DomainTableRow
                      statusTone="success"
                      statusLabel="Verified"
                      name="updates.acme.co"
                      provider={
                        <ProviderBadge icon={<CloudIcon />}>
                          Cloudflare
                        </ProviderBadge>
                      }
                      lastChecked="1 hour ago"
                    />
                    <DomainTableRow
                      statusTone="neutral"
                      statusLabel="Not found"
                      name="nxdomain.test"
                      lastChecked="1 hour ago"
                    />
                  </DomainTable>
                </Example>
                <Example label="loading">
                  <DomainTable className="w-full">
                    <DomainTableHead />
                    <DomainTableRowSkeleton />
                    <DomainTableRowSkeleton />
                    <DomainTableRowSkeleton />
                  </DomainTable>
                </Example>
              </div>
            </div>

            <div>
              <ComponentGroupLabel>Vertical timeline</ComponentGroupLabel>
              <Example label="claimed → record added → propagating (current) → verified">
                <Card className="w-full max-w-xl">
                  <CardBody>
                    <VerticalTimeline
                      steps={[
                        {
                          id: 'claimed',
                          status: 'done',
                          node: <CheckIcon />,
                          title: 'Claimed',
                          meta: '14:02:11',
                          description:
                            'Acme App asked us to verify acme.co on your behalf. We generated a one-time record.',
                        },
                        {
                          id: 'added',
                          status: 'done',
                          node: <CheckIcon />,
                          title: 'Record added',
                          meta: '14:22:44',
                          description:
                            'We saw your TXT record for the first time and confirmed the value matches.',
                        },
                        {
                          id: 'propagating',
                          status: 'current',
                          node: '3',
                          title: 'Propagating',
                          meta: 'now',
                          description:
                            'Your DNS provider is telling the rest of the internet about the change. Usually minutes.',
                        },
                        {
                          id: 'verified',
                          status: 'upcoming',
                          node: '4',
                          title: 'Verified',
                          meta: '—',
                          description:
                            "We'll notify Acme App the moment every region agrees. No action needed from you.",
                        },
                      ]}
                    />
                  </CardBody>
                </Card>
              </Example>
            </div>

            <div>
              <ComponentGroupLabel>
                Status summary &amp; stepper
              </ComponentGroupLabel>
              <div className="flex flex-col gap-6">
                <Example label="status summary — all steps done">
                  <Card className="w-full max-w-xl">
                    <CardBody>
                      <StatusSummary
                        statusBadge={<Badge tone="success">Verified</Badge>}
                        meta={[
                          { label: 'Last checked', value: '2 min ago' },
                          { label: 'Next check', value: 'in ~3 min' },
                        ]}
                        steps={[
                          {
                            id: 'claimed',
                            status: 'done',
                            node: <CheckIcon size={10} />,
                            label: 'Claimed',
                            time: '09:41',
                          },
                          {
                            id: 'added',
                            status: 'done',
                            node: <CheckIcon size={10} />,
                            label: 'Record added',
                            time: '09:52',
                          },
                          {
                            id: 'propagated',
                            status: 'done',
                            node: <CheckIcon size={10} />,
                            label: 'Propagated',
                            time: '09:58',
                          },
                          {
                            id: 'verified',
                            status: 'done',
                            node: <CheckIcon size={10} />,
                            label: 'Verified',
                            time: '09:58',
                          },
                        ]}
                      />
                    </CardBody>
                  </Card>
                </Example>
                <Example label="stepper — in progress, stacks under 560px">
                  <Card className="w-full max-w-xl">
                    <CardBody>
                      <Stepper
                        steps={[
                          {
                            id: 'claimed',
                            status: 'done',
                            node: <CheckIcon size={10} />,
                            label: 'Claimed',
                            time: '09:41',
                          },
                          {
                            id: 'added',
                            status: 'current',
                            node: '2',
                            label: 'Record added',
                          },
                          {
                            id: 'propagated',
                            status: 'upcoming',
                            node: '3',
                            label: 'Propagated',
                          },
                          {
                            id: 'verified',
                            status: 'upcoming',
                            node: '4',
                            label: 'Verified',
                          },
                        ]}
                      />
                    </CardBody>
                  </Card>
                </Example>
              </div>
            </div>

            <div>
              <ComponentGroupLabel>Code panel</ComponentGroupLabel>
              <Example label="tabs + syntax tokens + copy">
                <CodePanel
                  className="w-full max-w-xl"
                  tabs={[
                    {
                      id: 'curl',
                      label: 'cURL',
                      copyValue: CURL_SNIPPET,
                      code: (
                        <>
                          <CodeToken kind="comment">
                            # claim a domain, sandbox mode
                          </CodeToken>
                          {'\n'}curl -X POST
                          https://api.domainproof.dev/v1/domains \{'\n'}
                          {'  '}-H{' '}
                          <CodeToken kind="string">
                            &quot;Authorization: Bearer dp_test_51H8...&quot;
                          </CodeToken>{' '}
                          \{'\n'}
                          {'  '}-H{' '}
                          <CodeToken kind="string">
                            &quot;Content-Type: application/json&quot;
                          </CodeToken>{' '}
                          \{'\n'}
                          {'  '}-d{' '}
                          <CodeToken kind="string">
                            &apos;{'{'}&quot;domain&quot;:&quot;acme.co&quot;
                            {'}'}&apos;
                          </CodeToken>
                        </>
                      ),
                    },
                    {
                      id: 'node',
                      label: 'Node.js',
                      copyValue: NODE_SNIPPET,
                      code: (
                        <>
                          <CodeToken kind="keyword">import</CodeToken>{' '}
                          {'{ DomainProof }'}{' '}
                          <CodeToken kind="keyword">from</CodeToken>{' '}
                          <CodeToken kind="string">
                            &quot;domainproof&quot;
                          </CodeToken>
                          ;{'\n\n'}
                          <CodeToken kind="keyword">const</CodeToken> dp ={' '}
                          <CodeToken kind="keyword">new</CodeToken> DomainProof(
                          <CodeToken kind="string">
                            &quot;dp_test_51H8...&quot;
                          </CodeToken>
                          );{'\n'}
                          <CodeToken kind="keyword">const</CodeToken>{' '}
                          {'{ data, error }'} ={' '}
                          <CodeToken kind="keyword">await</CodeToken>{' '}
                          dp.domains.create({'{'}
                          {'\n'}
                          {'  '}domain:{' '}
                          <CodeToken kind="string">
                            &quot;acme.co&quot;
                          </CodeToken>
                          ,{'\n'}
                          {'}'});
                        </>
                      ),
                    },
                  ]}
                />
              </Example>
            </div>

            <div>
              <ComponentGroupLabel>Path chooser</ComponentGroupLabel>
              <Example label="4 integration paths, keyboard + click selectable">
                <PathChooserDemo />
              </Example>
            </div>

            <div>
              <ComponentGroupLabel>Verification log</ComponentGroupLabel>
              <div className="flex flex-col gap-6">
                <Example label="entries with a native details/summary technical toggle">
                  <VerificationLog
                    className="w-full max-w-xl"
                    meta="3 entries"
                    entries={[
                      {
                        id: '1',
                        time: '14:02',
                        summary:
                          'Looked for your TXT record — nothing there yet. Totally normal, DNS can take a few minutes to update.',
                        detail: (
                          <>
                            $ dig TXT _acmeapp-challenge.acme.co →{' '}
                            <VerificationLogStatus tone="warn">
                              no record found
                            </VerificationLogStatus>
                          </>
                        ),
                      },
                      {
                        id: '2',
                        time: '14:22',
                        summary:
                          'Found your TXT record and the value matches exactly.',
                        detail: (
                          <>
                            $ dig TXT _acmeapp-challenge.acme.co →{' '}
                            <VerificationLogStatus tone="ok">
                              record found, value matches
                            </VerificationLogStatus>
                          </>
                        ),
                      },
                      {
                        id: '3',
                        time: '14:24',
                        summary:
                          'Checked from three regions — two confirm it, one still has the old answer cached for about 3 more minutes.',
                        detail: (
                          <>
                            $ check 3 regions → us-east{' '}
                            <VerificationLogStatus tone="ok">
                              ok
                            </VerificationLogStatus>
                            , eu-west{' '}
                            <VerificationLogStatus tone="ok">
                              ok
                            </VerificationLogStatus>
                            , ap-southeast{' '}
                            <VerificationLogStatus tone="warn">
                              cached, ~3m ttl
                            </VerificationLogStatus>
                          </>
                        ),
                      },
                    ]}
                  />
                </Example>
                <Example label="empty">
                  <VerificationLog className="w-full max-w-xl" entries={[]} />
                </Example>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
