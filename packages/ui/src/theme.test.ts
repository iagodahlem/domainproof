import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/postcss'
import postcss from 'postcss'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))

const CLASSES = [
  'bg-accent',
  'text-accent',
  'border-accent',
  'bg-surface',
  'text-text-muted',
  'border-border-strong',
  'bg-success',
  'bg-warning',
  'bg-danger',
  'rounded-md',
  'shadow-card',
  'shadow-current',
  'font-heading',
  'leading-body',
  'border-accent-border',
  'bg-bg-glass',
  'backdrop-blur-header',
]

async function compile() {
  // source(none) turns off automatic content scanning, so the compiled
  // output reflects only the classes listed below — not incidental string
  // matches from sibling source files (this one included).
  const entry = `
    @import 'tailwindcss' source(none);
    @import './tokens.css';
    @import './theme.css';
    @source inline("${CLASSES.join(' ')}");
  `
  const result = await postcss([tailwindcss()]).process(entry, {
    from: resolve(here, 'theme.test.css'),
  })
  return result.css
}

describe('theme.css', () => {
  it('generates every expected utility class', async () => {
    const css = await compile()
    for (const className of CLASSES) {
      expect(css).toContain(`.${className} {`)
    }
  })

  it('points color utilities at the raw token variable, not a frozen value', async () => {
    const css = await compile()
    expect(css).toMatch(
      /\.bg-accent\s*{\s*background-color:\s*var\(--accent\);?\s*}/,
    )
    expect(css).toMatch(
      /\.bg-surface\s*{\s*background-color:\s*var\(--surface\);?\s*}/,
    )
    expect(css).toMatch(
      /\.text-text-muted\s*{\s*color:\s*var\(--text-muted\);?\s*}/,
    )
    expect(css).toMatch(
      /\.border-border-strong\s*{\s*border-color:\s*var\(--border-strong\);?\s*}/,
    )
  })

  it('points radius, shadow, weight and leading utilities at the raw token variable', async () => {
    const css = await compile()
    expect(css).toMatch(
      /\.rounded-md\s*{\s*border-radius:\s*var\(--radius-md\);?\s*}/,
    )
    expect(css).toMatch(
      /\.shadow-card\s*{[^}]*--tw-shadow:\s*var\(--shadow-card\)/,
    )
    expect(css).toMatch(/font-weight:\s*var\(--font-weight-heading\)/)
    expect(css).toMatch(/line-height:\s*var\(--leading-body\)/)
  })

  it('points the new border-tint, shadow and duration utilities at the raw token variable', async () => {
    const css = await compile()
    expect(css).toMatch(
      /\.border-accent-border\s*{\s*border-color:\s*var\(--accent-border\);?\s*}/,
    )
    expect(css).toMatch(
      /\.shadow-current\s*{[^}]*--tw-shadow:\s*var\(--shadow-current\)/,
    )
  })

  it('points the header blur utility at the raw token variable', async () => {
    const css = await compile()
    expect(css).toMatch(
      /\.backdrop-blur-header\s*{[^}]*--tw-backdrop-blur:\s*blur\(var\(--blur-header\)\)/,
    )
  })
})
