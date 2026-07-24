import { AlertTriangle } from 'lucide-react'
import { SgButton } from './sg-button'

export interface UnreachableStateProps {
  domain: string
  reasons: string[]
  onRetry: () => void
  onScanDifferent: () => void
}

export function UnreachableState({
  domain,
  reasons,
  onRetry,
  onScanDifferent,
}: UnreachableStateProps) {
  return (
    <div>
      <div className="mb-4.5 flex h-11 w-11 items-center justify-center rounded-full bg-sg-red-soft text-sg-red-text">
        <AlertTriangle aria-hidden="true" size={19} />
      </div>
      <h2 className="mb-2 font-sg-display text-xl text-sg-ink">
        We couldn&rsquo;t reach {domain}
      </h2>
      <p className="mb-4.5 max-w-[40ch] font-sg-body text-sm leading-relaxed text-sg-ink-soft">
        The domain didn&rsquo;t resolve, or the server didn&rsquo;t respond in
        time. This isn&rsquo;t about ownership yet — we can&rsquo;t scan a site
        we can&rsquo;t reach.
      </p>
      <ul className="mb-6 flex flex-col">
        {reasons.map((reason) => (
          <li
            key={reason}
            className="relative border-t border-sg-line py-2 pl-4.5 font-sg-body text-xs text-sg-ink-soft first:border-t-0"
          >
            <span className="absolute top-3.5 left-0 h-1.5 w-1.5 rounded-full bg-sg-ink-faint" />
            {reason}
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-4">
        <SgButton onClick={onRetry}>Try again</SgButton>
        <button
          type="button"
          onClick={onScanDifferent}
          className="font-sg-body text-xs font-bold text-sg-violet-strong"
        >
          Scan a different domain
        </button>
      </div>
    </div>
  )
}
