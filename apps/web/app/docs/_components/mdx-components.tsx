import type { ComponentProps, ReactElement, ReactNode } from 'react'
import Link from 'next/link'
import { MDXRemote } from 'next-mdx-remote/rsc'
import { Badge, cn, CopyButton, type Tone } from '@domainproof/ui'
import { flattenToText, slugifyHeading } from '../_lib/slug'
import { tokenizeCode } from '../_lib/highlight'

type MdxComponentsMap = ComponentProps<typeof MDXRemote>['components']

const METHOD_TONE: Partial<Record<string, Tone>> = {
  GET: 'accent',
  POST: 'success',
  PATCH: 'warning',
  PUT: 'warning',
  DELETE: 'danger',
}

function P({ children }: { children?: ReactNode }) {
  return (
    <p className="mb-4 leading-body text-muted-foreground last:mb-0">
      {children}
    </p>
  )
}

function Ul({ children }: { children?: ReactNode }) {
  return (
    <ul className="mb-4 flex flex-col gap-1.5 pl-5 leading-body text-muted-foreground [&>li]:list-disc">
      {children}
    </ul>
  )
}

function Ol({ children }: { children?: ReactNode }) {
  return (
    <ol className="mb-4 flex flex-col gap-1.5 pl-5 leading-body text-muted-foreground [&>li]:list-decimal">
      {children}
    </ol>
  )
}

function Li({ children }: { children?: ReactNode }) {
  return <li className="pl-1">{children}</li>
}

function Strong({ children }: { children?: ReactNode }) {
  return <strong className="font-semibold text-foreground">{children}</strong>
}

function Hr() {
  return <hr className="my-8 border-border" />
}

function MdxLink({ href, children }: { href?: string; children?: ReactNode }) {
  const className = 'text-accent underline-offset-4 hover:underline'
  if (href?.startsWith('/')) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    )
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      {children}
    </a>
  )
}

function InlineCode({ children }: { children?: ReactNode }) {
  const text = flattenToText(children)
  const tone = METHOD_TONE[text]
  if (tone) return <Badge tone={tone}>{text}</Badge>
  return (
    <code className="rounded-sm bg-surface-2 px-1.5 py-0.5 font-mono text-sm text-foreground">
      {children}
    </code>
  )
}

function CodeBlock({ children }: { children?: ReactNode }) {
  const codeElement = children as ReactElement<{
    className?: string
    children?: string
  }>
  const rawText = codeElement?.props?.children ?? ''
  const lang = codeElement?.props?.className?.replace('language-', '') ?? 'txt'

  return (
    <div className="group relative my-4 min-w-0 overflow-hidden rounded-lg border border-border bg-background">
      <pre className="m-0 overflow-x-auto p-4 pr-14 font-mono text-xs leading-code break-words whitespace-pre-wrap">
        <code>{tokenizeCode(rawText, lang)}</code>
      </pre>
      <CopyButton
        value={rawText.replace(/\n$/, '')}
        size="sm"
        iconOnly
        aria-label="Copy code"
        className="absolute top-3 right-3"
      >
        Copy
      </CopyButton>
    </div>
  )
}

function Table({ children }: { children?: ReactNode }) {
  return (
    <div className="my-6 overflow-x-auto rounded-lg border border-border">
      <table className="min-w-full border-collapse text-sm">{children}</table>
    </div>
  )
}

function Thead({ children }: { children?: ReactNode }) {
  return (
    <thead className="border-b border-border bg-surface-2">{children}</thead>
  )
}

function Th({ children }: { children?: ReactNode }) {
  return (
    <th className="px-4 py-3 text-left font-mono text-2xs font-semibold tracking-label text-faint-foreground uppercase">
      {children}
    </th>
  )
}

function Tr({ children }: { children?: ReactNode }) {
  return (
    <tr className="border-b border-border transition-colors duration-150 last:border-b-0 hover:bg-surface-2">
      {children}
    </tr>
  )
}

function Td({ children }: { children?: ReactNode }) {
  return (
    <td className="px-4 py-3 align-top text-muted-foreground">{children}</td>
  )
}

/** A leading `N. ` on an h2 marks a genuine ordered sequence (the quickstart's
 * claim → check → verify steps) — everywhere else in the docs stays
 * unordered, matching the product's own restraint about numbering things
 * that aren't a real sequence (see board-docs.html's design notes). */
function headingIdAndStep(text: string) {
  const stepMatch = /^(\d+)\.\s+(.*)$/.exec(text)
  return {
    step: stepMatch?.[1],
    displayText: stepMatch ? stepMatch[2] : text,
  }
}

function makeHeading(level: 2 | 3, usedIds: Map<string, number>) {
  return function Heading({ children }: { children?: ReactNode }) {
    const text = flattenToText(children)
    let id = slugifyHeading(text)
    const count = usedIds.get(id) ?? 0
    usedIds.set(id, count + 1)
    if (count > 0) id = `${id}-${count}`

    if (level === 2) {
      const { step, displayText } = headingIdAndStep(text)
      if (step) {
        return (
          <h2
            id={id}
            className="mt-10 mb-3 flex scroll-mt-24 items-center gap-3 text-xl leading-heading font-heading text-foreground first:mt-0"
          >
            <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-accent-soft font-mono text-xs font-bold text-accent">
              {step}
            </span>
            {displayText}
          </h2>
        )
      }
      return (
        <h2
          id={id}
          className="mt-10 mb-3 scroll-mt-24 text-xl leading-heading font-heading text-foreground first:mt-0"
        >
          {children}
        </h2>
      )
    }

    return (
      <h3
        id={id}
        className={cn(
          'mt-6 mb-2 scroll-mt-24 text-base leading-heading-loose font-heading text-foreground',
        )}
      >
        {children}
      </h3>
    )
  }
}

/** A fresh components map per render — heading ids are deduped with a
 * per-page counter, so a page's own render must own its counter rather
 * than share one at module scope across concurrent requests. */
export function createMdxComponents(): MdxComponentsMap {
  const usedIds = new Map<string, number>()
  return {
    h1: () => null,
    h2: makeHeading(2, usedIds),
    h3: makeHeading(3, usedIds),
    p: P,
    ul: Ul,
    ol: Ol,
    li: Li,
    strong: Strong,
    hr: Hr,
    a: MdxLink,
    code: InlineCode,
    pre: CodeBlock,
    table: Table,
    thead: Thead,
    tr: Tr,
    th: Th,
    td: Td,
  }
}
