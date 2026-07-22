import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Check, ChevronDown, ChevronRight, Copy, Moon, Sun } from 'lucide-react'
import {
  Badge,
  BrowserChrome,
  Callout,
  Card,
  CardBody,
  CardHead,
  CardRow,
  CopyButton,
  Header,
  Logo,
  ProviderBadge,
  StatusPill,
  Button,
  RecordCard,
  RecordField,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
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
  TextField,
  Select,
  Checkbox,
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

/* Tailwind can only pick up class names that appear literally in this file
   — `bg-${token}` built at render time would be invisible to it — so each
   swatch's background is looked up from this table of literal utility
   classes instead of interpolated. */
const COLOR_SWATCH_CLASS: Record<string, string> = {
  bg: 'bg-bg',
  surface: 'bg-surface',
  'surface-2': 'bg-surface-2',
  'surface-3': 'bg-surface-3',
  border: 'bg-border',
  'border-strong': 'bg-border-strong',
  text: 'bg-text',
  'text-muted': 'bg-text-muted',
  'text-faint': 'bg-text-faint',
  accent: 'bg-accent',
  'accent-strong': 'bg-accent-strong',
  'accent-soft': 'bg-accent-soft',
  'accent-foreground': 'bg-accent-foreground',
  success: 'bg-success',
  'success-soft': 'bg-success-soft',
  warning: 'bg-warning',
  'warning-strong': 'bg-warning-strong',
  'warning-soft': 'bg-warning-soft',
  danger: 'bg-danger',
  'danger-soft': 'bg-danger-soft',
}

const SPACE_TOKENS = [1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24]

const SPACE_WIDTH_CLASS: Record<number, string> = {
  1: 'w-1',
  2: 'w-2',
  3: 'w-3',
  4: 'w-4',
  5: 'w-5',
  6: 'w-6',
  8: 'w-8',
  10: 'w-10',
  12: 'w-12',
  16: 'w-16',
  20: 'w-20',
  24: 'w-24',
}

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

/* md and base are repositioned onto Tailwind's base/lg slots — see the
   mapping note in theme.css. Every other step keeps its board name. */
const TYPE_TOKEN_CLASS: Record<string, string> = {
  '3xs': 'text-3xs',
  '2xs': 'text-2xs',
  xs: 'text-xs',
  sm: 'text-sm',
  md: 'text-base',
  base: 'text-lg',
  xl: 'text-xl',
  '2xl': 'text-2xl',
  '3xl': 'text-3xl',
  '4xl': 'text-4xl',
}

const RADIUS_TOKENS = ['sm', 'md', 'lg', 'xl', 'full']

const RADIUS_CLASS: Record<string, string> = {
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  xl: 'rounded-xl',
  full: 'rounded-full',
}

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
        className={`h-14 rounded-md border border-border ${COLOR_SWATCH_CLASS[token]}`}
      />
      <span className="font-mono text-xs text-text-faint">--{token}</span>
    </div>
  )
}

function ComponentGroupLabel({ children }: { children: ReactNode }) {
  return (
    <h3 className="mb-4 text-sm font-semibold text-text-muted">{children}</h3>
  )
}

function Example({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="font-mono text-xs text-text-faint">{label}</span>
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
      className="min-h-screen bg-bg font-sans text-text"
    >
      <Header
        left={
          <span className="flex items-center gap-2 text-lg font-bold whitespace-nowrap">
            <Logo />
            design system
          </span>
        }
        right={<ThemeToggle />}
      />

      <main className="mx-auto flex max-w-5xl flex-col gap-16 px-6 py-12">
        <section id="tokens">
          <SectionHead eyebrow="Foundations" title="Tokens" />

          <div className="flex flex-col gap-10">
            <div>
              <h3 className="mb-4 text-sm font-semibold text-text-muted">
                Color
              </h3>
              <div className="flex flex-col gap-8">
                {COLOR_GROUPS.map((group) => (
                  <div key={group.label}>
                    <span className="mb-3 block font-mono text-xs tracking-wide text-text-faint uppercase">
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
              <h3 className="mb-4 text-sm font-semibold text-text-muted">
                Spacing
              </h3>
              <div className="flex flex-col gap-3">
                {SPACE_TOKENS.map((step) => (
                  <div key={step} className="flex items-center gap-4">
                    <span className="w-20 font-mono text-xs text-text-faint">
                      space-{step}
                    </span>
                    <div
                      className={`h-2.5 rounded-sm bg-accent ${SPACE_WIDTH_CLASS[step]}`}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="mb-4 text-sm font-semibold text-text-muted">
                Type
              </h3>
              <div className="flex flex-col">
                {TYPE_TOKENS.map((step) => (
                  <div
                    key={step}
                    className="flex items-baseline gap-4 border-b border-border py-3 last:border-b-0"
                  >
                    <span className="w-20 flex-shrink-0 font-mono text-xs text-text-faint">
                      --text-{step}
                    </span>
                    <span className={`${TYPE_TOKEN_CLASS[step]} leading-body`}>
                      The quick brown fox
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="mb-4 text-sm font-semibold text-text-muted">
                Radius
              </h3>
              <div className="flex flex-wrap items-end gap-6">
                {RADIUS_TOKENS.map((step) => (
                  <div key={step} className="flex flex-col items-center gap-2">
                    <div
                      className={`h-14 w-14 border border-border-strong bg-surface-2 ${RADIUS_CLASS[step]}`}
                    />
                    <span className="font-mono text-xs text-text-faint">
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
              <ComponentGroupLabel>Logo</ComponentGroupLabel>
              <div className="flex flex-col gap-6">
                <Example label="default">
                  <Logo />
                </Example>
              </div>
            </div>

            <div>
              <ComponentGroupLabel>Header</ComponentGroupLabel>
              <p className="mb-4 text-xs text-text-faint">
                Empty chrome shell — height, background, border, and container.
                Each surface composes its own left/right content; this
                page&rsquo;s own header above is a glass-variant instance.
              </p>
              <div className="flex flex-col gap-6">
                <Example label="variant=glass — marketing pages, locked create-project screen">
                  <div className="w-full overflow-hidden rounded-lg border border-border">
                    <Header
                      left={<Logo />}
                      right={
                        <Button size="sm" variant="primary">
                          Continue with Google
                        </Button>
                      }
                    />
                  </div>
                </Example>
                <Example label="variant=solid — dashboard topbar, next to the sidebar">
                  <div className="w-full overflow-hidden rounded-lg border border-border">
                    <Header
                      variant="solid"
                      left={
                        <strong className="text-base font-heading text-text">
                          Domains
                        </strong>
                      }
                      right={<Badge tone="accent">Preview</Badge>}
                    />
                  </div>
                </Example>
              </div>
            </div>

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
                <Example label="shape=pill">
                  <Button shape="pill">Open Cloudflare DNS</Button>
                  <Button variant="primary" shape="pill">
                    Recheck now
                  </Button>
                  <Button variant="ghost" shape="pill">
                    Load more
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
                  <StatusPill tone="neutral">Not started</StatusPill>
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
                    Your nameservers look like <strong>Cloudflare</strong> — we
                    can open the record form pre-filled.
                  </Callout>
                </Example>
                <Example label="tone=neutral">
                  <Callout tone="neutral" className="max-w-xl">
                    <strong>What likely happened:</strong> the value got
                    truncated or edited when it was pasted.
                  </Callout>
                </Example>
                <Example label="emphasis=dashed">
                  <Callout emphasis="dashed" className="max-w-xl">
                    <div className="mb-2 font-mono text-2xs tracking-label text-text-faint uppercase">
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
                      <span className="text-lg font-heading text-text">
                        Ownership record
                      </span>
                      <Badge tone="accent">TXT</Badge>
                    </CardHead>
                    <CardRow>
                      <div className="flex flex-wrap items-center gap-4">
                        <span className="w-20 shrink-0 font-mono text-2xs tracking-label text-text-faint uppercase">
                          Host
                        </span>
                        <span className="font-mono text-base text-text">
                          _acmeapp-challenge.acme.co
                        </span>
                      </div>
                    </CardRow>
                    <CardRow>
                      <div className="flex flex-wrap items-center gap-4">
                        <span className="w-20 shrink-0 font-mono text-2xs tracking-label text-text-faint uppercase">
                          Value
                        </span>
                        <span className="font-mono text-base text-text">
                          acmeapp-verify=8f2c9e1a4b7d3f60
                        </span>
                      </div>
                    </CardRow>
                  </Card>
                </Example>
                <Example label="body only, no head">
                  <Card className="w-full max-w-xl">
                    <CardBody>
                      <p className="text-text-muted">
                        A panel that only needs the surface, border, and padding
                        — no head or rows.
                      </p>
                    </CardBody>
                  </Card>
                </Example>
              </div>
            </div>

            <div>
              <ComponentGroupLabel>Browser chrome</ComponentGroupLabel>
              <Example label="mock window card, composable content">
                <BrowserChrome
                  url="app.domainproof.dev/acme-app/events"
                  className="w-full max-w-xl"
                >
                  <div className="flex flex-col divide-y divide-border">
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="font-mono text-xs text-text-muted">
                        domain.claimed
                      </span>
                      <Badge tone="accent">200</Badge>
                    </div>
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="font-mono text-xs text-text-muted">
                        domain.propagating
                      </span>
                      <Badge tone="warning">200</Badge>
                    </div>
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="font-mono text-xs text-text-muted">
                        domain.verified
                      </span>
                      <Badge tone="success">200</Badge>
                    </div>
                  </div>
                </BrowserChrome>
              </Example>
            </div>

            <div>
              <ComponentGroupLabel>Icons</ComponentGroupLabel>
              <p className="mb-4 text-xs text-text-faint">
                lucide-react — used for the copy button, theme toggle, and
                chevrons throughout the system.
              </p>
              <div className="flex flex-wrap gap-6">
                {[
                  { icon: Copy, label: 'Copy' },
                  { icon: Check, label: 'Check' },
                  { icon: ChevronDown, label: 'ChevronDown' },
                  { icon: ChevronRight, label: 'ChevronRight' },
                  { icon: Sun, label: 'Sun' },
                  { icon: Moon, label: 'Moon' },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex flex-col items-center gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md border border-border text-text-muted">
                      <Icon size={16} />
                    </div>
                    <span className="font-mono text-xs text-text-faint">
                      {label}
                    </span>
                  </div>
                ))}
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
              <ComponentGroupLabel>Table</ComponentGroupLabel>
              <p className="mb-4 text-xs text-text-faint">
                The generic primitive DomainTable is built on — bring your own
                grid template via className and lay out cells however the data
                calls for.
              </p>
              <Example label="generic 3-column layout">
                <Table className="w-full">
                  <TableHeader
                    // eslint-disable-next-line better-tailwindcss/no-restricted-classes -- bespoke grid-template-columns for this example's 3-column shape; no single token models a multi-track template
                    className="grid-cols-[1fr_120px_80px]"
                  >
                    <span>Name</span>
                    <span>Role</span>
                    <span>Seats</span>
                  </TableHeader>
                  <TableBody>
                    <TableRow
                      // eslint-disable-next-line better-tailwindcss/no-restricted-classes -- same bespoke grid template as the header row above
                      className="grid-cols-[1fr_120px_80px]"
                    >
                      <TableCell className="font-heading text-text">
                        Acme Inc.
                      </TableCell>
                      <TableCell className="text-text-muted">Owner</TableCell>
                      <TableCell className="text-text-muted">12</TableCell>
                    </TableRow>
                    <TableRow
                      // eslint-disable-next-line better-tailwindcss/no-restricted-classes -- same bespoke grid template as the header row above
                      className="grid-cols-[1fr_120px_80px]"
                    >
                      <TableCell className="font-heading text-text">
                        Globex Corp.
                      </TableCell>
                      <TableCell className="text-text-muted">Member</TableCell>
                      <TableCell className="text-text-muted">4</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </Example>
            </div>

            <div>
              <ComponentGroupLabel>Domain table</ComponentGroupLabel>
              <p className="mb-4 text-xs text-text-faint">
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
                        <ProviderBadge className="text-text-faint">
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
                <Example label="stepper — in progress, scrolls horizontally when narrow">
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

        <section id="form-controls">
          <SectionHead eyebrow="Inputs" title="Form controls" />

          <div className="flex flex-col gap-10">
            <div>
              <ComponentGroupLabel>Text field</ComponentGroupLabel>
              <div className="flex flex-col gap-6">
                <Example label="label + placeholder">
                  <TextField label="Domain" placeholder="acme.co" />
                </Example>
                <Example label="filled">
                  <TextField label="Domain" defaultValue="acme.co" />
                </Example>
                <Example label="disabled">
                  <TextField label="Domain" defaultValue="acme.co" disabled />
                </Example>
                <Example label="invalid + inline error">
                  <TextField
                    label="Webhook URL"
                    defaultValue="ftp://acme.co/hook"
                    error="Must be a valid https:// URL"
                  />
                </Example>
              </div>
            </div>

            <div>
              <ComponentGroupLabel>Select</ComponentGroupLabel>
              <div className="flex flex-col gap-6">
                <Example label="label + options">
                  <Select
                    label="Verification method"
                    options={[
                      { value: 'txt', label: 'DNS TXT record' },
                      { value: 'http', label: 'HTTP well-known file' },
                    ]}
                  />
                </Example>
                <Example label="disabled">
                  <Select
                    label="Verification method"
                    options={[
                      { value: 'txt', label: 'DNS TXT record' },
                      { value: 'http', label: 'HTTP well-known file' },
                    ]}
                    disabled
                  />
                </Example>
                <Example label="invalid + inline error">
                  <Select
                    label="Retry backoff"
                    options={[
                      { value: '', label: 'Choose a backoff strategy' },
                      { value: 'linear', label: 'Linear' },
                      { value: 'exponential', label: 'Exponential' },
                    ]}
                    error="Choose a backoff strategy"
                  />
                </Example>
              </div>
            </div>

            <div>
              <ComponentGroupLabel>Checkbox</ComponentGroupLabel>
              <div className="flex flex-col gap-4">
                <Example label="unchecked / checked">
                  <Checkbox label="Send me webhook retries" />
                  <Checkbox label="Include test-mode events" defaultChecked />
                </Example>
                <Example label="disabled">
                  <Checkbox label="Send me webhook retries" disabled />
                  <Checkbox
                    label="Include test-mode events"
                    defaultChecked
                    disabled
                  />
                </Example>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
