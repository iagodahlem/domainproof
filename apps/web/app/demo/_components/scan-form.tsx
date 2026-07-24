'use client'

import { ArrowRight } from 'lucide-react'
import { SgButton } from './sg-button'

const TEASER_PILLS = [
  'HTTPS & TLS',
  'Security headers',
  'DNS records',
  'Response time',
  '+5 more when verified',
]

export interface ScanFormProps {
  domain: string
  onDomainChange: (value: string) => void
  onSubmit: () => void
  errorMessage?: string | null
}

export function ScanForm({
  domain,
  onDomainChange,
  onSubmit,
  errorMessage,
}: ScanFormProps) {
  return (
    <div>
      <div className="mb-2.5 font-sg-body text-2xs font-bold uppercase tracking-wide text-sg-ink-faint">
        Free &middot; instant &middot; no signup
      </div>
      <h1 className="mb-3 max-w-[15ch] font-sg-display text-3xl leading-tight text-sg-ink">
        See what your site tells the internet.
      </h1>
      <p className="mb-6 max-w-[42ch] font-sg-body text-sm leading-relaxed text-sg-ink-soft">
        A free, instant read on your site&rsquo;s security, DNS, and performance
        &mdash; the public-facing facts, no crawling behind login walls.
      </p>

      <form
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit()
        }}
        className="mb-3.5 flex items-center gap-2.5 rounded-full border-2 border-sg-line-strong bg-sg-paper py-1.5 pr-1.5 pl-5"
      >
        <input
          value={domain}
          onChange={(event) => onDomainChange(event.target.value)}
          type="text"
          inputMode="url"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder="yoursite.com"
          aria-label="Domain to scan"
          className="min-w-0 flex-1 bg-transparent font-sg-mono text-sm text-sg-ink placeholder:text-sg-ink-faint focus:outline-none"
        />
        <SgButton type="submit" disabled={!domain.trim()}>
          Scan for free
          <ArrowRight aria-hidden="true" size={14} />
        </SgButton>
      </form>

      {errorMessage ? (
        <div className="mb-4 font-sg-body text-xs font-semibold text-sg-red-text">
          {errorMessage}
        </div>
      ) : (
        <div className="mb-5.5 font-sg-body text-2xs text-sg-ink-faint">
          Own the site? You can verify after scanning to unlock the full report.
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {TEASER_PILLS.map((pill) => (
          <span
            key={pill}
            className="rounded-full border border-sg-line bg-sg-paper-2 px-3 py-1.5 font-sg-body text-2xs font-bold text-sg-ink-soft"
          >
            {pill}
          </span>
        ))}
      </div>
    </div>
  )
}
