import type { Metadata } from 'next'
import Link from 'next/link'
import { Badge, Card } from '@domainproof/ui'
import { DocsShell } from './_components/docs-shell'
import { getNavGroups } from './_lib/content'

export const metadata: Metadata = {
  title: 'DomainProof docs',
  description:
    "Claim a domain, hand your user one DNS record, get a webhook the moment it's true.",
}

const SECTION_BADGE: Partial<Record<string, string>> = {
  Concepts: 'concept',
  Guides: 'guide',
  Reference: 'reference',
}

export default function DocsLandingPage() {
  const groups = getNavGroups()
  const startHere =
    groups.find((group) => group.section === 'Start here')?.docs ?? []
  const rest = groups
    .filter((group) => group.section !== 'Start here')
    .flatMap((group) => group.docs)

  return (
    <DocsShell groups={groups}>
      <p className="mb-3 font-mono text-xs font-semibold tracking-widest text-accent uppercase">
        DomainProof docs
      </p>
      <h1 className="mb-3 text-3xl leading-heading-tight font-heading text-foreground">
        Prove domain ownership without building the DNS UX yourself.
      </h1>
      <p className="mb-8 max-w-[66ch] leading-body text-muted-foreground">
        Claim a domain, hand your user one DNS record, get a webhook the moment
        it&rsquo;s true. Start with the quickstart below — it uses a sandbox
        domain, so there&rsquo;s nothing to configure first.
      </p>

      <div className="mb-8 grid grid-cols-2 gap-4 max-[700px]:grid-cols-1">
        {startHere.map((doc) => (
          <Link key={doc.slug} href={`/docs/${doc.slug}`}>
            <Card className="h-full p-5 transition-colors duration-150 hover:bg-surface-2">
              <div className="mb-2 flex items-start justify-between gap-3">
                <h2 className="text-base font-heading text-foreground">
                  {doc.title}
                </h2>
                <Badge tone="accent">5 min</Badge>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {doc.description}
              </p>
            </Card>
          </Link>
        ))}
      </div>

      <h2 className="mb-4 text-xl leading-heading font-heading text-foreground">
        All guides
      </h2>
      <div className="flex flex-col overflow-hidden rounded-lg border border-border">
        {rest.map((doc) => (
          <Link
            key={doc.slug}
            href={`/docs/${doc.slug}`}
            className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 transition-colors duration-150 last:border-b-0 hover:bg-surface-2"
          >
            <span className="text-sm font-semibold text-foreground">
              {doc.title}
            </span>
            <Badge tone="neutral">
              {SECTION_BADGE[doc.section] ?? doc.section.toLowerCase()}
            </Badge>
          </Link>
        ))}
      </div>
    </DocsShell>
  )
}
