export function SitegradeWordmark() {
  return (
    <div className="flex items-center gap-2 font-sg-display text-lg text-sg-ink">
      <svg
        width="20"
        height="20"
        viewBox="0 0 22 22"
        fill="none"
        aria-hidden="true"
      >
        <circle
          cx="11"
          cy="11"
          r="9"
          fill="#ECE9FE"
          stroke="#5B4CF0"
          strokeWidth="1.8"
        />
        <path d="M11 11 L11 4.5" stroke="#FF5B39" strokeWidth="2" />
        <circle cx="11" cy="11" r="1.6" fill="#5B4CF0" />
      </svg>
      Sitegrade
    </div>
  )
}

export function SiteNav() {
  return (
    <div className="mb-7 flex items-center justify-between">
      <SitegradeWordmark />
      <div className="hidden gap-5 font-sg-body text-xs font-semibold text-sg-ink-soft sm:flex">
        <span>How it works</span>
        <span>For developers</span>
      </div>
    </div>
  )
}
