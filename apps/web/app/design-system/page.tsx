import type { Metadata } from 'next'
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
      </main>
    </div>
  )
}
