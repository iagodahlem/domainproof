import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/postcss'
import postcss from 'postcss'
import prefixSelector from 'postcss-prefix-selector'

const here = dirname(fileURLToPath(import.meta.url))
const packageRoot = resolve(here, '..')

/**
 * Every rule in the compiled stylesheet is scoped under this class —
 * consumers wrap nothing themselves, `<DomainVerification />` renders it
 * on its own root element. Keeps Tailwind's reset/utility classes (and the
 * `:focus-visible` rule from `@domainproof/ui/focus-ring.css`) from ever
 * touching the rest of the host page.
 */
export const SCOPE_CLASS = 'dp-widget'

/**
 * Compiles `src/styles.css` (Tailwind + `@domainproof/ui`'s design tokens,
 * scanned across this package's and `@domainproof/ui`'s source for classes
 * actually in use) into a single scoped stylesheet — the file
 * `@domainproof/react/styles.css` resolves to. `:root`/`:root[data-theme=...]`
 * become `.dp-widget`/`.dp-widget[data-theme=...]` (the token
 * declarations move from the document root onto the widget's own root, so
 * `theme="light"` on `<DomainVerification />` — which sets that attribute
 * — is what selects the light token set); every other selector gets
 * `.dp-widget` prepended as an ancestor, so a class like `.flex` only
 * matches inside the widget, never a same-named class in the host app.
 */
export async function buildStyles({
  outFile = resolve(packageRoot, 'dist/styles.css'),
} = {}) {
  const entryPath = resolve(packageRoot, 'src/styles.css')
  const entry = await readFile(entryPath, 'utf8')

  const result = await postcss([
    tailwindcss(),
    prefixSelector({
      prefix: `.${SCOPE_CLASS}`,
      transform(prefix, selector, prefixedSelector) {
        if (selector.startsWith(':root')) {
          return selector.replace(':root', prefix)
        }
        return prefixedSelector
      },
    }),
  ]).process(entry, { from: entryPath, to: outFile })

  await mkdir(dirname(outFile), { recursive: true })
  await writeFile(outFile, result.css)
  return result.css
}

const isMainModule = process.argv[1] === fileURLToPath(import.meta.url)
if (isMainModule) {
  await buildStyles()
}
