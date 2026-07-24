import { CheckStatusIcon } from './check-status'

const TEASER_CHECK_TITLES = [
  'HTTPS & TLS',
  'Security headers',
  'DNS records',
  'Response time',
]

export function ScanningState({ domain }: { domain: string }) {
  return (
    <div>
      <div className="mb-2.5 font-sg-body text-2xs font-bold uppercase tracking-wide text-sg-ink-faint">
        Scanning
      </div>
      <h1 className="mb-6 truncate font-sg-display text-2xl text-sg-ink">
        {domain}
      </h1>

      <div className="mb-4 h-1 overflow-hidden rounded-full bg-sg-line">
        <span className="block h-full w-2/5 animate-sg-scan-progress rounded-full bg-sg-violet motion-reduce:animate-none" />
      </div>

      <div className="flex flex-col">
        {TEASER_CHECK_TITLES.map((title, index) => (
          <div
            key={title}
            className="flex items-center gap-3.5 border-t border-sg-line py-3 first:border-t-0 first:pt-0"
          >
            <CheckStatusIcon status="pending" />
            <div className="min-w-0 flex-1">
              <div className="font-sg-body text-sm font-bold text-sg-ink">
                {title}
              </div>
              <div className="font-sg-body text-xs leading-snug text-sg-ink-soft">
                {index === 0 ? 'Checking…' : 'Queued…'}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
