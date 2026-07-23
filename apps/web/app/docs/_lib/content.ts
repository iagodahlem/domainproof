import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

export interface Doc {
  slug: string
  title: string
  description: string
  section: string
  order: number
  body: string
}

export interface DocsNavGroup {
  section: string
  docs: Doc[]
}

const CONTENT_DIR = path.join(process.cwd(), 'content/docs')

/** Group display order — everything else sorts alphabetically after these. */
const SECTION_ORDER = ['Start here', 'Concepts', 'Guides', 'Reference']

function walkMdxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) return walkMdxFiles(full)
    return full.endsWith('.mdx') ? [full] : []
  })
}

function unquote(value: string): string {
  const trimmed = value.trim()
  if (
    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
  ) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

function parseFrontmatter(source: string): {
  data: Record<string, string>
  body: string
} {
  const match = /^---\n([\s\S]*?)\n---\n?/.exec(source)
  if (!match) throw new Error('Doc content is missing its frontmatter block')
  const data: Record<string, string> = {}
  for (const line of (match[1] ?? '').split('\n')) {
    if (!line.trim()) continue
    const colonIndex = line.indexOf(':')
    const key = line.slice(0, colonIndex).trim()
    data[key] = unquote(line.slice(colonIndex + 1))
  }
  return { data, body: source.slice(match[0].length) }
}

function required(
  data: Record<string, string>,
  key: string,
  file: string,
): string {
  const value = data[key]
  if (!value) throw new Error(`${file} is missing frontmatter field "${key}"`)
  return value
}

function loadDocs(): Doc[] {
  return walkMdxFiles(CONTENT_DIR).map((file) => {
    const { data, body } = parseFrontmatter(readFileSync(file, 'utf8'))
    return {
      slug: path.basename(file, '.mdx'),
      title: required(data, 'title', file),
      description: required(data, 'description', file),
      section: required(data, 'section', file),
      order: Number(required(data, 'order', file)),
      body,
    }
  })
}

export function getAllDocs(): Doc[] {
  return loadDocs()
}

export function getDocBySlug(slug: string): Doc | undefined {
  return getAllDocs().find((doc) => doc.slug === slug)
}

export function getNavGroups(): DocsNavGroup[] {
  const docs = getAllDocs()
  const sections = Array.from(new Set(docs.map((doc) => doc.section)))
  sections.sort((a, b) => {
    const indexA = SECTION_ORDER.indexOf(a)
    const indexB = SECTION_ORDER.indexOf(b)
    if (indexA === -1 && indexB === -1) return a.localeCompare(b)
    if (indexA === -1) return 1
    if (indexB === -1) return -1
    return indexA - indexB
  })
  return sections.map((section) => ({
    section,
    docs: docs
      .filter((doc) => doc.section === section)
      .sort((a, b) => a.order - b.order),
  }))
}
