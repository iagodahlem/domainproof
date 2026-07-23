import type { ReactElement, ReactNode } from 'react'

export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/`/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function flattenToText(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(flattenToText).join('')
  if (typeof node === 'object' && 'props' in node) {
    const element = node as ReactElement<{ children?: ReactNode }>
    return flattenToText(element.props.children)
  }
  return ''
}

export interface TocEntry {
  id: string
  text: string
}

/**
 * Mirrors the id a rendered `<h2>`/`<h3>` gets (see mdx-components.tsx) by
 * running the same slugify + collision-dedupe over the raw heading line —
 * this is what lets the on-page TOC link to a heading that hasn't been
 * rendered yet. Only h2s are collected by default: that's the level every
 * guide's own section structure uses (h3 there is the repeated "Using the
 * SDK" subsection under each h2 operation, which would just be noise in a
 * guide's TOC). `includeH3` opts a page into also collecting h3s — the API
 * reference is the one page where h3 marks a genuine nav target of its own
 * (one per documented endpoint) rather than a repeated subsection label.
 */
export function extractToc(
  body: string,
  options: { includeH3?: boolean } = {},
): TocEntry[] {
  const pattern = options.includeH3 ? /^(?:##|###)\s+(.+)$/ : /^##\s+(.+)$/
  const used = new Map<string, number>()
  const entries: TocEntry[] = []
  for (const line of body.split('\n')) {
    const match = pattern.exec(line.trim())
    if (!match) continue
    const raw = (match[1] ?? '').trim().replace(/`/g, '')
    const stepMatch = /^\d+\.\s+(.*)$/.exec(raw)
    const text = stepMatch ? (stepMatch[1] ?? raw) : raw
    let id = slugifyHeading(raw)
    const count = used.get(id) ?? 0
    used.set(id, count + 1)
    if (count > 0) id = `${id}-${count}`
    entries.push({ id, text })
  }
  return entries
}
