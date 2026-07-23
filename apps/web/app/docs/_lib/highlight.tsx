import type { ReactNode } from 'react'
import { CodeToken } from '@domainproof/ui'

/**
 * A from-scratch tokenizer, not a real syntax highlighter — deliberately.
 * The board's own code panels only ever use three token colors (comment/
 * string/keyword, see packages/ui/src/code-panel.tsx's .cmt/.str/.kw), so a
 * regex pass over each line covers everything the design actually asks for
 * without pulling in a highlighter dependency.
 */

const HASH_COMMENT_LANGS = new Set(['bash', 'sh'])
const SLASH_COMMENT_LANGS = new Set(['ts', 'tsx', 'js', 'jsx'])
const TOKENIZABLE_LANGS = new Set([
  'bash',
  'sh',
  'json',
  'ts',
  'tsx',
  'js',
  'jsx',
])

const STRING_PATTERN = /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g

const KEYWORD_PATTERN: Partial<Record<string, RegExp>> = {
  bash: /\B(-{1,2}[A-Za-z][\w-]*)/g,
  sh: /\B(-{1,2}[A-Za-z][\w-]*)/g,
  ts: /\b(import|from|export|const|let|await|new|async|function|return|if|else|throw|typeof)\b/g,
  tsx: /\b(import|from|export|const|let|await|new|async|function|return|if|else|throw|typeof)\b/g,
  js: /\b(import|from|export|const|let|await|new|async|function|return|if|else|throw|typeof)\b/g,
  jsx: /\b(import|from|export|const|let|await|new|async|function|return|if|else|throw|typeof)\b/g,
}

interface Span {
  start: number
  end: number
  kind: 'string' | 'keyword'
}

function splitComment(
  line: string,
  lang: string,
): { code: string; comment: string } {
  if (HASH_COMMENT_LANGS.has(lang) && /^\s*#/.test(line)) {
    return { code: '', comment: line }
  }
  if (SLASH_COMMENT_LANGS.has(lang)) {
    const index = line.indexOf('//')
    if (index !== -1) {
      return { code: line.slice(0, index), comment: line.slice(index) }
    }
  }
  return { code: line, comment: '' }
}

function tokenizeLine(
  line: string,
  lang: string,
  lineKey: string,
): ReactNode[] {
  const { code, comment } = splitComment(line, lang)
  const nodes: ReactNode[] = []

  if (code) {
    const spans: Span[] = []
    for (const match of code.matchAll(STRING_PATTERN)) {
      const start = match.index ?? 0
      spans.push({ start, end: start + match[0].length, kind: 'string' })
    }
    const keywordPattern = KEYWORD_PATTERN[lang]
    if (keywordPattern) {
      for (const match of code.matchAll(keywordPattern)) {
        const start = match.index ?? 0
        const end = start + match[0].length
        if (spans.some((span) => start >= span.start && start < span.end))
          continue
        spans.push({ start, end, kind: 'keyword' })
      }
    }
    spans.sort((a, b) => a.start - b.start)

    let cursor = 0
    spans.forEach((span, index) => {
      if (span.start > cursor) nodes.push(code.slice(cursor, span.start))
      nodes.push(
        <CodeToken key={`${lineKey}-${index}`} kind={span.kind}>
          {code.slice(span.start, span.end)}
        </CodeToken>,
      )
      cursor = span.end
    })
    if (cursor < code.length) nodes.push(code.slice(cursor))
  }

  if (comment) {
    nodes.push(
      <CodeToken key={`${lineKey}-comment`} kind="comment">
        {comment}
      </CodeToken>,
    )
  }

  return nodes
}

export function tokenizeCode(source: string, lang: string): ReactNode {
  const trimmed = source.replace(/\n$/, '')
  if (!TOKENIZABLE_LANGS.has(lang)) return trimmed

  const lines = trimmed.split('\n')
  const nodes: ReactNode[] = []
  lines.forEach((line, index) => {
    nodes.push(...tokenizeLine(line, lang, String(index)))
    if (index < lines.length - 1) nodes.push('\n')
  })
  return nodes
}
