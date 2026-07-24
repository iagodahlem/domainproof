import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import postcss from 'postcss'
import { afterEach, describe, expect, it } from 'vitest'
import { buildStyles, SCOPE_CLASS } from './build-css.mjs'

const WIDGET_SELECTOR = `.${SCOPE_CLASS}`

async function compile() {
  const outDir = await mkdtemp(join(tmpdir(), 'domainproof-react-styles-'))
  const outFile = join(outDir, 'styles.css')
  const css = await buildStyles({ outFile })
  return { css, outDir, outFile }
}

describe('buildStyles', () => {
  let outDir: string | undefined

  afterEach(async () => {
    if (outDir) await rm(outDir, { recursive: true, force: true })
  })

  it('writes the stylesheet @domainproof/react/styles.css resolves to', async () => {
    const result = await compile()
    outDir = result.outDir

    // package.json's `./styles.css` export and `files: ["dist"]` both
    // point at this exact path — it's what `pnpm pack` ships.
    expect(await readFile(result.outFile, 'utf8')).toBe(result.css)
    expect(result.css.length).toBeGreaterThan(0)
  })

  it('scopes every rule under the widget root so nothing leaks onto the host page', async () => {
    const result = await compile()
    outDir = result.outDir
    const root = postcss.parse(result.css)

    // A utility class DomainVerification's own markup renders (RecordCard's
    // root) — every rule that carries it must be scoped, not just some.
    let sawRoundedLg = false
    let sawUnscopedRoundedLg = false
    // The `:focus-visible` rule from `@domainproof/ui/focus-ring.css` is a
    // bare, global pseudo-class selector in source — unscoped, it would
    // change the host page's own focus-ring behavior everywhere.
    let sawFocusVisible = false
    let sawUnscopedFocusVisible = false
    // Tailwind's universal box-sizing/border reset, same story.
    let sawUniversalReset = false

    root.walkRules((rule) => {
      for (const selector of rule.selectors) {
        if (selector.includes('.rounded-lg')) {
          sawRoundedLg = true
          if (!selector.startsWith(WIDGET_SELECTOR)) sawUnscopedRoundedLg = true
        }
        if (selector.includes(':focus-visible')) {
          sawFocusVisible = true
          if (!selector.startsWith(`${WIDGET_SELECTOR} `))
            sawUnscopedFocusVisible = true
        }
        if (selector === `${WIDGET_SELECTOR} *`) sawUniversalReset = true
      }
    })

    expect(sawRoundedLg).toBe(true)
    expect(sawUnscopedRoundedLg).toBe(false)
    expect(sawFocusVisible).toBe(true)
    expect(sawUnscopedFocusVisible).toBe(false)
    expect(sawUniversalReset).toBe(true)
  })

  it('declares tokens on the widget root, not the document root, and keys the light theme off the same root', async () => {
    const result = await compile()
    outDir = result.outDir
    const root = postcss.parse(result.css)

    // `--accent` (and every other token) is declared directly on
    // `.dp-widget` — not inherited from an ancestor, since a `theme="light"`
    // prop sets `data-theme` on the widget's own root element.
    const accentDeclSelectors: string[] = []
    root.walkDecls('--accent', (decl) => {
      if (decl.parent?.type === 'rule')
        accentDeclSelectors.push(...decl.parent.selectors)
    })
    expect(accentDeclSelectors).toContain(WIDGET_SELECTOR)

    let sawLightThemeRule = false
    let sawBareRoot = false
    root.walkRules((rule) => {
      for (const selector of rule.selectors) {
        if (selector === `${WIDGET_SELECTOR}[data-theme='light']`)
          sawLightThemeRule = true
        if (selector.startsWith(':root')) sawBareRoot = true
      }
    })
    expect(sawLightThemeRule).toBe(true)
    expect(sawBareRoot).toBe(false)
  })

  it('sets its own base text color on the widget root, not the host page', async () => {
    const result = await compile()
    outDir = result.outDir
    const root = postcss.parse(result.css)

    // Elements without an explicit text utility (RecordCard's title,
    // Stepper's done/upcoming step labels) would otherwise inherit
    // whatever color the host page sets on its own body — this declares
    // `color` directly on `.dp-widget` so the widget stays legible
    // regardless of the embedding page's own theme.
    const colorDeclSelectors: string[] = []
    root.walkDecls('color', (decl) => {
      if (decl.parent?.type === 'rule')
        colorDeclSelectors.push(...decl.parent.selectors)
    })
    expect(colorDeclSelectors).toContain(WIDGET_SELECTOR)
  })

  it('only includes the @domainproof/ui components DomainVerification actually renders', async () => {
    const result = await compile()
    outDir = result.outDir

    // `peer-checked:opacity-100` belongs to Checkbox alone — nothing this
    // widget renders uses it. Its presence would mean Tailwind is scanning
    // more of packages/ui than src/styles.css's explicit @source list (or
    // that automatic content detection got re-enabled — see that file's
    // `source(none)` comment).
    expect(result.css).not.toContain('peer-checked')
  })
})
